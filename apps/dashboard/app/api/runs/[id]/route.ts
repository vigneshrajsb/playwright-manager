import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns, testResults, tests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * @swagger
 * /api/runs/{id}:
 *   get:
 *     tags:
 *       - Runs
 *     summary: Get run details
 *     description: Returns detailed information about a specific test run including all results
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Run ID (UUID)
 *     responses:
 *       200:
 *         description: Run details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 run:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     runId:
 *                       type: string
 *                     branch:
 *                       type: string
 *                     commitSha:
 *                       type: string
 *                     status:
 *                       type: string
 *                     totalTests:
 *                       type: integer
 *                     passedCount:
 *                       type: integer
 *                     failedCount:
 *                       type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     passed:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     flaky:
 *                       type: integer
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Run not found
 *       500:
 *         description: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get run
    const run = await db.query.testRuns.findFirst({
      where: eq(testRuns.id, id),
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Get results with test info
    const results = await db
      .select({
        result: testResults,
        test: tests,
      })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .where(eq(testResults.testRunId, id))
      .orderBy(desc(testResults.startedAt));

    // Group by outcome for summary
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.result.outcome === "expected").length,
      failed: results.filter((r) => r.result.outcome === "unexpected").length,
      skipped: results.filter((r) => r.result.outcome === "skipped").length,
      flaky: results.filter((r) => r.result.outcome === "flaky").length,
    };

    return NextResponse.json({
      run,
      summary,
      results: results.map((r) => ({
        ...r.result,
        test: {
          id: r.test.id,
          filePath: r.test.filePath,
          testTitle: r.test.testTitle,
          projectName: r.test.projectName,
          tags: r.test.tags,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching run:", error);
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
