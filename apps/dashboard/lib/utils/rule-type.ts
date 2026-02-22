import { Ban, GitBranch, Globe } from "lucide-react";
import type { SkipRule } from "@/types";

type RuleTypePick = Pick<SkipRule, "branchPattern" | "envPattern">;

export type RuleType = "global" | "branch" | "env" | "branch+env";

export function getRuleType(rule: RuleTypePick): RuleType {
  if (!rule.branchPattern && !rule.envPattern) return "global";
  if (rule.branchPattern && rule.envPattern) return "branch+env";
  if (rule.branchPattern) return "branch";
  return "env";
}

export function getRuleTypeLabel(type: RuleType): string {
  switch (type) {
    case "global":
      return "Global";
    case "branch":
      return "Branch";
    case "env":
      return "Environment";
    case "branch+env":
      return "Branch + Env";
  }
}

export function getRuleTypeBadgeVariant(
  type: RuleType
): "destructive" | "secondary" | "outline" {
  switch (type) {
    case "global":
      return "destructive";
    case "branch":
    case "env":
      return "secondary";
    case "branch+env":
      return "outline";
  }
}

export function getRuleIcon(rule: RuleTypePick) {
  if (!rule.branchPattern && !rule.envPattern) return Ban;
  if (rule.branchPattern) return GitBranch;
  return Globe;
}
