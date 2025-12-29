import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testRuns, testHealth, testResults } from "@/lib/db/schema";
import { eq, and, desc, sql, gte, SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

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
    const testConditions: SQL<unknown>[] = [];
    if (repository) {
      testConditions.push(eq(tests.repository, repository));
    }
    if (project) {
      testConditions.push(eq(tests.projectName, project));
    }
    if (tags) {
      const tagList = tags.split(",").filter(Boolean);
      if (tagList.length > 0) {
        const tagArrayLiteral = tagList.map(t => `'${t.replace(/'/g, "''")}'`).join(",");
        testConditions.push(sql`${tests.tags} && ARRAY[${sql.raw(tagArrayLiteral)}]::text[]`);
      }
    }
    const testWhereClause = testConditions.length > 0 ? and(...testConditions) : undefined;

    // Overall test stats (filtered)
    const testStatsQuery = testConditions.length > 0
      ? db
          .select({
            totalTests: sql<number>`count(*)`,
            enabledTests: sql<number>`count(*) filter (where ${tests.isEnabled} = true)`,
            disabledTests: sql<number>`count(*) filter (where ${tests.isEnabled} = false)`,
          })
          .from(tests)
          .where(testWhereClause)
      : db
          .select({
            totalTests: sql<number>`count(*)`,
            enabledTests: sql<number>`count(*) filter (where ${tests.isEnabled} = true)`,
            disabledTests: sql<number>`count(*) filter (where ${tests.isEnabled} = false)`,
          })
          .from(tests);

    const testStats = await testStatsQuery;

    // Health distribution (filtered)
    const healthDistributionQuery = db
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
      .$dynamic();

    const healthDistribution = await healthDistributionQuery
      .where(testWhereClause)
      .groupBy(sql`1`);

    // Get test IDs that match the filter for run filtering
    let filteredTestIds: string[] = [];
    if (testConditions.length > 0) {
      const filteredTests = await db
        .select({ id: tests.id })
        .from(tests)
        .where(testWhereClause);
      filteredTestIds = filteredTests.map(t => t.id);
    }

    // Get run IDs that have results from filtered tests
    let filteredRunIds: string[] = [];
    if (filteredTestIds.length > 0) {
      const runsWithFilteredTests = await db
        .selectDistinct({ runId: testResults.testRunId })
        .from(testResults)
        .where(sql`${testResults.testId} = ANY(ARRAY[${sql.raw(filteredTestIds.map(id => `'${id}'`).join(","))}]::uuid[])`);
      filteredRunIds = runsWithFilteredTests.map(r => r.runId);
    }

    // Recent runs (filtered by related tests if filters applied)
    let recentRunsQuery = db
      .select()
      .from(testRuns)
      .where(gte(testRuns.startedAt, since))
      .orderBy(desc(testRuns.startedAt))
      .limit(10);

    let recentRuns = await recentRunsQuery;

    // Filter runs in memory if we have test filters
    if (filteredRunIds.length > 0) {
      recentRuns = recentRuns.filter(run => filteredRunIds.includes(run.id));
    }

    // Pass rate over time (filtered)
    let passRateTimelineQuery = db
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

    const passRateTimeline = await passRateTimelineQuery;

    // Top flaky tests (filtered) - only show tests with flakinessRate > 0
    const flakyConditionsForList = [
      sql`CAST(${testHealth.flakinessRate} AS numeric) > 0`,
    ];
    if (testConditions.length > 0) {
      flakyConditionsForList.push(...testConditions);
    }

    const flakyTests = await db
      .select({
        test: tests,
        health: testHealth,
      })
      .from(tests)
      .innerJoin(testHealth, eq(tests.id, testHealth.testId))
      .where(and(...flakyConditionsForList))
      .orderBy(desc(testHealth.flakinessRate))
      .limit(5);

    // Top failing tests (filtered) - only show tests with healthScore < 50 (critical)
    const failingConditionsForList = [
      sql`${testHealth.healthScore} < 50`,
    ];
    if (testConditions.length > 0) {
      failingConditionsForList.push(...testConditions);
    }

    const failingTests = await db
      .select({
        test: tests,
        health: testHealth,
      })
      .from(tests)
      .innerJoin(testHealth, eq(tests.id, testHealth.testId))
      .where(and(...failingConditionsForList))
      .orderBy(testHealth.healthScore)
      .limit(5);

    // Calculate overall health score (filtered)
    const avgHealthQuery = db
      .select({
        avgHealth: sql<number>`round(avg(${testHealth.healthScore}))`,
      })
      .from(testHealth)
      .innerJoin(tests, eq(testHealth.testId, tests.id))
      .$dynamic();

    const avgHealthResult = await avgHealthQuery.where(testWhereClause);

    // Calculate overall pass rate
    const totalPassed = recentRuns.reduce((acc, run) => acc + run.passedCount, 0);
    const totalTests = recentRuns.reduce((acc, run) => acc + run.totalTests, 0);
    const overallPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    // Count flaky tests
    const flakyConditions = [sql`CAST(${testHealth.flakinessRate} AS numeric) > 10`];
    if (testConditions.length > 0) {
      flakyConditions.push(...testConditions);
    }

    const flakyCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(testHealth)
      .innerJoin(tests, eq(testHealth.testId, tests.id))
      .where(and(...flakyConditions));

    // Get filter options
    const repositories = await db
      .selectDistinct({ repository: tests.repository })
      .from(tests);

    const projects = await db
      .selectDistinct({ projectName: tests.projectName })
      .from(tests);

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

    return NextResponse.json({
      overview: {
        totalTests: Number(testStats[0].totalTests),
        enabledTests: Number(testStats[0].enabledTests),
        disabledTests: Number(testStats[0].disabledTests),
        avgHealthScore: Number(avgHealthResult[0].avgHealth) || 0,
        overallPassRate,
        flakyCount: Number(flakyCountResult[0].count),
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
      flakyTests: flakyTests.map((t) => ({
        ...t.test,
        health: t.health,
      })),
      failingTests: failingTests.map((t) => ({
        ...t.test,
        health: t.health,
      })),
      filters: {
        repositories: repositories.map((r) => r.repository),
        projects: projects.map((p) => p.projectName),
        tags: Array.from(allTags).sort(),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch dashboard data");
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
