import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 config from environment variables
// Note: endpoint should be undefined for AWS S3 (not empty string)
const s3Config = {
  bucket: process.env.S3_BUCKET || undefined,
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined, // undefined for AWS S3, URL for MinIO/R2
  // Public endpoint for presigned URLs (for Docker: internal endpoint vs public localhost)
  publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || undefined,
  accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
};

let s3Client: S3Client | null = null;

/**
 * Get or create S3 client instance
 * Uses public endpoint for presigned URL generation (browser access)
 */
function getS3Client(): S3Client | null {
  if (!s3Config.bucket) {
    return null;
  }

  if (!s3Client) {
    // Use public endpoint for presigned URLs so they're accessible from browsers
    const endpoint = s3Config.publicEndpoint || s3Config.endpoint;

    s3Client = new S3Client({
      region: s3Config.region,
      endpoint,
      credentials:
        s3Config.accessKeyId && s3Config.secretAccessKey
          ? {
              accessKeyId: s3Config.accessKeyId,
              secretAccessKey: s3Config.secretAccessKey,
            }
          : undefined,
      forcePathStyle: !!endpoint, // Required for MinIO/custom endpoints
    });
  }

  return s3Client;
}

/**
 * Check if S3 storage is configured
 */
export function isS3Configured(): boolean {
  return !!s3Config.bucket;
}

/**
 * Generate a presigned URL for accessing an HTML report
 *
 * @param reportPath - S3 path to the report directory (e.g., "reports/org/repo/runId")
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL or null if S3 not configured
 */
export async function getReportPresignedUrl(
  reportPath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const client = getS3Client();
  if (!client || !s3Config.bucket) {
    return null;
  }

  // The reportPath is the directory, we need index.html
  const key = `${reportPath}/index.html`;

  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}
