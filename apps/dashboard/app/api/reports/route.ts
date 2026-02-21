import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testRuns, testResults, errorSignatures } from "@/lib/db/schema";
import { hashErrorSignature } from "@/lib/flakiness-analyzer";
import { updateTestHealth } from "@/lib/health/update-test-health";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

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
 *                 required:
 *                   - repository
 *                 properties:
 *                   repository:
 *                     type: string
 *                     description: Repository in "org/repo" format (required)
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
  isFinalAttempt?: boolean;
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
  baseUrl?: string;
}

interface ReportPayload {
  runId: string;
  metadata?: {
    repository: string; // Required - e.g., "org/repo"
    branch?: string;
    commitSha?: string;
    commitMessage?: string;
    ciJobUrl?: string;
    baseUrl?: string;
    playwrightVersion?: string;
    workers?: number;
    shardCurrent?: number;
    shardTotal?: number;
    reportPath?: string; // S3 path to HTML report
  };
  startTime: string;
  endTime?: string;
  status?: "running" | "passed" | "failed" | "interrupted";
  results: TestResultPayload[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportPayload = await request.json();

    // Validate repository is provided
    if (!body.metadata?.repository) {
      return NextResponse.json(
        { error: "metadata.repository is required" },
        { status: 400 }
      );
    }

    const repository = body.metadata.repository;

    const result = await db.transaction(async (tx) => {
      // 1. Upsert the test run
      const existingRun = await tx.query.testRuns.findFirst({
        where: eq(testRuns.runId, body.runId),
      });

      let testRun;
      // Count only executed final attempts for accurate test totals (exclude skipped)
      const finalAttemptCount = body.results.filter(r => (r.isFinalAttempt ?? true) && r.outcome !== "skipped").length;

      if (existingRun) {
        // Update existing run - accumulate totalTests (final attempts only)
        const [updated] = await tx
          .update(testRuns)
          .set({
            finishedAt: body.endTime ? new Date(body.endTime) : null,
            status: body.status || existingRun.status,
            totalTests: existingRun.totalTests + finalAttemptCount,
            durationMs: body.endTime
              ? new Date(body.endTime).getTime() -
                new Date(body.startTime).getTime()
              : null,
            // Only update reportPath if provided (don't overwrite existing)
            reportPath: body.metadata?.reportPath ?? existingRun.reportPath,
          })
          .where(eq(testRuns.runId, body.runId))
          .returning();
        testRun = updated;
      } else {
        // Create new run (repository is derived from tests, not stored in testRuns)
        const [created] = await tx
          .insert(testRuns)
          .values({
            runId: body.runId,
            branch: body.metadata?.branch,
            commitSha: body.metadata?.commitSha,
            commitMessage: body.metadata?.commitMessage,
            ciJobUrl: body.metadata?.ciJobUrl,
            baseUrl: body.metadata?.baseUrl,
            reportPath: body.metadata?.reportPath,
            playwrightVersion: body.metadata?.playwrightVersion,
            totalWorkers: body.metadata?.workers,
            shardCurrent: body.metadata?.shardCurrent,
            shardTotal: body.metadata?.shardTotal,
            startedAt: new Date(body.startTime),
            finishedAt: body.endTime ? new Date(body.endTime) : null,
            durationMs: body.endTime
              ? new Date(body.endTime).getTime() -
                new Date(body.startTime).getTime()
              : null,
            status: body.status || "running",
            totalTests: finalAttemptCount,
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
        // Upsert test - now includes repository in unique key
        const existingTest = await tx.query.tests.findFirst({
          where: and(
            eq(tests.repository, repository),
            eq(tests.filePath, testResult.filePath),
            eq(tests.testTitle, testResult.title),
            eq(tests.projectName, testResult.projectName)
          ),
        });

        let test;
        if (existingTest) {
          // Build update data, including restore if test was deleted
          const baseUpdateData = {
            playwrightTestId: testResult.testId,
            tags: testResult.tags || [],
            locationLine: testResult.location.line,
            locationColumn: testResult.location.column,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          };

          // Auto-restore if test was soft-deleted (it's back in the codebase)
          const updateData = existingTest.isDeleted
            ? { ...baseUpdateData, isDeleted: false, deletedAt: null, deletedReason: null }
            : baseUpdateData;

          const [updated] = await tx
            .update(tests)
            .set(updateData)
            .where(eq(tests.id, existingTest.id))
            .returning();
          test = updated;
        } else {
          const [created] = await tx
            .insert(tests)
            .values({
              playwrightTestId: testResult.testId,
              repository,
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
          isFinalAttempt: testResult.isFinalAttempt ?? true,
          workerIndex: testResult.workerIndex,
          parallelIndex: testResult.parallelIndex,
          errorMessage: testResult.error?.message || null,
          errorStack: testResult.error?.stack || null,
          errorSnippet: testResult.error?.snippet || null,
          outcome: testResult.outcome,
          attachments: testResult.attachments || [],
          annotations: testResult.annotations || [],
          skippedByDashboard: testResult.skippedByDashboard ||
            testResult.annotations?.some(
              (a) => a.type === "skip" && a.description?.startsWith("[dashboard]")
            ) || false,
          baseUrl: testResult.baseUrl || body.metadata?.baseUrl,
          startedAt: new Date(testResult.startTime),
        });

        // Track error signature for flakiness analysis
        if (testResult.error?.message && testResult.outcome === "unexpected") {
          const signatureHash = hashErrorSignature(testResult.error.message);

          const existingSig = await tx.query.errorSignatures.findFirst({
            where: and(
              eq(errorSignatures.testId, test.id),
              eq(errorSignatures.signatureHash, signatureHash)
            ),
          });

          if (existingSig) {
            await tx
              .update(errorSignatures)
              .set({
                lastSeenAt: new Date(),
                occurrenceCount: existingSig.occurrenceCount + 1,
              })
              .where(eq(errorSignatures.id, existingSig.id));
          } else {
            await tx.insert(errorSignatures).values({
              testId: test.id,
              signatureHash,
              errorMessage: testResult.error.message,
            });
          }
        }

        // Update passedAfterCount for previous error signatures when test passes
        if (testResult.outcome === "expected") {
          await tx
            .update(errorSignatures)
            .set({
              passedAfterCount: sql`${errorSignatures.passedAfterCount} + 1`,
            })
            .where(eq(errorSignatures.testId, test.id));
        }

        // Update counts - only count final attempts for accurate totals
        const isFinal = testResult.isFinalAttempt ?? true;
        if (isFinal) {
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
        }

        // Update test health
        await updateTestHealth(tx, test.id);
      }

      // Update run stats - accumulate with existing counts
      await tx
        .update(testRuns)
        .set({
          passedCount: testRun.passedCount + passedCount,
          failedCount: testRun.failedCount + failedCount,
          skippedCount: testRun.skippedCount + skippedCount,
          flakyCount: testRun.flakyCount + flakyCount,
        })
        .where(eq(testRuns.id, testRun.id));

      // Fix orphaned non-final attempts on final batch.
      // When Playwright skips retries (e.g., snapshot-writing failures),
      // the reporter marks attempt 0 as non-final but no retry ever arrives.
      // Promote the highest retry_count result to final for orphaned tests.
      const isFinalBatch = body.status && body.status !== "running";
      if (isFinalBatch) {
        const orphaned = await tx.execute<{ id: number; test_id: number; outcome: string }>(sql`
          SELECT DISTINCT ON (tr.test_id) tr.id, tr.test_id, tr.outcome
          FROM ${testResults} tr
          WHERE tr.test_run_id = ${testRun.id}
            AND tr.test_id NOT IN (
              SELECT tr2.test_id FROM ${testResults} tr2
              WHERE tr2.test_run_id = ${testRun.id} AND tr2.is_final_attempt = true
            )
          ORDER BY tr.test_id, tr.retry_count DESC
        `);

        let orphanPassed = 0, orphanFailed = 0, orphanSkipped = 0, orphanFlaky = 0;
        for (const row of orphaned) {
          await tx
            .update(testResults)
            .set({ isFinalAttempt: true })
            .where(eq(testResults.id, row.id));

          switch (row.outcome) {
            case "expected": orphanPassed++; break;
            case "unexpected": orphanFailed++; break;
            case "skipped": orphanSkipped++; break;
            case "flaky": orphanFlaky++; break;
          }

          // Recompute health now that the test has a final attempt
          await updateTestHealth(tx, row.test_id);
        }

        if (orphaned.length > 0) {
          await tx
            .update(testRuns)
            .set({
              passedCount: sql`${testRuns.passedCount} + ${orphanPassed}`,
              failedCount: sql`${testRuns.failedCount} + ${orphanFailed}`,
              skippedCount: sql`${testRuns.skippedCount} + ${orphanSkipped}`,
              flakyCount: sql`${testRuns.flakyCount} + ${orphanFlaky}`,
              totalTests: sql`${testRuns.totalTests} + ${orphanPassed + orphanFailed + orphanFlaky}`,
            })
            .where(eq(testRuns.id, testRun.id));
        }
      }

      return testRun;
    });

    return NextResponse.json({ success: true, runId: result.id });
  } catch (error) {
    logger.error({ err: error }, "Failed to process report");
    return NextResponse.json(
      { error: "Failed to process report" },
      { status: 500 }
    );
  }
}

