import {
  S3Client,
  GetObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

const s3Config = {
  bucket: process.env.S3_BUCKET || undefined,
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
};

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!s3Config.bucket) {
    return null;
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      credentials:
        s3Config.accessKeyId && s3Config.secretAccessKey
          ? {
              accessKeyId: s3Config.accessKeyId,
              secretAccessKey: s3Config.secretAccessKey,
            }
          : undefined,
      forcePathStyle: !!s3Config.endpoint,
    });
  }

  return s3Client;
}

export function isS3Configured(): boolean {
  return !!s3Config.bucket;
}

/**
 * Fetch a report asset from S3 as a streaming response.
 * Returns null if S3 is not configured or the key does not exist.
 */
export async function getReportAsset(
  reportPath: string,
  assetPath: string,
): Promise<{
  body: ReadableStream;
  contentType: string;
  contentLength?: number;
} | null> {
  const client = getS3Client();
  if (!client || !s3Config.bucket) {
    return null;
  }

  const key = `${reportPath}/${assetPath}`;

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      return null;
    }

    const body =
      response.Body instanceof Readable
        ? (Readable.toWeb(response.Body) as ReadableStream)
        : (response.Body as ReadableStream);

    return {
      body,
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength,
    };
  } catch (error: unknown) {
    if (error instanceof NoSuchKey) {
      return null;
    }
    throw error;
  }
}
