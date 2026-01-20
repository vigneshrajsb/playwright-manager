import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testResults, tests, testRuns } from "@/lib/db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import {
  buildResultConditions,
  combineConditions,
} from "@/lib/filters/build-conditions";
import { logger } from "@/lib/logger";

// Maximum number of results to return (with or without filters)
const MAX_RESULTS = 2000;

/**
 * @swagger
 * /api/results:
 *   get:
 *     tags:
 *       - Results
 *     summary: List test results
 *     description: Returns a paginated list of individual test execution results with filtering and sorting options
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
 *         description: Number of results per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by test title, file path, or base URL
 *       - in: query
 *         name: repository
 *         schema:
 *           type: string
 *         description: Filter by repository (e.g., "org/repo")
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by Playwright project name
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated, e.g., "@smoke,@regression")
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [passed, failed, timedOut, skipped, interrupted]
 *         description: Filter by test status
 *       - in: query
 *         name: outcome
 *         schema:
 *           type: string
 *           enum: [expected, unexpected, flaky, skipped]
 *         description: Filter by test outcome
 *       - in: query
 *         name: testRunId
 *         schema:
 *           type: string
 *         description: Filter by specific test run ID (UUID)
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
 *         description: List of results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       status:
 *                         type: string
 *                       outcome:
 *                         type: string
 *                       durationMs:
 *                         type: integer
 *                       errorMessage:
 *                         type: string
 *                         nullable: true
 *                       test:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           testTitle:
 *                             type: string
 *                           filePath:
 *                             type: string
 *                           projectName:
 *                             type: string
 *                           repository:
 *                             type: string
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                       run:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           branch:
 *                             type: string
 *                           commitSha:
 *                             type: string
 *                           status:
 *                             type: string
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
 *                     statuses:
 *                       type: array
 *                       items:
 *                         type: string
 *                     outcomes:
 *                       type: array
 *                       items:
 *                         type: string
 *                 runInfo:
 *                   type: object
 *                   nullable: true
 *                   description: Run details when filtering by testRunId
 *                   properties:
 *                     id:
 *                       type: string
 *                     branch:
 *                       type: string
 *                     status:
 *                       type: string
 *       500:
 *         description: Server error
 */
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
  const testRunId = searchParams.get("testRunId");
  const testId = searchParams.get("testId");
  const sortBy = searchParams.get("sortBy") || "startedAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    const offset = (page - 1) * limit;

    // Don't allow fetching beyond MAX_RESULTS
    if (offset >= MAX_RESULTS) {
      return NextResponse.json({
        results: [],
        pagination: {
          page,
          limit,
          total: MAX_RESULTS,
          totalPages: Math.ceil(MAX_RESULTS / limit),
        },
        filters: await getFilterOptions(),
        runInfo: null,
        testInfo: null,
      });
    }

    // Adjust limit if it would exceed MAX_RESULTS
    const effectiveLimit = Math.min(limit, MAX_RESULTS - offset);

    // Build filter conditions using shared utilities
    const conditions = buildResultConditions({
      search,
      repository,
      project,
      tags,
      status,
      outcome,
      testRunId,
      testId,
    });

    const whereClause = combineConditions(conditions);

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
          playwrightTestId: tests.playwrightTestId,
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
          reportPath: testRuns.reportPath,
        },
      })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(whereClause)
      .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(effectiveLimit)
      .offset(offset);

    // Get total count (capped at MAX_RESULTS)
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(whereClause);
    const rawTotal = Number(countResult[0].count);
    const total = Math.min(rawTotal, MAX_RESULTS);

    // Get filter options
    const filters = await getFilterOptions();

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

    let testInfo = null;
    if (testId) {
      const test = await db.query.tests.findFirst({
        where: eq(tests.id, testId),
      });
      if (test) {
        testInfo = {
          id: test.id,
          testTitle: test.testTitle,
          filePath: test.filePath,
          projectName: test.projectName,
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
      testInfo,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch results");
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
