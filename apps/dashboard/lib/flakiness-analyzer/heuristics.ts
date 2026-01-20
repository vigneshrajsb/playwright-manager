import type { FlakinessSignals, HeuristicResult } from "./types";

// Scoring weights
const WEIGHTS = {
  HIGH_FLAKINESS_RATE: 30, // recentFlakinessRate > 20%
  PATTERN_MATCH: 25, // passed in recent runs
  ERROR_SEEN_BEFORE: 25, // same error, test later passed
  LOW_CONSECUTIVE_FAILURES: 15, // < 3 consecutive failures with passing history
  LOW_HEALTH_SCORE: 10, // healthScore < 50
};

const THRESHOLDS = {
  HIGH_FLAKINESS_RATE: 20,
  CONSECUTIVE_FAILURES_LOW: 3,
  HEALTH_SCORE_LOW: 50,
  MIN_PASSES_FOR_HISTORY: 2,
};

export function calculateHeuristicScore(signals: FlakinessSignals): HeuristicResult {
  let score = 0;
  const reasoning: string[] = [];

  // Signal 1: High flakiness rate
  if (signals.recentFlakinessRate > THRESHOLDS.HIGH_FLAKINESS_RATE) {
    score += WEIGHTS.HIGH_FLAKINESS_RATE;
    reasoning.push(
      `High flakiness rate (${signals.recentFlakinessRate.toFixed(1)}%)`
    );
  }

  // Signal 2: Pattern match - recent passes exist
  const recentPasses = signals.recentOutcomes.filter((o) => o === "pass").length;
  const recentTotal = signals.recentOutcomes.filter((o) => o !== "skip").length;
  if (recentPasses >= THRESHOLDS.MIN_PASSES_FOR_HISTORY && recentTotal > 0) {
    const passRatio = recentPasses / recentTotal;
    if (passRatio >= 0.3) {
      score += WEIGHTS.PATTERN_MATCH;
      reasoning.push(
        `Passed ${recentPasses} of last ${recentTotal} runs (${(passRatio * 100).toFixed(0)}%)`
      );
    }
  }

  // Signal 3: Error seen before and test passed after
  if (signals.errorSeenBefore && signals.errorPassedAfterCount > 0) {
    score += WEIGHTS.ERROR_SEEN_BEFORE;
    reasoning.push(
      `Same error seen ${signals.errorPassedAfterCount}x before, test later passed`
    );
  }

  // Signal 4: Low consecutive failures with passing history
  if (
    signals.consecutiveFailures < THRESHOLDS.CONSECUTIVE_FAILURES_LOW &&
    signals.consecutivePasses > 0
  ) {
    score += WEIGHTS.LOW_CONSECUTIVE_FAILURES;
    reasoning.push(
      `Only ${signals.consecutiveFailures} consecutive failures, had ${signals.consecutivePasses} consecutive passes before`
    );
  }

  // Signal 5: Already known as problematic test
  if (signals.healthScore < THRESHOLDS.HEALTH_SCORE_LOW) {
    score += WEIGHTS.LOW_HEALTH_SCORE;
    reasoning.push(`Low health score (${signals.healthScore}/100)`);
  }

  // Cap at 100
  score = Math.min(100, score);

  return {
    score,
    reasoning,
    signals,
  };
}

/**
 * Determine if heuristic confidence is high enough to skip LLM
 */
export function isHighConfidence(score: number): boolean {
  return score >= 75;
}
