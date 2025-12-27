import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns } from "@/lib/db/schema";
import { eq, desc, sql, gte } from "drizzle-orm";

/**
 * @swagger
 * /api/runs:
 *   get:
 *     tags:
 *       - Runs
 *     summary: List test runs
 *     description: Returns a paginated list of test runs
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of runs per page
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter by branch name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [running, passed, failed, interrupted]
 *         description: Filter by run status
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to include
 *     responses:
 *       200:
 *         description: List of runs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 runs:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 filters:
 *                   type: object
 *                   properties:
 *                     branches:
 *                       type: array
 *                       items:
 *                         type: string
 *                     statuses:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: Server error
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const branch = searchParams.get("branch");
  const status = searchParams.get("status");
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const offset = (page - 1) * limit;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Build query
    let query = db
      .select()
      .from(testRuns)
      .where(gte(testRuns.startedAt, since))
      .orderBy(desc(testRuns.startedAt))
      .limit(limit)
      .offset(offset);

    const runs = await query;

    // Filter in application layer for simplicity
    let filteredRuns = runs;
    if (branch) {
      filteredRuns = runs.filter((r) => r.branch === branch);
    }
    if (status) {
      filteredRuns = runs.filter((r) => r.status === status);
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(testRuns)
      .where(gte(testRuns.startedAt, since));
    const total = Number(countResult[0].count);

    // Get unique branches for filter
    const branches = await db
      .selectDistinct({ branch: testRuns.branch })
      .from(testRuns)
      .where(gte(testRuns.startedAt, since));

    return NextResponse.json({
      runs: filteredRuns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        branches: branches.map((b) => b.branch).filter(Boolean),
        statuses: ["running", "passed", "failed", "interrupted"],
      },
    });
  } catch (error) {
    console.error("Error fetching runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch runs" },
      { status: 500 }
    );
  }
}
