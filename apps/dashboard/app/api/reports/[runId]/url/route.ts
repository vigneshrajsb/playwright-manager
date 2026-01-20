import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getReportPresignedUrl, isS3Configured } from "@/lib/s3";
import { logger } from "@/lib/logger";

/**
 * @swagger
 * /api/reports/{runId}/url:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Get presigned URL for HTML report
 *     description: Generates a temporary presigned URL to access the Playwright HTML report for a test run. URL is valid for 1 hour.
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *         description: Test run ID (UUID)
 *     responses:
 *       200:
 *         description: Presigned URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: Presigned URL valid for 1 hour
 *       404:
 *         description: Run not found or no report available
 *       503:
 *         description: S3 storage not configured
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    // Check if S3 is configured
    if (!isS3Configured()) {
      return NextResponse.json(
        { error: "Report storage not configured" },
        { status: 503 }
      );
    }

    // Get the test run
    const run = await db.query.testRuns.findFirst({
      where: eq(testRuns.id, runId),
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (!run.reportPath) {
      return NextResponse.json(
        { error: "No report available for this run" },
        { status: 404 }
      );
    }

    // Generate presigned URL (valid for 1 hour)
    const url = await getReportPresignedUrl(run.reportPath);

    if (!url) {
      return NextResponse.json(
        { error: "Failed to generate report URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    logger.error({ err: error }, "Failed to generate report URL");
    return NextResponse.json(
      { error: "Failed to generate report URL" },
      { status: 500 }
    );
  }
}
