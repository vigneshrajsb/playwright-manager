import type { S3ReportConfig } from "./types";
import * as fs from "fs";
import * as path from "path";

/**
 * Get content type based on file extension
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
  };
  return types[ext] || "application/octet-stream";
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Upload Playwright HTML report directory to S3-compatible storage
 *
 * @param config - S3 configuration
 * @param repository - Repository identifier (org/repo)
 * @param runId - Test run ID
 * @param debug - Enable debug logging
 * @returns S3 path to the uploaded report
 */
export async function uploadReportDirectory(
  config: S3ReportConfig,
  repository: string,
  runId: string,
  debug: boolean = false
): Promise<string> {
  // Dynamic import to handle optional dependency
  let S3Client: typeof import("@aws-sdk/client-s3").S3Client;
  let PutObjectCommand: typeof import("@aws-sdk/client-s3").PutObjectCommand;

  try {
    const s3Module = await import("@aws-sdk/client-s3");
    S3Client = s3Module.S3Client;
    PutObjectCommand = s3Module.PutObjectCommand;
  } catch {
    throw new Error(
      "@aws-sdk/client-s3 is required for S3 report upload. " +
        "Install it with: npm install @aws-sdk/client-s3"
    );
  }

  const reportDir = config.reportDir || "playwright-report";
  const pathPrefix = config.pathPrefix || "reports";

  // Validate report directory exists
  if (!fs.existsSync(reportDir)) {
    throw new Error(
      `Report directory not found: ${reportDir}. ` +
        "Make sure the Playwright HTML reporter is enabled and has generated a report."
    );
  }

  // Build S3 path: {prefix}/{repository}/{runId}/
  const s3BasePath = `${pathPrefix}/${repository}/${runId}`;

  // Create S3 client
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined, // Falls back to default credential chain
    forcePathStyle: !!config.endpoint, // Required for MinIO/custom endpoints
  });

  // Get all files recursively
  const files = getAllFiles(reportDir);

  if (debug) {
    console.log(
      `[TestManagerReporter] Uploading ${files.length} files to s3://${config.bucket}/${s3BasePath}`
    );
  }

  // Upload all files
  for (const filePath of files) {
    const relativePath = path.relative(reportDir, filePath);
    const s3Key = `${s3BasePath}/${relativePath}`;
    const contentType = getContentType(filePath);

    const fileContent = fs.readFileSync(filePath);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
      })
    );

    if (debug) {
      console.log(`[TestManagerReporter] Uploaded: ${s3Key}`);
    }
  }

  if (debug) {
    console.log(
      `[TestManagerReporter] Report upload complete: s3://${config.bucket}/${s3BasePath}`
    );
  }

  return s3BasePath;
}
