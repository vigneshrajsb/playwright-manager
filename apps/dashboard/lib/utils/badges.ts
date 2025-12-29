/**
 * Badge variant class names for different states
 */

export type HealthLevel = "healthy" | "flaky" | "failing" | "unknown";
export type TestStatus = "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
export type RunStatus = "running" | "passed" | "failed" | "interrupted";
export type Outcome = "expected" | "unexpected" | "flaky" | "skipped";

/**
 * Get the health level based on health score
 */
export function getHealthLevel(score: number | null | undefined): HealthLevel {
  if (score === null || score === undefined) return "unknown";
  if (score >= 80) return "healthy";
  if (score >= 50) return "flaky";
  return "failing";
}

/**
 * Get badge variant class for health score
 */
export function getHealthVariant(score: number | null | undefined): string {
  const level = getHealthLevel(score);

  const variants: Record<HealthLevel, string> = {
    healthy: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    flaky: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
    failing: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
    unknown: "", // Uses default outline variant
  };

  return variants[level];
}

/**
 * Get health label text
 */
export function getHealthLabel(score: number | null | undefined): string {
  const level = getHealthLevel(score);

  const labels: Record<HealthLevel, string> = {
    healthy: "Healthy",
    flaky: "Flaky",
    failing: "Failing",
    unknown: "No data",
  };

  return labels[level];
}

/**
 * Get badge variant class for test status
 */
export function getStatusVariant(status: string): string {
  const variants: Record<string, string> = {
    passed: "bg-green-500/10 text-green-600",
    failed: "bg-red-500/10 text-red-600",
    timedOut: "bg-orange-500/10 text-orange-600",
    skipped: "bg-gray-500/10 text-gray-600",
    interrupted: "bg-yellow-500/10 text-yellow-600",
  };

  return variants[status] || variants.skipped;
}

/**
 * Get badge variant class for run status
 */
export function getRunStatusVariant(status: string): string {
  const variants: Record<string, string> = {
    running: "bg-blue-500/10 text-blue-600",
    passed: "bg-green-500/10 text-green-600",
    failed: "bg-red-500/10 text-red-600",
    interrupted: "bg-yellow-500/10 text-yellow-600",
  };

  return variants[status] || "bg-gray-500/10 text-gray-600";
}

/**
 * Get badge variant class for outcome
 */
export function getOutcomeVariant(outcome: string): string {
  const variants: Record<string, string> = {
    expected: "bg-green-500/10 text-green-600",
    unexpected: "bg-red-500/10 text-red-600",
    flaky: "bg-yellow-500/10 text-yellow-600",
    skipped: "bg-gray-500/10 text-gray-600",
  };

  return variants[outcome] || variants.skipped;
}

/**
 * Determine if a test result should be shown as "red" (failure/unexpected)
 */
export function isResultNegative(
  status: string,
  outcome: string
): boolean {
  const isFailed = status === "failed" || status === "timedOut";
  const isUnexpected = outcome === "unexpected";
  return isFailed || isUnexpected;
}

/**
 * Get status badge variant considering expected vs actual status
 */
export function getStatusVariantWithExpectation(
  status: string,
  expectedStatus: string,
  outcome: string
): string {
  // If outcome is unexpected, show red regardless of status
  if (outcome === "unexpected") {
    return "bg-red-500/10 text-red-600";
  }

  return getStatusVariant(status);
}
