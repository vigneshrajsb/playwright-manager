/**
 * Validate that a string is a valid positive integer ID
 *
 * @param str - The string to validate
 * @returns true if valid positive integer, false otherwise
 */
export function isValidId(str: string): boolean {
  const num = parseInt(str, 10);
  return !isNaN(num) && num > 0 && String(num) === str;
}

/**
 * Parse a string ID to a number
 * Returns null if invalid
 *
 * @param str - The string to parse
 * @returns The parsed number or null if invalid
 */
export function parseId(str: string): number | null {
  const num = parseInt(str, 10);
  if (isNaN(num) || num <= 0 || String(num) !== str) {
    return null;
  }
  return num;
}
