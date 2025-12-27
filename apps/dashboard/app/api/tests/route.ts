import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testHealth } from "@/lib/db/schema";
import { eq, ilike, and, or, desc, asc, sql } from "drizzle-orm";

/**
 * @swagger
 * /api/tests:
 *   get:
 *     tags:
 *       - Tests
 *     summary: List all tests
 *     description: Returns a paginated list of tests with their health metrics
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
 *           default: 50
 *         description: Number of tests per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by test title or file path
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [enabled, disabled]
 *         description: Filter by enabled/disabled status
 *       - in: query
 *         name: health
 *         schema:
 *           type: string
 *           enum: [healthy, flaky, failing]
 *         description: Filter by health status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [lastSeenAt, healthScore, passRate, lastRunAt]
 *           default: lastSeenAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of tests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tests:
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
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: Server error
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search");
  const project = searchParams.get("project");
  const status = searchParams.get("status"); // enabled, disabled
  const health = searchParams.get("health"); // healthy, flaky, failing
  const sortBy = searchParams.get("sortBy") || "lastSeenAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    // Build filters
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(tests.testTitle, `%${search}%`),
          ilike(tests.filePath, `%${search}%`)
        )
      );
    }

    if (project) {
      conditions.push(eq(tests.projectName, project));
    }

    if (status === "enabled") {
      conditions.push(eq(tests.isEnabled, true));
    } else if (status === "disabled") {
      conditions.push(eq(tests.isEnabled, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query with join to health
    const offset = (page - 1) * limit;

    // Get sort column
    const sortColumn =
      sortBy === "healthScore"
        ? testHealth.healthScore
        : sortBy === "passRate"
          ? testHealth.passRate
          : sortBy === "lastRunAt"
            ? testHealth.lastRunAt
            : tests.lastSeenAt;

    const result = await db
      .select({
        test: tests,
        health: testHealth,
      })
      .from(tests)
      .leftJoin(testHealth, eq(tests.id, testHealth.testId))
      .where(whereClause)
      .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Filter by health in application layer
    let filteredResult = result;
    if (health === "healthy") {
      filteredResult = result.filter(
        (r) => r.health && Number(r.health.healthScore) >= 80
      );
    } else if (health === "flaky") {
      filteredResult = result.filter(
        (r) => r.health && Number(r.health.flakinessRate) > 10
      );
    } else if (health === "failing") {
      filteredResult = result.filter(
        (r) => r.health && Number(r.health.healthScore) < 50
      );
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tests)
      .where(whereClause);
    const total = Number(countResult[0].count);

    // Get unique projects for filter dropdown
    const projects = await db
      .selectDistinct({ projectName: tests.projectName })
      .from(tests);

    return NextResponse.json({
      tests: filteredResult.map((r) => ({
        ...r.test,
        health: r.health,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        projects: projects.map((p) => p.projectName),
      },
    });
  } catch (error) {
    console.error("Error fetching tests:", error);
    return NextResponse.json(
      { error: "Failed to fetch tests" },
      { status: 500 }
    );
  }
}
