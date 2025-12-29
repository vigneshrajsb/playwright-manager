import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns, testResults, tests } from "@/lib/db/schema";
import { eq, ilike, and, or, desc, asc, sql, gte, lte } from "drizzle-orm";

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

    // Build conditions
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(testRuns.branch, `%${search}%`),
          ilike(testRuns.commitMessage, `%${search}%`)
        )
      );
    }

    if (branch) {
      conditions.push(eq(testRuns.branch, branch));
    }

    if (status) {
      conditions.push(eq(testRuns.status, status));
    }

    if (startDate) {
      conditions.push(gte(testRuns.startedAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(testRuns.startedAt, new Date(endDate)));
    }

    // Get sort column
    const sortColumn =
      sortBy === "duration"
        ? testRuns.durationMs
        : testRuns.startedAt;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // If repository filter is set, we need to filter runs that have results from tests in that repo
    let pipelinesQuery;

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

      // Add run ID filter
      conditions.push(sql`${testRuns.id} = ANY(ARRAY[${sql.raw(runIds.map(id => `'${id}'`).join(","))}]::uuid[])`);
    }

    const updatedWhereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Query pipelines
    const pipelines = await db
      .select()
      .from(testRuns)
      .where(updatedWhereClause)
      .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get repository for each pipeline (derived from first test result)
    const pipelinesWithRepo = await Promise.all(
      pipelines.map(async (pipeline) => {
        const repoResult = await db
          .selectDistinct({ repository: tests.repository })
          .from(testResults)
          .innerJoin(tests, eq(testResults.testId, tests.id))
          .where(eq(testResults.testRunId, pipeline.id))
          .limit(1);

        return {
          ...pipeline,
          repository: repoResult[0]?.repository || null,
        };
      })
    );

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(testRuns)
      .where(updatedWhereClause);
    const total = Number(countResult[0].count);

    // Get filter options
    const filters = await getFilterOptions();

    return NextResponse.json({
      pipelines: pipelinesWithRepo,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters,
    });
  } catch (error) {
    console.error("Error fetching pipelines:", error);
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
