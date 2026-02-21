import { db } from "@/lib/db";
import { testResults, testHealth, TestResult as DbTestResult } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface HealthStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  totalDuration: number;
}

const HEALTH_OVERALL_WINDOW = parseInt(process.env.HEALTH_OVERALL_WINDOW || "50");
const HEALTH_RECENT_WINDOW = parseInt(process.env.HEALTH_RECENT_WINDOW || "10");
const HEALTH_RECENT_WEIGHT = parseFloat(process.env.HEALTH_RECENT_WEIGHT || "0.6");
const HEALTH_OVERALL_WEIGHT = 1 - HEALTH_RECENT_WEIGHT;

function calculateStats(results: DbTestResult[]): HealthStats {
  return results.reduce<HealthStats>(
    (acc, r) => {
      acc.total++;
      if (r.outcome === "expected") acc.passed++;
      if (r.outcome === "unexpected") acc.failed++;
      if (r.outcome === "skipped") acc.skipped++;
      if (r.outcome === "flaky") acc.flaky++;
      acc.totalDuration += r.durationMs;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, totalDuration: 0 }
  );
}

export async function updateTestHealth(tx: Transaction, testId: number) {
  const allResults = await tx.query.testResults.findMany({
    where: and(
      eq(testResults.testId, testId),
      eq(testResults.isFinalAttempt, true)
    ),
    orderBy: (results, { desc }) => [desc(results.startedAt)],
    limit: HEALTH_OVERALL_WINDOW,
  });

  if (allResults.length === 0) return;

  const overallStats = calculateStats(allResults);
  const overallExecuted = overallStats.passed + overallStats.failed + overallStats.flaky;
  const overallPassRate = overallExecuted > 0 ? ((overallStats.passed + overallStats.flaky) / overallExecuted) * 100 : null;
  const overallFlakinessRate = overallExecuted > 0 ? (overallStats.flaky / overallExecuted) * 100 : null;

  const recentResults = allResults.slice(0, HEALTH_RECENT_WINDOW);
  const recentStats = calculateStats(recentResults);
  const recentExecuted = recentStats.passed + recentStats.failed + recentStats.flaky;
  const recentPassRate = recentExecuted > 0 ? ((recentStats.passed + recentStats.flaky) / recentExecuted) * 100 : null;
  const recentFlakinessRate = recentExecuted > 0 ? (recentStats.flaky / recentExecuted) * 100 : null;

  let weightedPassRate: number | null;
  if (recentPassRate !== null && overallPassRate !== null) {
    weightedPassRate = (recentPassRate * HEALTH_RECENT_WEIGHT) + (overallPassRate * HEALTH_OVERALL_WEIGHT);
  } else if (overallPassRate !== null) {
    weightedPassRate = overallPassRate;
  } else if (recentPassRate !== null) {
    weightedPassRate = recentPassRate;
  } else {
    weightedPassRate = null;
  }

  let flakinessRate: number | null;
  if (recentFlakinessRate !== null && overallFlakinessRate !== null) {
    flakinessRate = Math.max(recentFlakinessRate, overallFlakinessRate);
  } else if (overallFlakinessRate !== null) {
    flakinessRate = overallFlakinessRate;
  } else if (recentFlakinessRate !== null) {
    flakinessRate = recentFlakinessRate;
  } else {
    flakinessRate = null;
  }

  if (weightedPassRate === null) {
    const existingHealth = await tx.query.testHealth.findFirst({
      where: eq(testHealth.testId, testId),
    });

    const metadataUpdate = {
      totalRuns: overallStats.total,
      skippedCount: overallStats.skipped,
      lastStatus: allResults[0].status,
      lastRunAt: allResults[0].startedAt,
      updatedAt: new Date(),
    };

    if (existingHealth) {
      await tx.update(testHealth).set({
        ...metadataUpdate,
        healthScore: null,
      }).where(eq(testHealth.testId, testId));
    } else {
      await tx.insert(testHealth).values({
        testId,
        ...metadataUpdate,
        healthScore: null,
        passRate: "0.00",
        flakinessRate: "0.00",
        recentPassRate: "0.00",
        recentFlakinessRate: "0.00",
        healthDivergence: "0.00",
        avgDurationMs: 0,
        trend: "stable",
        consecutivePasses: 0,
        consecutiveFailures: 0,
      });
    }
    return;
  }

  const effectiveFlakinessRate = flakinessRate ?? 0;
  const healthScore = Math.max(0, Math.round(weightedPassRate - effectiveFlakinessRate));

  const healthDivergence = (recentPassRate ?? 0) - (overallPassRate ?? 0);

  let consecutivePasses = 0,
    consecutiveFailures = 0;
  for (const r of allResults) {
    if (r.outcome === "expected" || r.outcome === "flaky") {
      if (consecutiveFailures === 0) consecutivePasses++;
      else break;
    } else if (r.outcome === "unexpected") {
      if (consecutivePasses === 0) consecutiveFailures++;
      else break;
    }
  }

  let trend = "stable";
  if (healthScore < 50) trend = "critical";
  else if (consecutiveFailures >= 3 || healthDivergence < -15) trend = "degrading";
  else if (consecutivePasses >= 5 && healthScore > 80) trend = "improving";

  const existingHealth = await tx.query.testHealth.findFirst({
    where: eq(testHealth.testId, testId),
  });

  const healthData = {
    totalRuns: overallStats.total,
    passedCount: overallStats.passed,
    failedCount: overallStats.failed,
    skippedCount: overallStats.skipped,
    flakyCount: overallStats.flaky,
    passRate: (overallPassRate ?? 0).toFixed(2),
    flakinessRate: effectiveFlakinessRate.toFixed(2),
    recentPassRate: (recentPassRate ?? 0).toFixed(2),
    recentFlakinessRate: (recentFlakinessRate ?? 0).toFixed(2),
    healthDivergence: healthDivergence.toFixed(2),
    avgDurationMs: overallExecuted > 0
      ? Math.round(overallStats.totalDuration / overallExecuted)
      : 0,
    healthScore,
    trend,
    consecutivePasses,
    consecutiveFailures,
    lastStatus: allResults[0].status,
    lastRunAt: allResults[0].startedAt,
    lastPassedAt:
      allResults.find((r) => r.outcome === "expected" || r.outcome === "flaky")?.startedAt || null,
    lastFailedAt:
      allResults.find((r) => r.outcome === "unexpected")?.startedAt || null,
    updatedAt: new Date(),
  };

  if (existingHealth) {
    await tx
      .update(testHealth)
      .set(healthData)
      .where(eq(testHealth.testId, testId));
  } else {
    await tx.insert(testHealth).values({
      testId,
      ...healthData,
    });
  }
}
