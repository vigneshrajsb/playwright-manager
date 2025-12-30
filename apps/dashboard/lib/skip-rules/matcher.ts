import { minimatch } from "minimatch";
import type { SkipRule } from "@/lib/db/schema";

export interface MatchResult {
  matches: boolean;
  matchedBranch?: boolean;
  matchedEnv?: boolean;
}

// Safe minimatch options to prevent ReDoS attacks
const MINIMATCH_OPTIONS = {
  nocase: true,
  nobrace: true,
  noext: true,
};

/**
 * Match a skip rule against the current branch and baseURL context
 */
export function matchRule(
  rule: SkipRule,
  branch: string | undefined,
  baseURL: string | undefined
): MatchResult {
  const hasBranchPattern = !!rule.branchPattern;
  const hasEnvPattern = !!rule.envPattern;

  // Global rule (no patterns) - always matches
  if (!hasBranchPattern && !hasEnvPattern) {
    return { matches: true };
  }

  let branchMatches = true;
  let envMatches = true;

  if (hasBranchPattern) {
    if (!branch) {
      // No branch provided, branch-specific rule doesn't match
      branchMatches = false;
    } else {
      branchMatches = minimatch(branch, rule.branchPattern!, MINIMATCH_OPTIONS);
    }
  }

  if (hasEnvPattern) {
    if (!baseURL) {
      // No baseURL provided, env-specific rule doesn't match
      envMatches = false;
    } else {
      try {
        const url = new URL(baseURL);
        envMatches = minimatch(url.hostname, rule.envPattern!, MINIMATCH_OPTIONS);
      } catch {
        envMatches = false;
      }
    }
  }

  // Both must match if both are specified (AND within rule)
  const matches = branchMatches && envMatches;

  return {
    matches,
    matchedBranch: hasBranchPattern ? branchMatches : undefined,
    matchedEnv: hasEnvPattern ? envMatches : undefined,
  };
}
