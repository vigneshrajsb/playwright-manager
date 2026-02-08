/**
 * Parse a string ID to a positive integer.
 * Returns null if the string is not a valid positive integer.
 */
export function parseId(str: string): number | null {
  const num = parseInt(str, 10);
  if (isNaN(num) || num <= 0 || String(num) !== str) {
    return null;
  }
  return num;
}

/**
 * Validate that a string is a valid positive integer ID.
 */
export function isValidId(str: string): boolean {
  return parseId(str) !== null;
}
