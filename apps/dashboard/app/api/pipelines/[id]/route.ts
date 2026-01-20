import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns, testResults, tests } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * @swagger
 * /api/pipelines/{id}:
 *   get:
 *     tags:
 *       - Pipelines
 *     summary: Get pipeline details
 *     description: Returns detailed information about a specific pipeline including environment info and recent runs from the same repository
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pipeline ID (UUID)
 *     responses:
 *       200:
 *         description: Pipeline details retrieved successfully
 *       404:
 *         description: Pipeline not found
 *       500:
 *         description: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get the pipeline
    const pipeline = await db.query.testRuns.findFirst({
      where: eq(testRuns.id, id),
    });

    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    // Get repository for this run (from associated test results)
    const repoResult = await db
      .selectDistinct({ repository: tests.repository })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .where(eq(testResults.testRunId, id))
      .limit(1);

    const repository = repoResult[0]?.repository || null;

    // Get recent runs from the same repository (excluding current)
    let recentRuns: Array<{
      id: string;
      runId: string;
      branch: string | null;
      status: string;
      startedAt: Date;
      durationMs: number | null;
      totalTests: number;
      passedCount: number;
      failedCount: number;
      skippedCount: number;
      flakyCount: number;
    }> = [];

    if (repository) {
      // Get run IDs that have results from this repository
      const runsWithRepo = await db
        .selectDistinct({ runId: testResults.testRunId })
        .from(testResults)
        .innerJoin(tests, eq(testResults.testId, tests.id))
        .where(eq(tests.repository, repository));

      const runIds = runsWithRepo.map((r) => r.runId);

      if (runIds.length > 0) {
        // Get recent runs excluding current
        const runIdParams = runIds.map((rid) => sql`${rid}`);
        const recentRunsResult = await db
          .select({
            id: testRuns.id,
            runId: testRuns.runId,
            branch: testRuns.branch,
            status: testRuns.status,
            startedAt: testRuns.startedAt,
            durationMs: testRuns.durationMs,
            totalTests: testRuns.totalTests,
            passedCount: testRuns.passedCount,
            failedCount: testRuns.failedCount,
            skippedCount: testRuns.skippedCount,
            flakyCount: testRuns.flakyCount,
          })
          .from(testRuns)
          .where(
            sql`${testRuns.id} = ANY(ARRAY[${sql.join(runIdParams, sql`, `)}]::uuid[]) AND ${testRuns.id} != ${id}`
          )
          .orderBy(desc(testRuns.startedAt))
          .limit(5);

        recentRuns = recentRunsResult;
      }
    }

    // Calculate average duration from recent runs for comparison
    const avgDuration =
      recentRuns.length > 0
        ? Math.round(
            recentRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) /
              recentRuns.filter((r) => r.durationMs).length
          )
        : null;

    return NextResponse.json({
      pipeline: {
        ...pipeline,
        repository,
      },
      recentRuns,
      stats: {
        avgDuration,
        totalRecentRuns: recentRuns.length,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch pipeline details");
    return NextResponse.json(
      { error: "Failed to fetch pipeline details" },
      { status: 500 }
    );
  }
}
