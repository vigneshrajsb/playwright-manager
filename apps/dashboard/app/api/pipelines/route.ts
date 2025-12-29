import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns, testResults, tests } from "@/lib/db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import {
  buildPipelineConditions,
  combineConditions,
} from "@/lib/filters/build-conditions";
import { logger } from "@/lib/logger";

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
