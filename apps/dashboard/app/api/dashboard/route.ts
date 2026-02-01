import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tests,
  testRuns,
  testHealth,
  skipRules,
} from "@/lib/db/schema";
import { eq, and, desc, sql, gte, lt, isNull, SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getFilterOptions } from "@/lib/db/filter-cache";

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get dashboard overview data
 *     description: Returns comprehensive dashboard analytics including test stats, health distribution, pass rate trends, and top flaky/failing tests
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to include in timeline data
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
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: object
 *                   properties:
 *                     totalTests:
 *                       type: integer
 *                     enabledTests:
 *                       type: integer
 *                     disabledTests:
 *                       type: integer
 *                     avgHealthScore:
 *                       type: integer
 *                     overallPassRate:
 *                       type: integer
 *                     flakyCount:
 *                       type: integer
 *                     healthDistribution:
 *                       type: object
 *                       properties:
 *                         healthy:
 *                           type: integer
 *                         warning:
 *                           type: integer
 *                         critical:
 *                           type: integer
 *                 recentRuns:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       branch:
 *                         type: string
 *                       status:
 *                         type: string
 *                       passRate:
 *                         type: integer
 *                 passRateTimeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       passRate:
 *                         type: number
 *                       totalTests:
 *                         type: integer
 *                       totalRuns:
 *                         type: integer
 *                 flakyTests:
 *                   type: array
 *                   description: Top 5 most flaky tests
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       testTitle:
 *                         type: string
 *                       health:
 *                         type: object
 *                 failingTests:
 *                   type: array
 *                   description: Top 5 most failing tests
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       testTitle:
 *                         type: string
 *                       health:
 *                         type: object
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
  const days = parseInt(searchParams.get("days") || "7");
  const repository = searchParams.get("repository");
  const project = searchParams.get("project");
  const tags = searchParams.get("tags"); // comma-separated

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Build test filter conditions
    const testConditions: SQL<unknown>[] = [eq(tests.isDeleted, false)];
    if (repository) {
      testConditions.push(eq(tests.repository, repository));
    }
    if (project) {
      testConditions.push(eq(tests.projectName, project));
    }
    if (tags) {
      const tagList = tags.split(",").filter(Boolean);
      if (tagList.length > 0) {
        const tagParams = tagList.map((t) => sql`${t}`);
        const tagArray = sql`ARRAY[${sql.join(tagParams, sql`, `)}]::text[]`;
        testConditions.push(sql`${tests.tags} && ${tagArray}`);
      }
    }
    const testWhereClause = and(...testConditions);
    const hasFilters = repository || project || tags;

    // OPTIMIZED: Overall test stats using LEFT JOIN instead of subqueries
    // This replaces the slow EXISTS/NOT EXISTS pattern
    const testStats = await db
      .select({
        totalTests: sql<number>`count(DISTINCT ${tests.id})`,
        enabledTests: sql<number>`count(DISTINCT ${tests.id}) FILTER (WHERE ${skipRules.id} IS NULL)`,
        disabledTests: sql<number>`count(DISTINCT ${tests.id}) FILTER (WHERE ${skipRules.id} IS NOT NULL)`,
      })
      .from(tests)
      .leftJoin(
        skipRules,
        and(eq(skipRules.testId, tests.id), isNull(skipRules.deletedAt))
      )
      .where(testWhereClause);

    // Health distribution (filtered)
    const healthDistribution = await db
      .select({
        bucket: sql<string>`
          case
            when ${testHealth.healthScore} >= 80 then 'healthy'
            when ${testHealth.healthScore} >= 50 then 'warning'
            else 'critical'
          end
        `,
        count: sql<number>`count(*)`,
      })
      .from(testHealth)
      .innerJoin(tests, eq(testHealth.testId, tests.id))
      .where(testWhereClause)
      .groupBy(sql`1`);

    // Get filtered test IDs for run filtering (now integers, not UUIDs)
    let filteredTestIds: number[] = [];
    if (hasFilters) {
      const filteredTests = await db
        .select({ id: tests.id })
        .from(tests)
        .where(testWhereClause);
      filteredTestIds = filteredTests.map((t) => t.id);
    }

    // OPTIMIZED: Recent runs with SQL-side filtering using EXISTS
    // This replaces the slow in-memory filtering pattern
    const recentRuns =
      filteredTestIds.length > 0
        ? await db
            .select()
            .from(testRuns)
            .where(
              and(
                gte(testRuns.startedAt, since),
                sql`EXISTS (
                  SELECT 1 FROM test_results tr
                  WHERE tr.test_run_id = ${testRuns.id}
                  AND tr.test_id = ANY(ARRAY[${sql.join(
                    filteredTestIds.map((id) => sql`${id}`),
                    sql`, `
                  )}]::integer[])
                )`
              )
            )
            .orderBy(desc(testRuns.startedAt))
            .limit(10)
        : await db
            .select()
            .from(testRuns)
            .where(gte(testRuns.startedAt, since))
            .orderBy(desc(testRuns.startedAt))
            .limit(10);

    // Pass rate over time
    const passRateTimeline = await db
      .select({
        date: sql<string>`date_trunc('day', ${testRuns.startedAt})::date::text`,
        passRate: sql<number>`
          round(
            sum(${testRuns.passedCount})::numeric /
            nullif(sum(${testRuns.totalTests}), 0) * 100,
            2
          )
        `,
        totalTests: sql<number>`sum(${testRuns.totalTests})`,
        totalRuns: sql<number>`count(*)`,
      })
      .from(testRuns)
      .where(gte(testRuns.startedAt, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    // OPTIMIZED: Top flaky tests with window function to get count in same query
    // This replaces the duplicate flaky count query pattern
    const flakyTestsWithCount = await db
      .select({
        test: tests,
        health: testHealth,
        totalFlaky: sql<number>`count(*) OVER()`.as("total_flaky"),
      })
      .from(tests)
      .innerJoin(testHealth, eq(tests.id, testHealth.testId))
      .where(
        and(
          ...testConditions,
          gte(testHealth.healthScore, 50),
          lt(testHealth.healthScore, 80)
        )
      )
      .orderBy(testHealth.healthScore) // ASC - lower score = more flaky
      .limit(5);

    const flakyCount = flakyTestsWithCount[0]?.totalFlaky ?? 0;

    // Top failing tests (healthScore < 50)
    const failingTests = await db
      .select({
        test: tests,
        health: testHealth,
      })
      .from(tests)
      .innerJoin(testHealth, eq(tests.id, testHealth.testId))
      .where(and(...testConditions, lt(testHealth.healthScore, 50)))
      .orderBy(testHealth.healthScore)
      .limit(5);

    // Calculate overall health score (filtered)
    const avgHealthResult = await db
      .select({
        avgHealth: sql<number>`round(avg(${testHealth.healthScore}))`,
      })
      .from(testHealth)
      .innerJoin(tests, eq(testHealth.testId, tests.id))
      .where(testWhereClause);

    // Calculate overall pass rate from recent runs
    const totalPassed = recentRuns.reduce(
      (acc, run) => acc + run.passedCount,
      0
    );
    const totalTestsInRuns = recentRuns.reduce(
      (acc, run) => acc + run.totalTests,
      0
    );
    const overallPassRate =
      totalTestsInRuns > 0
        ? Math.round((totalPassed / totalTestsInRuns) * 100)
        : 0;

    // OPTIMIZED: Get filter options from cache
    const filterOptions = await getFilterOptions();

    return NextResponse.json({
      overview: {
        totalTests: Number(testStats[0].totalTests),
        enabledTests: Number(testStats[0].enabledTests),
        disabledTests: Number(testStats[0].disabledTests),
        avgHealthScore: Number(avgHealthResult[0].avgHealth) || 0,
        overallPassRate,
        flakyCount: Number(flakyCount),
        healthDistribution: Object.fromEntries(
          healthDistribution.map((h) => [h.bucket, Number(h.count)])
        ),
      },
      recentRuns: recentRuns.map((run) => ({
        ...run,
        passRate:
          run.totalTests > 0
            ? Math.round((run.passedCount / run.totalTests) * 100)
            : 0,
      })),
      passRateTimeline: passRateTimeline.map((p) => ({
        date: p.date,
        passRate: Number(p.passRate) || 0,
        totalTests: Number(p.totalTests),
        totalRuns: Number(p.totalRuns),
      })),
      flakyTests: flakyTestsWithCount.map((t) => ({
        ...t.test,
        health: t.health,
      })),
      failingTests: failingTests.map((t) => ({
        ...t.test,
        health: t.health,
      })),
      filters: filterOptions,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch dashboard data");
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
