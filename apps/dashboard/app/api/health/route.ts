import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server including database connectivity
 *     responses:
 *       200:
 *         description: Server is healthy
 *       503:
 *         description: Server is degraded (database or storage unreachable)
 */
export async function GET() {
  const health: {
    status: "ok" | "degraded";
    db: string;
    s3: string;
  } = {
    status: "ok",
    db: "connected",
    s3: process.env.S3_BUCKET ? "configured" : "not_configured",
  };

  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    health.status = "degraded";
    health.db = `error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  if (process.env.S3_BUCKET) {
    try {
      const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: process.env.S3_REGION || "us-east-1",
        ...(process.env.S3_ENDPOINT && {
          endpoint: process.env.S3_ENDPOINT,
          forcePathStyle: true,
        }),
        ...(process.env.S3_ACCESS_KEY_ID &&
          process.env.S3_SECRET_ACCESS_KEY && {
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            },
          }),
      });
      await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
      health.s3 = "connected";
    } catch (err) {
      health.status = "degraded";
      health.s3 = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
