import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testHealth } from "@/lib/db/schema";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import {
  buildTestConditions,
  buildHealthConditions,
  needsHealthInnerJoin,
  combineConditions,
} from "@/lib/filters/build-conditions";
import { logger } from "@/lib/logger";

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
 *         name: repository
 *         schema:
 *           type: string
 *         description: Filter by repository (e.g., "org/repo")
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project name
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated, e.g., "@smoke,@regression")
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
 *                     repositories:
 *                       type: array
 *                       items:
 *                         type: string
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: string
 *                     tags:
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
  const repository = searchParams.get("repository");
  const project = searchParams.get("project");
  const tags = searchParams.get("tags"); // comma-separated: "@smoke,@regression"
  const status = searchParams.get("status"); // enabled, disabled
  const health = searchParams.get("health"); // healthy, flaky, failing
  const sortBy = searchParams.get("sortBy") || "lastSeenAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    // Build filter conditions using shared utilities
    const testConditions = buildTestConditions({
      search,
      repository,
      project,
      tags,
      status,
      excludeDeleted: true,
    });

    const healthConditions = buildHealthConditions(health);
    const allConditions = [...testConditions, ...healthConditions];

    // For health filters, we need an inner join to ensure we only get tests with health data
    const needsHealthJoin = needsHealthInnerJoin(health);

    const whereClause = combineConditions(allConditions);

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

    // Build the query with appropriate join type
    const baseQuery = db
      .select({
        test: tests,
        health: testHealth,
      })
      .from(tests)
      .$dynamic();

    const query = needsHealthJoin
      ? baseQuery.innerJoin(testHealth, eq(tests.id, testHealth.testId))
      : baseQuery.leftJoin(testHealth, eq(tests.id, testHealth.testId));

    const result = await query
      .where(whereClause)
      .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get total count with same filters
    const baseCountQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(tests)
      .$dynamic();

    const countQuery = needsHealthJoin
      ? baseCountQuery.innerJoin(testHealth, eq(tests.id, testHealth.testId))
      : baseCountQuery;

    const countResult = await countQuery.where(whereClause);
    const total = Number(countResult[0].count);

    // Get unique repositories for filter dropdown (excluding deleted tests)
    const repositories = await db
      .selectDistinct({ repository: tests.repository })
      .from(tests)
      .where(eq(tests.isDeleted, false));

    // Get unique projects for filter dropdown (excluding deleted tests)
    const projects = await db
      .selectDistinct({ projectName: tests.projectName })
      .from(tests)
      .where(eq(tests.isDeleted, false));

    // Get unique tags for filter dropdown (excluding deleted tests)
    const tagsResult = await db
      .select({ tags: tests.tags })
      .from(tests)
      .where(and(
        eq(tests.isDeleted, false),
        sql`${tests.tags} IS NOT NULL AND array_length(${tests.tags}, 1) > 0`
      ));

    // Flatten and dedupe tags
    const allTags = new Set<string>();
    for (const row of tagsResult) {
      if (row.tags) {
        for (const t of row.tags) {
          allTags.add(t);
        }
      }
    }

    return NextResponse.json({
      tests: result.map((r) => ({
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
        repositories: repositories.map((r) => r.repository),
        projects: projects.map((p) => p.projectName),
        tags: Array.from(allTags).sort(),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch tests");
    return NextResponse.json(
      { error: "Failed to fetch tests" },
      { status: 500 }
    );
  }
}
