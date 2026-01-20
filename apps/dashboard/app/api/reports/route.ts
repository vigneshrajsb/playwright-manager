import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testRuns, testResults, testHealth, TestResult as DbTestResult } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * @swagger
 * /api/reports:
 *   post:
 *     tags:
 *       - Reports
 *     summary: Ingest test report
 *     description: Receives test results from the Playwright reporter and stores them in the database. Updates test health metrics automatically.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - runId
 *               - startTime
 *               - results
 *             properties:
 *               runId:
 *                 type: string
 *                 description: Unique identifier for the test run
 *               metadata:
 *                 type: object
 *                 required:
 *                   - repository
 *                 properties:
 *                   repository:
 *                     type: string
 *                     description: Repository in "org/repo" format (required)
 *                   branch:
 *                     type: string
 *                   commitSha:
 *                     type: string
 *                   commitMessage:
 *                     type: string
 *                   ciJobUrl:
 *                     type: string
 *                   playwrightVersion:
 *                     type: string
 *                   workers:
 *                     type: integer
 *                   shard:
 *                     type: object
 *                     properties:
 *                       current:
 *                         type: integer
 *                       total:
 *                         type: integer
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [running, passed, failed, interrupted]
 *               results:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     testId:
 *                       type: string
 *                     filePath:
 *                       type: string
 *                     title:
 *                       type: string
 *                     projectName:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [passed, failed, timedOut, skipped, interrupted]
 *                     outcome:
 *                       type: string
 *                       enum: [expected, unexpected, skipped, flaky]
 *                     duration:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Report processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 runId:
 *                   type: string
 *       500:
 *         description: Server error
 */

// Schema for incoming test result
interface TestResultPayload {
  testId: string;
  filePath: string;
  title: string;
  titlePath: string[];
  projectName: string;
  tags?: string[];
  location: {
    file: string;
    line: number;
    column: number;
  };
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  expectedStatus: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration: number;
  retry: number;
  isFinalAttempt?: boolean;
  workerIndex: number;
  parallelIndex: number;
  outcome: "expected" | "unexpected" | "skipped" | "flaky";
  error?: {
    message?: string;
    stack?: string;
    snippet?: string;
  };
  annotations?: Array<{ type: string; description?: string }>;
  attachments?: Array<{ name: string; contentType: string; path?: string }>;
  startTime: string;
  skippedByDashboard?: boolean;
  baseUrl?: string;
}

interface ReportPayload {
  runId: string;
  metadata?: {
    repository: string; // Required - e.g., "org/repo"
    branch?: string;
    commitSha?: string;
    commitMessage?: string;
    ciJobUrl?: string;
    baseUrl?: string;
    playwrightVersion?: string;
    workers?: number;
    shardCurrent?: number;
    shardTotal?: number;
    reportPath?: string; // S3 path to HTML report
  };
  startTime: string;
  endTime?: string;
  status?: "running" | "passed" | "failed" | "interrupted";
  results: TestResultPayload[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportPayload = await request.json();

    // Validate repository is provided
    if (!body.metadata?.repository) {
      return NextResponse.json(
        { error: "metadata.repository is required" },
        { status: 400 }
      );
    }

    const repository = body.metadata.repository;

    const result = await db.transaction(async (tx) => {
      // 1. Upsert the test run
      const existingRun = await tx.query.testRuns.findFirst({
        where: eq(testRuns.runId, body.runId),
      });

      let testRun;
      // Count only final attempts for accurate test totals
      const finalAttemptCount = body.results.filter(r => r.isFinalAttempt ?? true).length;

      if (existingRun) {
        // Update existing run - accumulate totalTests (final attempts only)
        const [updated] = await tx
          .update(testRuns)
          .set({
            finishedAt: body.endTime ? new Date(body.endTime) : null,
            status: body.status || existingRun.status,
            totalTests: existingRun.totalTests + finalAttemptCount,
            durationMs: body.endTime
              ? new Date(body.endTime).getTime() -
                new Date(body.startTime).getTime()
              : null,
            // Only update reportPath if provided (don't overwrite existing)
            reportPath: body.metadata?.reportPath ?? existingRun.reportPath,
          })
          .where(eq(testRuns.runId, body.runId))
          .returning();
        testRun = updated;
      } else {
        // Create new run (repository is derived from tests, not stored in testRuns)
        const [created] = await tx
          .insert(testRuns)
          .values({
            runId: body.runId,
            branch: body.metadata?.branch,
            commitSha: body.metadata?.commitSha,
            commitMessage: body.metadata?.commitMessage,
            ciJobUrl: body.metadata?.ciJobUrl,
            baseUrl: body.metadata?.baseUrl,
            reportPath: body.metadata?.reportPath,
            playwrightVersion: body.metadata?.playwrightVersion,
            totalWorkers: body.metadata?.workers,
            shardCurrent: body.metadata?.shardCurrent,
            shardTotal: body.metadata?.shardTotal,
            startedAt: new Date(body.startTime),
            finishedAt: body.endTime ? new Date(body.endTime) : null,
            durationMs: body.endTime
              ? new Date(body.endTime).getTime() -
                new Date(body.startTime).getTime()
              : null,
            status: body.status || "running",
            totalTests: finalAttemptCount,
          })
          .returning();
        testRun = created;
      }

      // 2. Process each test result
      let passedCount = 0,
        failedCount = 0,
        skippedCount = 0,
        flakyCount = 0;

      for (const testResult of body.results) {
        // Upsert test - now includes repository in unique key
        const existingTest = await tx.query.tests.findFirst({
          where: and(
            eq(tests.repository, repository),
            eq(tests.filePath, testResult.filePath),
            eq(tests.testTitle, testResult.title),
            eq(tests.projectName, testResult.projectName)
          ),
        });

        let test;
        if (existingTest) {
          // Build update data, including restore if test was deleted
          const updateData: Record<string, any> = {
            playwrightTestId: testResult.testId,
            tags: testResult.tags || [],
            locationLine: testResult.location.line,
            locationColumn: testResult.location.column,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          };

          // Auto-restore if test was soft-deleted (it's back in the codebase)
          if (existingTest.isDeleted) {
            updateData.isDeleted = false;
            updateData.deletedAt = null;
            updateData.deletedReason = null;
          }

          const [updated] = await tx
            .update(tests)
            .set(updateData)
            .where(eq(tests.id, existingTest.id))
            .returning();
          test = updated;
        } else {
          const [created] = await tx
            .insert(tests)
            .values({
              playwrightTestId: testResult.testId,
              repository,
              filePath: testResult.filePath,
              testTitle: testResult.title,
              projectName: testResult.projectName,
              tags: testResult.tags || [],
              locationLine: testResult.location.line,
              locationColumn: testResult.location.column,
            })
            .returning();
          test = created;
        }

        // Insert test result
        await tx.insert(testResults).values({
          testId: test.id,
          testRunId: testRun.id,
          status: testResult.status,
          expectedStatus: testResult.expectedStatus,
          durationMs: testResult.duration,
          retryCount: testResult.retry,
          isFinalAttempt: testResult.isFinalAttempt ?? true,
          workerIndex: testResult.workerIndex,
          parallelIndex: testResult.parallelIndex,
          errorMessage: testResult.error?.message || null,
          errorStack: testResult.error?.stack || null,
          errorSnippet: testResult.error?.snippet || null,
          outcome: testResult.outcome,
          attachments: testResult.attachments || [],
          annotations: testResult.annotations || [],
          skippedByDashboard: testResult.skippedByDashboard || false,
          baseUrl: testResult.baseUrl || body.metadata?.baseUrl,
          startedAt: new Date(testResult.startTime),
        });

        // Update counts - only count final attempts for accurate totals
        const isFinal = testResult.isFinalAttempt ?? true;
        if (isFinal) {
          switch (testResult.outcome) {
            case "expected":
              passedCount++;
              break;
            case "unexpected":
              failedCount++;
              break;
            case "skipped":
              skippedCount++;
              break;
            case "flaky":
              flakyCount++;
              break;
          }
        }

        // Update test health
        await updateTestHealth(tx, test.id);
      }

      // Update run stats - accumulate with existing counts
      await tx
        .update(testRuns)
        .set({
          passedCount: testRun.passedCount + passedCount,
          failedCount: testRun.failedCount + failedCount,
          skippedCount: testRun.skippedCount + skippedCount,
          flakyCount: testRun.flakyCount + flakyCount,
        })
        .where(eq(testRuns.id, testRun.id));

      return testRun;
    });

    return NextResponse.json({ success: true, runId: result.id });
  } catch (error) {
    logger.error({ err: error }, "Failed to process report");
    return NextResponse.json(
      { error: "Failed to process report" },
      { status: 500 }
    );
  }
}

interface HealthStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  totalDuration: number;
}

// Configurable health algorithm parameters
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

async function updateTestHealth(tx: Transaction, testId: string) {
  // Get last N final results for this test (based on overall window)
  // Only count final attempts to avoid skewing health metrics with retry attempts
  const allResults = await tx.query.testResults.findMany({
    where: and(
      eq(testResults.testId, testId),
      eq(testResults.isFinalAttempt, true)
    ),
    orderBy: (results, { desc }) => [desc(results.startedAt)],
    limit: HEALTH_OVERALL_WINDOW,
  });

  if (allResults.length === 0) return;

  // Calculate overall stats (all results in window)
  const overallStats = calculateStats(allResults);
  const overallExecuted = overallStats.passed + overallStats.failed + overallStats.flaky;
  const overallPassRate = overallExecuted > 0 ? (overallStats.passed / overallExecuted) * 100 : 0;
  const overallFlakinessRate = overallExecuted > 0 ? (overallStats.flaky / overallExecuted) * 100 : 0;

  // Calculate recent stats (first N results only)
  const recentResults = allResults.slice(0, HEALTH_RECENT_WINDOW);
  const recentStats = calculateStats(recentResults);
  const recentExecuted = recentStats.passed + recentStats.failed + recentStats.flaky;
  const recentPassRate = recentExecuted > 0 ? (recentStats.passed / recentExecuted) * 100 : 0;
  const recentFlakinessRate = recentExecuted > 0 ? (recentStats.flaky / recentExecuted) * 100 : 0;

  // Weighted pass rate: recent window has more impact
  const weightedPassRate = (recentPassRate * HEALTH_RECENT_WEIGHT) + (overallPassRate * HEALTH_OVERALL_WEIGHT);

  // Use the higher flakiness rate (more conservative)
  const flakinessRate = Math.max(recentFlakinessRate, overallFlakinessRate);

  // Final health score with flakiness penalty
  const healthScore = Math.max(0, Math.round(weightedPassRate - flakinessRate * 2));

  // Health divergence: difference between recent and overall (negative = declining)
  const healthDivergence = recentPassRate - overallPassRate;

  // Calculate consecutive passes/failures (from most recent results)
  let consecutivePasses = 0,
    consecutiveFailures = 0;
  for (const r of allResults) {
    if (r.outcome === "expected") {
      if (consecutiveFailures === 0) consecutivePasses++;
      else break;
    } else if (r.outcome === "unexpected") {
      if (consecutivePasses === 0) consecutiveFailures++;
      else break;
    }
  }

  // Determine trend (also consider divergence)
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
    passRate: overallPassRate.toFixed(2),
    flakinessRate: flakinessRate.toFixed(2),
    recentPassRate: recentPassRate.toFixed(2),
    recentFlakinessRate: recentFlakinessRate.toFixed(2),
    healthDivergence: healthDivergence.toFixed(2),
    avgDurationMs: Math.round(overallStats.totalDuration / overallStats.total),
    healthScore,
    trend,
    consecutivePasses,
    consecutiveFailures,
    lastStatus: allResults[0].status,
    lastRunAt: allResults[0].startedAt,
    lastPassedAt:
      allResults.find((r) => r.outcome === "expected")?.startedAt || null,
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
