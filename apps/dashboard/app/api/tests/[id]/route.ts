import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testHealth, testResults, testRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * @swagger
 * /api/tests/{id}:
 *   get:
 *     tags:
 *       - Tests
 *     summary: Get test details
 *     description: Returns detailed information about a specific test including health metrics and recent results
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Test ID (UUID)
 *     responses:
 *       200:
 *         description: Test details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 test:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     playwrightTestId:
 *                       type: string
 *                     filePath:
 *                       type: string
 *                     testTitle:
 *                       type: string
 *                     projectName:
 *                       type: string
 *                     isEnabled:
 *                       type: boolean
 *                     health:
 *                       type: object
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Test not found
 *       500:
 *         description: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get test with health
    const test = await db.query.tests.findFirst({
      where: eq(tests.id, id),
      with: {
        health: true,
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Get recent results with run info
    const recentResults = await db
      .select({
        result: testResults,
        run: testRuns,
      })
      .from(testResults)
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(eq(testResults.testId, id))
      .orderBy(desc(testResults.startedAt))
      .limit(50);

    return NextResponse.json({
      test,
      results: recentResults.map((r) => ({
        ...r.result,
        run: {
          id: r.run.id,
          runId: r.run.runId,
          branch: r.run.branch,
          commitSha: r.run.commitSha,
          status: r.run.status,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching test:", error);
    return NextResponse.json(
      { error: "Failed to fetch test" },
      { status: 500 }
    );
  }
}
