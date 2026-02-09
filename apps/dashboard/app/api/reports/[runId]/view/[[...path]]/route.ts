import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getReportAsset, isS3Configured } from "@/lib/s3";
import { logger } from "@/lib/logger";
import { parseId } from "@/lib/validation/id";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; path?: string[] }> },
) {
  try {
    const { runId: runIdStr, path: pathSegments } = await params;

    const runId = parseId(runIdStr);
    if (runId === null) {
      return NextResponse.json(
        { error: "Invalid run ID format" },
        { status: 400 },
      );
    }

    if (!isS3Configured()) {
      return NextResponse.json(
        { error: "Report storage not configured" },
        { status: 503 },
      );
    }

    const run = await db.query.testRuns.findFirst({
      where: eq(testRuns.id, runId),
    });

    if (!run?.reportPath) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 },
      );
    }

    const assetPath = pathSegments?.length
      ? pathSegments.join("/")
      : "index.html";

    if (assetPath.includes("..") || assetPath.startsWith("/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const asset = await getReportAsset(run.reportPath, assetPath);

    if (!asset) {
      return new NextResponse("Not found", { status: 404 });
    }

    const headers: HeadersInit = {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    };

    if (asset.contentLength !== undefined) {
      headers["Content-Length"] = String(asset.contentLength);
    }

    return new NextResponse(asset.body, { status: 200, headers });
  } catch (error) {
    logger.error({ err: error }, "Failed to proxy report asset");
    return NextResponse.json(
      { error: "Failed to fetch report asset" },
      { status: 500 },
    );
  }
}
