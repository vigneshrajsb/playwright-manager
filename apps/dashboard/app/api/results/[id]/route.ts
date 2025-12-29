import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testResults, tests, testRuns, testHealth } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get the result with test and run data
    const resultData = await db
      .select({
        result: testResults,
        test: tests,
        run: testRuns,
      })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(eq(testResults.id, id))
      .limit(1);

    if (resultData.length === 0) {
      return NextResponse.json(
        { error: "Result not found" },
        { status: 404 }
      );
    }

    const { result, test, run } = resultData[0];

    // Get health data for the test
    const healthData = await db
      .select()
      .from(testHealth)
      .where(eq(testHealth.testId, test.id))
      .limit(1);

    const health = healthData[0] || null;

    // Get recent history - last 5 runs of this test
    const recentHistory = await db
      .select({
        id: testResults.id,
        status: testResults.status,
        outcome: testResults.outcome,
        durationMs: testResults.durationMs,
        startedAt: testResults.startedAt,
        errorMessage: testResults.errorMessage,
        branch: testRuns.branch,
        commitSha: testRuns.commitSha,
      })
      .from(testResults)
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(eq(testResults.testId, test.id))
      .orderBy(desc(testResults.startedAt))
      .limit(5);

    return NextResponse.json({
      result,
      test,
      health,
      recentHistory,
      run: {
        id: run.id,
        runId: run.runId,
        branch: run.branch,
        commitSha: run.commitSha,
        commitMessage: run.commitMessage,
        ciJobUrl: run.ciJobUrl,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch result");
    return NextResponse.json(
      { error: "Failed to fetch result" },
      { status: 500 }
    );
  }
}
