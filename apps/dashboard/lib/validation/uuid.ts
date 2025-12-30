const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID v4 format
 *
 * @param str - The string to validate
 * @returns true if valid UUID format, false otherwise
 */
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}
