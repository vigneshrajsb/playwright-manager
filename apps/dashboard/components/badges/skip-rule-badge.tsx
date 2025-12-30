"use client";

import { Badge } from "@/components/ui/badge";
import { GitBranch, Globe, Ban } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SkipRuleBadgeProps {
  rule: {
    id: string;
    branchPattern?: string | null;
    envPattern?: string | null;
    reason: string;
  };
}

/**
 * Badge displaying a skip rule with tooltip showing details
 */
export function SkipRuleBadge({ rule }: SkipRuleBadgeProps) {
  const isGlobal = !rule.branchPattern && !rule.envPattern;
  const hasBoth = rule.branchPattern && rule.envPattern;

  let label = "Disabled";
  let Icon = Ban;

  if (hasBoth) {
    label = `${rule.branchPattern} + ${rule.envPattern}`;
  } else if (rule.branchPattern) {
    label = rule.branchPattern;
    Icon = GitBranch;
  } else if (rule.envPattern) {
    label = rule.envPattern;
    Icon = Globe;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="destructive"
          className="text-xs px-1.5 py-0 flex items-center gap-1 cursor-default"
        >
          {hasBoth ? (
            <>
              <GitBranch className="h-3 w-3" />
              <Globe className="h-3 w-3" />
            </>
          ) : (
            <Icon className="h-3 w-3" />
          )}
          <span className="max-w-[150px] truncate">
            {isGlobal ? "Disabled" : label}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px]">
        <p className="font-medium">{rule.reason}</p>
        {rule.branchPattern && (
          <p className="text-xs mt-1">
            <span className="text-muted-foreground">Branch:</span>{" "}
            {rule.branchPattern}
          </p>
        )}
        {rule.envPattern && (
          <p className="text-xs">
            <span className="text-muted-foreground">Environment:</span>{" "}
            {rule.envPattern}
          </p>
        )}
        {isGlobal && (
          <p className="text-xs text-muted-foreground mt-1">
            Skipped on all branches and environments
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export interface SkipRulesBadgesProps {
  rules: Array<{
    id: string;
    branchPattern?: string | null;
    envPattern?: string | null;
    reason: string;
  }>;
  /** Maximum number of badges to show before collapsing */
  maxVisible?: number;
}

/**
 * Display multiple skip rule badges with overflow handling
 */
export function SkipRulesBadges({
  rules,
  maxVisible = 2,
}: SkipRulesBadgesProps) {
  if (!rules || rules.length === 0) return null;

  const visibleRules = rules.slice(0, maxVisible);
  const hiddenCount = rules.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleRules.map((rule) => (
        <SkipRuleBadge key={rule.id} rule={rule} />
      ))}
      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="text-xs px-1.5 py-0 cursor-default"
            >
              +{hiddenCount} more
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[300px]">
            <div className="space-y-2">
              {rules.slice(maxVisible).map((rule) => (
                <div key={rule.id} className="text-xs">
                  <p className="font-medium">{rule.reason}</p>
                  {rule.branchPattern && (
                    <p className="text-muted-foreground">
                      Branch: {rule.branchPattern}
                    </p>
                  )}
                  {rule.envPattern && (
                    <p className="text-muted-foreground">
                      Env: {rule.envPattern}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
