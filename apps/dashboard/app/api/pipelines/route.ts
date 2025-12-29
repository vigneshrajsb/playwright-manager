import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns, testResults, tests } from "@/lib/db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import {
  buildPipelineConditions,
  combineConditions,
} from "@/lib/filters/build-conditions";
import { logger } from "@/lib/logger";

/**
 * @swagger
 * /api/pipelines:
 *   get:
 *     tags:
 *       - Pipelines
 *     summary: List pipelines
 *     description: Returns a paginated list of test pipelines (CI runs) with filtering and sorting options
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
 *         description: Number of pipelines per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by branch, commit message, or base URL
 *       - in: query
 *         name: repository
 *         schema:
 *           type: string
 *         description: Filter by repository (e.g., "org/repo")
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter runs starting from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter runs ending before this date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [startedAt, duration]
 *           default: startedAt
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
 *         description: List of pipelines retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pipelines:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       runId:
 *                         type: string
 *                       branch:
 *                         type: string
 *                       commitSha:
 *                         type: string
 *                       status:
 *                         type: string
 *                       totalTests:
 *                         type: integer
 *                       passedCount:
 *                         type: integer
 *                       failedCount:
 *                         type: integer
 *                       repository:
 *                         type: string
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
 *                     repositories:
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
  const search = searchParams.get("search");
  const repository = searchParams.get("repository");
  const branch = searchParams.get("branch");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const sortBy = searchParams.get("sortBy") || "startedAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    const offset = (page - 1) * limit;

    // Build filter conditions using shared utilities
    const conditions = buildPipelineConditions({
      search,
      branch,
      status,
      startDate,
      endDate,
    });

    // Get sort column
    const sortColumn =
      sortBy === "duration"
        ? testRuns.durationMs
        : testRuns.startedAt;

    let whereClause = combineConditions(conditions);

    // If repository filter is set, we need to filter runs that have results from tests in that repo
    if (repository) {
      // Get runs that have at least one result from a test in this repository
      const runsWithRepo = await db
        .selectDistinct({ runId: testResults.testRunId })
        .from(testResults)
        .innerJoin(tests, eq(testResults.testId, tests.id))
        .where(eq(tests.repository, repository));

      const runIds = runsWithRepo.map((r) => r.runId);

      if (runIds.length === 0) {
        return NextResponse.json({
          pipelines: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          filters: await getFilterOptions(),
        });
      }

      // Add run ID filter using parameterized query (safe from SQL injection)
      const runIdParams = runIds.map((id) => sql`${id}`);
      conditions.push(sql`${testRuns.id} = ANY(ARRAY[${sql.join(runIdParams, sql`, `)}]::uuid[])`);
    }

    const updatedWhereClause = combineConditions(conditions);

    // Query pipelines with repository in a single query (fixes N+1 pattern)
    // Using a subquery to get the first repository for each run
    const pipelinesWithRepo = await db
      .select({
        pipeline: testRuns,
        repository: sql<string | null>`(
          SELECT DISTINCT t.repository
          FROM test_results tr
          INNER JOIN tests t ON tr.test_id = t.id
          WHERE tr.test_run_id = test_runs.id
          LIMIT 1
        )`.as("repository"),
      })
      .from(testRuns)
      .where(updatedWhereClause)
      .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(testRuns)
      .where(updatedWhereClause);
    const total = Number(countResult[0].count);

    // Get filter options
    const filters = await getFilterOptions();

    // Format response to match expected structure
    const formattedPipelines = pipelinesWithRepo.map((row) => ({
      ...row.pipeline,
      repository: row.repository,
    }));

    return NextResponse.json({
      pipelines: formattedPipelines,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch pipelines");
    return NextResponse.json(
      { error: "Failed to fetch pipelines" },
      { status: 500 }
    );
  }
}

async function getFilterOptions() {
  // Get unique branches
  const branches = await db
    .selectDistinct({ branch: testRuns.branch })
    .from(testRuns);

  // Get unique repositories from tests
  const repositories = await db
    .selectDistinct({ repository: tests.repository })
    .from(tests);

  return {
    branches: branches.map((b) => b.branch).filter(Boolean) as string[],
    repositories: repositories.map((r) => r.repository),
    statuses: ["running", "passed", "failed", "interrupted"],
  };
}
