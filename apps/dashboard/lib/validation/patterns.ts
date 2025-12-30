import { minimatch } from "minimatch";

export interface PatternValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_PATTERN_LENGTH = 255;
// Allow alphanumeric, dashes, underscores, asterisks, question marks, slashes, dots, brackets
const VALID_PATTERN_CHARS = /^[\w\-*?/.\[\]{}@]+$/;

/**
 * Validate a glob pattern for branch or environment matching
 *
 * @param pattern - The glob pattern to validate
 * @returns Validation result with error message if invalid
 */
export function validateGlobPattern(
  pattern: string | undefined | null
): PatternValidationResult {
  // Empty/null patterns are valid (means "all")
  if (!pattern) {
    return { valid: true };
  }

  const trimmed = pattern.trim();

  // Check length
  if (trimmed.length > MAX_PATTERN_LENGTH) {
    return {
      valid: false,
      error: `Pattern too long (max ${MAX_PATTERN_LENGTH} characters)`,
    };
  }

  // Check for valid characters
  if (!VALID_PATTERN_CHARS.test(trimmed)) {
    return {
      valid: false,
      error: "Pattern contains invalid characters",
    };
  }

  // Validate minimatch syntax by testing it
  try {
    minimatch("test", trimmed, { nocase: true });
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: "Invalid glob pattern syntax",
    };
  }
}

/**
 * Validate both branch and environment patterns
 *
 * @param branchPattern - The branch pattern to validate
 * @param envPattern - The environment pattern to validate
 * @returns Validation result with error message if invalid
 */
export function validatePatterns(
  branchPattern: string | undefined | null,
  envPattern: string | undefined | null
): PatternValidationResult {
  const branchResult = validateGlobPattern(branchPattern);
  if (!branchResult.valid) {
    return { valid: false, error: `Branch pattern: ${branchResult.error}` };
  }

  const envResult = validateGlobPattern(envPattern);
  if (!envResult.valid) {
    return { valid: false, error: `Environment pattern: ${envResult.error}` };
  }

  return { valid: true };
}
