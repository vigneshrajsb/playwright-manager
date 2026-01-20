import { createHash } from "crypto";

/**
 * Normalize error message by removing dynamic parts:
 * - Line numbers (file.ts:123:45)
 * - Timestamps (2024-01-20T12:34:56.789Z)
 * - UUIDs (550e8400-e29b-41d4-a716-446655440000)
 * - Memory addresses (0x7fff5fbff8c0)
 * - Port numbers in URLs (localhost:3456)
 * - Temporary file paths (/tmp/xxx, /var/folders/xxx)
 */
export function normalizeErrorMessage(errorMessage: string): string {
  if (!errorMessage) return "";

  let normalized = errorMessage
    // Remove line:column numbers (file.ts:123:45 -> file.ts)
    .replace(/:\d+:\d+/g, "")
    // Remove standalone line numbers (:123)
    .replace(/:\d+(?=\s|$|\))/g, "")
    // Remove ISO timestamps
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "<TIMESTAMP>")
    // Remove Unix timestamps (13 digits)
    .replace(/\b\d{13}\b/g, "<TIMESTAMP>")
    // Remove UUIDs
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<UUID>"
    )
    // Remove memory addresses
    .replace(/0x[0-9a-f]+/gi, "<ADDR>")
    // Remove port numbers in localhost URLs
    .replace(/localhost:\d+/g, "localhost:<PORT>")
    // Remove temp paths
    .replace(/\/tmp\/[^\s]+/g, "/tmp/<TEMP>")
    .replace(/\/var\/folders\/[^\s]+/g, "/var/folders/<TEMP>")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

/**
 * Generate SHA256 hash of normalized error message
 */
export function hashErrorSignature(errorMessage: string): string {
  const normalized = normalizeErrorMessage(errorMessage);
  return createHash("sha256").update(normalized).digest("hex");
}
