import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testRuns, testResults, testHealth } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * @swagger
 * /api/reports:
 *   post:
 *     tags:
 *       - Reports
 *     summary: Ingest test report
 *     description: Receives test results from the Playwright reporter and stores them in the database. Updates test health metrics automatically.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - runId
 *               - startTime
 *               - results
 *             properties:
 *               runId:
 *                 type: string
 *                 description: Unique identifier for the test run
 *               metadata:
 *                 type: object
 *                 properties:
 *                   branch:
 *                     type: string
 *                   commitSha:
 *                     type: string
 *                   commitMessage:
 *                     type: string
 *                   ciJobUrl:
 *                     type: string
 *                   playwrightVersion:
 *                     type: string
 *                   workers:
 *                     type: integer
 *                   shard:
 *                     type: object
 *                     properties:
 *                       current:
 *                         type: integer
 *                       total:
 *                         type: integer
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [running, passed, failed, interrupted]
 *               results:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     testId:
 *                       type: string
 *                     filePath:
 *                       type: string
 *                     title:
 *                       type: string
 *                     projectName:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [passed, failed, timedOut, skipped, interrupted]
 *                     outcome:
 *                       type: string
 *                       enum: [expected, unexpected, skipped, flaky]
 *                     duration:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Report processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 runId:
 *                   type: string
 *       500:
 *         description: Server error
 */

// Schema for incoming test result
interface TestResultPayload {
  testId: string;
  filePath: string;
  title: string;
  titlePath: string[];
  projectName: string;
  tags?: string[];
  location: {
    file: string;
    line: number;
    column: number;
  };
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  expectedStatus: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration: number;
  retry: number;
  workerIndex: number;
  parallelIndex: number;
  outcome: "expected" | "unexpected" | "skipped" | "flaky";
  error?: {
    message?: string;
    stack?: string;
    snippet?: string;
  };
  annotations?: Array<{ type: string; description?: string }>;
  attachments?: Array<{ name: string; contentType: string; path?: string }>;
  startTime: string;
  skippedByDashboard?: boolean;
}

interface ReportPayload {
  runId: string;
  metadata?: {
    branch?: string;
    commitSha?: string;
    commitMessage?: string;
    ciJobUrl?: string;
    playwrightVersion?: string;
    workers?: number;
    shard?: {
      current: number;
      total: number;
    };
  };
  startTime: string;
  endTime?: string;
  status?: "running" | "passed" | "failed" | "interrupted";
  results: TestResultPayload[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportPayload = await request.json();

    const result = await db.transaction(async (tx) => {
      // 1. Upsert the test run
      const existingRun = await tx.query.testRuns.findFirst({
        where: eq(testRuns.runId, body.runId),
      });

      let testRun;
      if (existingRun) {
        // Update existing run
        const [updated] = await tx
          .update(testRuns)
          .set({
            finishedAt: body.endTime ? new Date(body.endTime) : null,
            status: body.status || existingRun.status,
            totalTests: body.results.length,
            durationMs: body.endTime
              ? new Date(body.endTime).getTime() -
                new Date(body.startTime).getTime()
              : null,
          })
          .where(eq(testRuns.runId, body.runId))
          .returning();
        testRun = updated;
      } else {
        // Create new run
        const [created] = await tx
          .insert(testRuns)
          .values({
            runId: body.runId,
            branch: body.metadata?.branch,
            commitSha: body.metadata?.commitSha,
            commitMessage: body.metadata?.commitMessage,
            ciJobUrl: body.metadata?.ciJobUrl,
            playwrightVersion: body.metadata?.playwrightVersion,
            totalWorkers: body.metadata?.workers,
            shardCurrent: body.metadata?.shard?.current,
            shardTotal: body.metadata?.shard?.total,
            startedAt: new Date(body.startTime),
            finishedAt: body.endTime ? new Date(body.endTime) : null,
            status: body.status || "running",
            totalTests: body.results.length,
          })
          .returning();
        testRun = created;
      }

      // 2. Process each test result
      let passedCount = 0,
        failedCount = 0,
        skippedCount = 0,
        flakyCount = 0;

      for (const testResult of body.results) {
        // Upsert test
        const existingTest = await tx.query.tests.findFirst({
          where: and(
            eq(tests.filePath, testResult.filePath),
            eq(tests.testTitle, testResult.title),
            eq(tests.projectName, testResult.projectName)
          ),
        });

        let test;
        if (existingTest) {
          const [updated] = await tx
            .update(tests)
            .set({
              playwrightTestId: testResult.testId,
              tags: testResult.tags || [],
              locationLine: testResult.location.line,
              locationColumn: testResult.location.column,
              lastSeenAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(tests.id, existingTest.id))
            .returning();
          test = updated;
        } else {
          const [created] = await tx
            .insert(tests)
            .values({
              playwrightTestId: testResult.testId,
              filePath: testResult.filePath,
              testTitle: testResult.title,
              projectName: testResult.projectName,
              tags: testResult.tags || [],
              locationLine: testResult.location.line,
              locationColumn: testResult.location.column,
            })
            .returning();
          test = created;
        }

        // Insert test result
        await tx.insert(testResults).values({
          testId: test.id,
          testRunId: testRun.id,
          status: testResult.status,
          expectedStatus: testResult.expectedStatus,
          durationMs: testResult.duration,
          retryCount: testResult.retry,
          workerIndex: testResult.workerIndex,
          parallelIndex: testResult.parallelIndex,
          errorMessage: testResult.error?.message || null,
          errorStack: testResult.error?.stack || null,
          errorSnippet: testResult.error?.snippet || null,
          outcome: testResult.outcome,
          attachments: testResult.attachments || [],
          annotations: testResult.annotations || [],
          skippedByDashboard: testResult.skippedByDashboard || false,
          startedAt: new Date(testResult.startTime),
        });

        // Update counts
        switch (testResult.outcome) {
          case "expected":
            passedCount++;
            break;
          case "unexpected":
            failedCount++;
            break;
          case "skipped":
            skippedCount++;
            break;
          case "flaky":
            flakyCount++;
            break;
        }

        // Update test health
        await updateTestHealth(tx, test.id);
      }

      // Update run stats
      await tx
        .update(testRuns)
        .set({
          passedCount,
          failedCount,
          skippedCount,
          flakyCount,
        })
        .where(eq(testRuns.id, testRun.id));

      return testRun;
    });

    return NextResponse.json({ success: true, runId: result.id });
  } catch (error) {
    console.error("Error processing report:", error);
    return NextResponse.json(
      { error: "Failed to process report" },
      { status: 500 }
    );
  }
}

async function updateTestHealth(tx: any, testId: string) {
  // Get last 50 results for this test
  const recentResults = await tx.query.testResults.findMany({
    where: eq(testResults.testId, testId),
    orderBy: (results: any, { desc }: any) => [desc(results.startedAt)],
    limit: 50,
  });

  if (recentResults.length === 0) return;

  const stats = recentResults.reduce(
    (acc: any, r: any) => {
      acc.total++;
      if (r.outcome === "expected") acc.passed++;
      if (r.outcome === "unexpected") acc.failed++;
      if (r.outcome === "skipped") acc.skipped++;
      if (r.outcome === "flaky") acc.flaky++;
      acc.totalDuration += r.durationMs;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0, totalDuration: 0 }
  );

  const passRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
  const flakinessRate = stats.total > 0 ? (stats.flaky / stats.total) * 100 : 0;
  const healthScore = Math.max(0, Math.round(passRate - flakinessRate * 2));

  // Calculate consecutive passes/failures
  let consecutivePasses = 0,
    consecutiveFailures = 0;
  for (const r of recentResults) {
    if (r.outcome === "expected") {
      if (consecutiveFailures === 0) consecutivePasses++;
      else break;
    } else if (r.outcome === "unexpected") {
      if (consecutivePasses === 0) consecutiveFailures++;
      else break;
    }
  }

  // Determine trend
  let trend = "stable";
  if (healthScore < 50) trend = "critical";
  else if (consecutiveFailures >= 3) trend = "degrading";
  else if (consecutivePasses >= 5 && healthScore > 80) trend = "improving";

  const existingHealth = await tx.query.testHealth.findFirst({
    where: eq(testHealth.testId, testId),
  });

  const healthData = {
    totalRuns: stats.total,
    passedCount: stats.passed,
    failedCount: stats.failed,
    skippedCount: stats.skipped,
    flakyCount: stats.flaky,
    passRate: passRate.toFixed(2),
    flakinessRate: flakinessRate.toFixed(2),
    avgDurationMs: Math.round(stats.totalDuration / stats.total),
    healthScore,
    trend,
    consecutivePasses,
    consecutiveFailures,
    lastStatus: recentResults[0].status,
    lastRunAt: recentResults[0].startedAt,
    lastPassedAt:
      recentResults.find((r: any) => r.outcome === "expected")?.startedAt ||
      null,
    lastFailedAt:
      recentResults.find((r: any) => r.outcome === "unexpected")?.startedAt ||
      null,
    updatedAt: new Date(),
  };

  if (existingHealth) {
    await tx
      .update(testHealth)
      .set(healthData)
      .where(eq(testHealth.testId, testId));
  } else {
    await tx.insert(testHealth).values({
      testId,
      ...healthData,
    });
  }
}
