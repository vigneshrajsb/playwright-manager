"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLink, Pencil, Trash2, GitBranch, Globe } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import {
  getRuleType,
  getRuleTypeLabel,
  getRuleTypeBadgeVariant,
  getRuleIcon,
} from "@/lib/utils/rule-type";
import type { QuarantinedRule } from "@/hooks/queries/use-quarantined";

interface QuarantineRuleCardProps {
  rule: QuarantinedRule;
  testUrl: string;
  onEdit: (rule: QuarantinedRule) => void;
  onDelete: (rule: QuarantinedRule) => void;
}

export function QuarantineRuleCard({
  rule,
  testUrl,
  onEdit,
  onDelete,
}: QuarantineRuleCardProps) {
  const ruleType = getRuleType(rule);

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground">
      {/* Rule type icon */}
      <div className="shrink-0 text-muted-foreground">
        {React.createElement(getRuleIcon(rule), { className: "h-4 w-4" })}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: title + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm leading-tight">{rule.test.testTitle}</span>
          <Badge variant="outline" className="text-xs shrink-0">{rule.test.projectName}</Badge>
          <Badge variant={getRuleTypeBadgeVariant(ruleType)} className="text-xs shrink-0">
            {getRuleTypeLabel(ruleType)}
          </Badge>
        </div>

        {/* Row 2: file path · reason · optional patterns */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="truncate max-w-[240px]">{rule.test.filePath}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0">{rule.reason}</span>
          {rule.branchPattern && (
            <>
              <span className="shrink-0">·</span>
              <span className="flex items-center gap-1 shrink-0">
                <GitBranch className="h-3 w-3" />
                <code className="bg-muted px-1 rounded">{rule.branchPattern}</code>
              </span>
            </>
          )}
          {rule.envPattern && (
            <>
              <span className="shrink-0">·</span>
              <span className="flex items-center gap-1 shrink-0">
                <Globe className="h-3 w-3" />
                <code className="bg-muted px-1 rounded">{rule.envPattern}</code>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Skip count + date */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 hidden sm:flex">
        {rule.skipCount > 0 && (
          <>
            <span>Skipped in {rule.skipCount} {rule.skipCount === 1 ? "run" : "runs"}</span>
            <span>·</span>
          </>
        )}
        <span>{formatDate(rule.createdAt)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={testUrl}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View Test</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(rule)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit Rule</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(rule)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove Rule</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
