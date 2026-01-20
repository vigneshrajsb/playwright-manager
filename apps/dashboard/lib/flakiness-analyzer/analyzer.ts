import { db } from "@/lib/db";
import { testResults, testHealth, tests, errorSignatures } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateHeuristicScore, isHighConfidence } from "./heuristics";
import { analyzewithLLM, isLLMConfigured } from "./llm-analyzer";
import { hashErrorSignature } from "./error-normalizer";
import type {
  PipelineVerdict,
  TestVerdict,
  FlakinessSignals,
} from "./types";
import { logger } from "@/lib/logger";

const AUTO_PASS_THRESHOLD = 90;

export async function analyzeFlakiness(
  pipelineId: string
): Promise<PipelineVerdict> {
  // Get failed test results for this pipeline
  const failedResults = await db
    .select({
      resultId: testResults.id,
      testId: testResults.testId,
      errorMessage: testResults.errorMessage,
      errorStack: testResults.errorStack,
      outcome: testResults.outcome,
    })
    .from(testResults)
    .where(
      and(
        eq(testResults.testRunId, pipelineId),
        eq(testResults.outcome, "unexpected"),
        eq(testResults.isFinalAttempt, true)
      )
    );

  if (failedResults.length === 0) {
    return {
      verdict: "flaky",
      confidence: 100,
      canAutoPass: true,
      failedTests: [],
      summary: "No failures to analyze",
    };
  }

  const testVerdicts: TestVerdict[] = [];

  for (const result of failedResults) {
    const verdict = await analyzeTestFailure(
      result.testId,
      result.errorMessage,
      result.errorStack
    );
    testVerdicts.push(verdict);
  }

  // Calculate overall verdict
  const flakyCount = testVerdicts.filter((v) => v.verdict === "flaky").length;
  const realFailureCount = testVerdicts.filter(
    (v) => v.verdict === "likely_real_failure"
  ).length;

  const avgConfidence =
    testVerdicts.reduce((sum, v) => sum + v.confidence, 0) / testVerdicts.length;

  const overallVerdict: "flaky" | "likely_real_failure" =
    realFailureCount === 0 ? "flaky" : "likely_real_failure";

  const canAutoPass =
    overallVerdict === "flaky" && avgConfidence >= AUTO_PASS_THRESHOLD;

  let summary: string;
  if (realFailureCount === 0) {
    summary = `All ${flakyCount} failure${flakyCount > 1 ? "s are" : " is"} known flaky (${avgConfidence.toFixed(0)}% avg confidence)`;
  } else if (flakyCount === 0) {
    summary = `${realFailureCount} failure${realFailureCount > 1 ? "s need" : " needs"} investigation`;
  } else {
    summary = `${flakyCount} of ${testVerdicts.length} failures are flaky. ${realFailureCount} need${realFailureCount > 1 ? "" : "s"} investigation.`;
  }

  return {
    verdict: overallVerdict,
    confidence: Math.round(avgConfidence),
    canAutoPass,
    failedTests: testVerdicts,
    summary,
  };
}

async function analyzeTestFailure(
  testId: string,
  errorMessage: string | null,
  errorStack: string | null
): Promise<TestVerdict> {
  // Get test info
  const test = await db.query.tests.findFirst({
    where: eq(tests.id, testId),
  });

  if (!test) {
    return createUnknownVerdict(testId);
  }

  // Get test health
  const health = await db.query.testHealth.findFirst({
    where: eq(testHealth.testId, testId),
  });

  // Get recent outcomes (last 10 final results)
  const recentResults = await db
    .select({
      outcome: testResults.outcome,
      startedAt: testResults.startedAt,
    })
    .from(testResults)
    .where(
      and(eq(testResults.testId, testId), eq(testResults.isFinalAttempt, true))
    )
    .orderBy(desc(testResults.startedAt))
    .limit(10);

  const recentOutcomes = recentResults.map((r) => {
    switch (r.outcome) {
      case "expected":
        return "pass" as const;
      case "unexpected":
        return "fail" as const;
      case "flaky":
        return "flaky" as const;
      default:
        return "skip" as const;
    }
  });

  // Check error signature
  let errorSeenBefore = false;
  let errorPassedAfterCount = 0;

  if (errorMessage) {
    const signatureHash = hashErrorSignature(errorMessage);
    const existingSignature = await db.query.errorSignatures.findFirst({
      where: and(
        eq(errorSignatures.testId, testId),
        eq(errorSignatures.signatureHash, signatureHash)
      ),
    });

    if (existingSignature) {
      errorSeenBefore = true;
      errorPassedAfterCount = existingSignature.passedAfterCount;
    }
  }

  // Build signals
  const signals: FlakinessSignals = {
    flakinessRate: parseFloat(health?.flakinessRate?.toString() || "0"),
    recentFlakinessRate: parseFloat(
      health?.recentFlakinessRate?.toString() || "0"
    ),
    recentOutcomes,
    errorSeenBefore,
    errorPassedAfterCount,
    consecutiveFailures: health?.consecutiveFailures || 0,
    consecutivePasses: health?.consecutivePasses || 0,
    healthScore: health?.healthScore || 50,
    healthDivergence: parseFloat(health?.healthDivergence?.toString() || "0"),
  };

  // Calculate heuristic score
  const heuristicResult = calculateHeuristicScore(signals);

  let finalScore = heuristicResult.score;
  let llmUsed = false;
  let reasoning = heuristicResult.reasoning.join("; ");

  // If not high confidence and LLM is configured, use LLM
  if (!isHighConfidence(heuristicResult.score) && isLLMConfigured()) {
    const llmResult = await analyzewithLLM({
      testTitle: test.testTitle,
      filePath: test.filePath,
      errorMessage: errorMessage || "",
      stackTrace: errorStack || "",
      recentHistory: formatRecentHistory(recentResults),
      similarErrors: await getSimilarErrors(testId, errorMessage),
      heuristicScore: heuristicResult.score,
      heuristicReasoning: reasoning,
    });

    if (llmResult) {
      llmUsed = true;
      finalScore = Math.max(
        0,
        Math.min(100, heuristicResult.score + llmResult.confidenceAdjustment)
      );
      reasoning = llmResult.reasoning;

      // Override verdict if LLM strongly disagrees
      if (
        llmResult.verdict === "real_bug" &&
        llmResult.confidenceAdjustment < -10
      ) {
        finalScore = Math.min(finalScore, 50);
      }
    }
  }

  const verdict: "flaky" | "likely_real_failure" =
    finalScore >= 60 ? "flaky" : "likely_real_failure";

  return {
    testId,
    testTitle: test.testTitle,
    filePath: test.filePath,
    verdict,
    confidence: finalScore,
    reasoning,
    signals,
    llmUsed,
    errorMessage: errorMessage || undefined,
    errorStack: errorStack || undefined,
  };
}

function createUnknownVerdict(testId: string): TestVerdict {
  return {
    testId,
    testTitle: "Unknown test",
    filePath: "unknown",
    verdict: "likely_real_failure",
    confidence: 0,
    reasoning: "Test not found in database",
    signals: {
      flakinessRate: 0,
      recentFlakinessRate: 0,
      recentOutcomes: [],
      errorSeenBefore: false,
      errorPassedAfterCount: 0,
      consecutiveFailures: 0,
      consecutivePasses: 0,
      healthScore: 0,
      healthDivergence: 0,
    },
    llmUsed: false,
  };
}

function formatRecentHistory(
  results: Array<{ outcome: string; startedAt: Date }>
): string {
  if (results.length === 0) return "No history";

  return results
    .map((r) => {
      const date = r.startedAt.toISOString().split("T")[0];
      const status =
        r.outcome === "expected"
          ? "PASS"
          : r.outcome === "unexpected"
            ? "FAIL"
            : r.outcome.toUpperCase();
      return `- ${date}: ${status}`;
    })
    .join("\n");
}

async function getSimilarErrors(
  testId: string,
  errorMessage: string | null
): Promise<string> {
  if (!errorMessage) return "No error to compare";

  const signatureHash = hashErrorSignature(errorMessage);

  // Find same error on other tests
  const similarSignatures = await db
    .select({
      testTitle: tests.testTitle,
      occurrenceCount: errorSignatures.occurrenceCount,
      passedAfterCount: errorSignatures.passedAfterCount,
    })
    .from(errorSignatures)
    .innerJoin(tests, eq(errorSignatures.testId, tests.id))
    .where(eq(errorSignatures.signatureHash, signatureHash))
    .limit(5);

  if (similarSignatures.length === 0) {
    return "No similar errors found on other tests";
  }

  return similarSignatures
    .map(
      (s) =>
        `- "${s.testTitle}": seen ${s.occurrenceCount}x, passed after ${s.passedAfterCount}x`
    )
    .join("\n");
}
