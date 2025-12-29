import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testResults, tests, testRuns } from "@/lib/db/schema";
import { eq, ilike, and, or, desc, asc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search");
  const repository = searchParams.get("repository");
  const project = searchParams.get("project");
  const tags = searchParams.get("tags"); // comma-separated
  const status = searchParams.get("status"); // passed, failed, timedOut, skipped
  const outcome = searchParams.get("outcome"); // expected, unexpected, flaky, skipped
  const testRunId = searchParams.get("testRunId"); // filter by specific run
  const sortBy = searchParams.get("sortBy") || "startedAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(tests.testTitle, `%${search}%`),
          ilike(tests.filePath, `%${search}%`),
          ilike(testResults.baseUrl, `%${search}%`)
        )
      );
    }

    if (repository) {
      conditions.push(eq(tests.repository, repository));
    }

    if (project) {
      conditions.push(eq(tests.projectName, project));
    }

    if (tags) {
      const tagList = tags.split(",").filter(Boolean);
      if (tagList.length > 0) {
        const tagArrayLiteral = tagList.map(t => `'${t.replace(/'/g, "''")}'`).join(",");
        conditions.push(sql`${tests.tags} && ARRAY[${sql.raw(tagArrayLiteral)}]::text[]`);
      }
    }

    if (status) {
      conditions.push(eq(testResults.status, status));
    }

    if (outcome) {
      conditions.push(eq(testResults.outcome, outcome));
    }

    if (testRunId) {
      conditions.push(eq(testResults.testRunId, testRunId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get sort column
    const sortColumn =
      sortBy === "duration"
        ? testResults.durationMs
        : testResults.startedAt;

    // Query results with joins
    const results = await db
      .select({
        result: testResults,
        test: {
          id: tests.id,
          testTitle: tests.testTitle,
          filePath: tests.filePath,
          projectName: tests.projectName,
          repository: tests.repository,
          tags: tests.tags,
        },
        run: {
          id: testRuns.id,
          runId: testRuns.runId,
          branch: testRuns.branch,
          commitSha: testRuns.commitSha,
          status: testRuns.status,
          startedAt: testRuns.startedAt,
        },
      })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(whereClause)
      .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(whereClause);
    const total = Number(countResult[0].count);

    // Get filter options
    const filters = await getFilterOptions();

    // Get run info if filtering by testRunId
    let runInfo = null;
    if (testRunId) {
      const run = await db.query.testRuns.findFirst({
        where: eq(testRuns.id, testRunId),
      });
      if (run) {
        runInfo = {
          id: run.id,
          runId: run.runId,
          branch: run.branch,
          commitSha: run.commitSha,
          status: run.status,
          startedAt: run.startedAt,
          totalTests: run.totalTests,
          passedCount: run.passedCount,
          failedCount: run.failedCount,
        };
      }
    }

    return NextResponse.json({
      results: results.map((r) => ({
        ...r.result,
        test: r.test,
        run: r.run,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters,
      runInfo,
    });
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}

async function getFilterOptions() {
  // Get unique repositories
  const repositories = await db
    .selectDistinct({ repository: tests.repository })
    .from(tests);

  // Get unique projects
  const projects = await db
    .selectDistinct({ projectName: tests.projectName })
    .from(tests);

  // Get unique tags
  const tagsResult = await db
    .select({ tags: tests.tags })
    .from(tests)
    .where(sql`${tests.tags} IS NOT NULL AND array_length(${tests.tags}, 1) > 0`);

  const allTags = new Set<string>();
  for (const row of tagsResult) {
    if (row.tags) {
      for (const t of row.tags) {
        allTags.add(t);
      }
    }
  }

  return {
    repositories: repositories.map((r) => r.repository),
    projects: projects.map((p) => p.projectName),
    tags: Array.from(allTags).sort(),
    statuses: ["passed", "failed", "timedOut", "skipped", "interrupted"],
    outcomes: ["expected", "unexpected", "flaky", "skipped"],
  };
}
