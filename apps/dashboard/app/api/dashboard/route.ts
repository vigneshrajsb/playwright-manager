import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testRuns, testHealth } from "@/lib/db/schema";
import { eq, desc, sql, gte } from "drizzle-orm";

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get dashboard overview data
 *     description: Returns aggregated statistics, health metrics, recent runs, and trend data for the dashboard
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to include in the analysis
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
 *                       type: number
 *                     healthDistribution:
 *                       type: object
 *                 recentRuns:
 *                   type: array
 *                   items:
 *                     type: object
 *                 passRateTimeline:
 *                   type: array
 *                   items:
 *                     type: object
 *                 flakyTests:
 *                   type: array
 *                   items:
 *                     type: object
 *                 failingTests:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "7");

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Overall test stats
    const testStats = await db
      .select({
        totalTests: sql<number>`count(*)`,
        enabledTests: sql<number>`count(*) filter (where ${tests.isEnabled} = true)`,
        disabledTests: sql<number>`count(*) filter (where ${tests.isEnabled} = false)`,
      })
      .from(tests);

    // Health distribution
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
      .groupBy(sql`1`);

    // Recent runs
    const recentRuns = await db
      .select()
      .from(testRuns)
      .where(gte(testRuns.startedAt, since))
      .orderBy(desc(testRuns.startedAt))
      .limit(10);

    // Pass rate over time (by day)
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

    // Top flaky tests
    const flakyTests = await db
      .select({
        test: tests,
        health: testHealth,
      })
      .from(tests)
      .innerJoin(testHealth, eq(tests.id, testHealth.testId))
      .orderBy(desc(testHealth.flakinessRate))
      .limit(10);

    // Top failing tests
    const failingTests = await db
      .select({
        test: tests,
        health: testHealth,
      })
      .from(tests)
      .innerJoin(testHealth, eq(tests.id, testHealth.testId))
      .orderBy(testHealth.healthScore)
      .limit(10);

    // Calculate overall health score
    const avgHealthResult = await db
      .select({
        avgHealth: sql<number>`round(avg(${testHealth.healthScore}))`,
      })
      .from(testHealth);

    return NextResponse.json({
      overview: {
        totalTests: Number(testStats[0].totalTests),
        enabledTests: Number(testStats[0].enabledTests),
        disabledTests: Number(testStats[0].disabledTests),
        avgHealthScore: Number(avgHealthResult[0].avgHealth) || 0,
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
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
