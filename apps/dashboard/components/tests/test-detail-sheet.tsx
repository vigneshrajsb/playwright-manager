"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HealthBadge, OutcomeBadge } from "@/components/badges";
import { SkipRulesBadges } from "@/components/badges/skip-rule-badge";
import {
  Loader2,
  ExternalLink,
  Clock,
  GitBranch,
  ListChecks,
  Globe,
  ScrollText,
  RotateCw,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { PlaywrightIcon } from "@/components/icons/playwright-icon";
import {
  formatDuration,
  formatDate,
  formatRelativeTime,
} from "@/lib/utils/format";
import { openReportUrl } from "@/lib/utils/report";
import { getRuleType, getRuleTypeLabel, getRuleIcon } from "@/lib/utils/rule-type";
import { EditRuleDialog } from "@/components/quarantined/edit-rule-dialog";
import { useTestDetail } from "@/hooks/queries/use-test-detail";
import { useTimeRangeUrl } from "@/hooks";
import type { SkipRule } from "@/types";

interface TestDetailSheetProps {
  testId: string | null;
  onClose: () => void;
  onOpenRulesSheet?: (testId: string) => void;
}

const OUTCOME_DOT_COLORS: Record<string, string> = {
  expected: "bg-green-500",
  unexpected: "bg-red-500",
  flaky: "bg-yellow-500",
  skipped: "bg-gray-400",
};

function getDotColor(outcome: string) {
  return OUTCOME_DOT_COLORS[outcome] ?? "bg-gray-400";
}


export function TestDetailSheet({
  testId,
  onClose,
  onOpenRulesSheet,
}: TestDetailSheetProps) {
  const [editRule, setEditRule] = useState<SkipRule | null>(null);
  const { data, isLoading } = useTestDetail(testId);
  const { buildUrl } = useTimeRangeUrl();

  const test = data?.test;
  const health = test?.health;
  const results = data?.results ?? [];
  const activeSkipRules = data?.skipRules ?? [];

  const streakResults = results.slice(0, 20);
  const recentResults = results.slice(0, 10);
  const hasSkipRules = activeSkipRules.length > 0;

  return (
    <>
    <Sheet open={!!testId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data && test ? (
          <>
            <SheetHeader>
              <SheetTitle className="text-base pr-6">{test.testTitle}</SheetTitle>
              <SheetDescription className="truncate text-xs">
                {test.filePath}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge variant="outline">{test.projectName}</Badge>
                {test.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {hasSkipRules ? (
                  <SkipRulesBadges rules={activeSkipRules} maxVisible={1} />
                ) : (
                  <Badge variant="default">Enabled</Badge>
                )}
              </div>
            </SheetHeader>

            <div className="mt-4 space-y-5 px-4 pb-6">
              {/* Health Overview */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Health Overview</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Health Score</div>
                    <HealthBadge
                      score={health?.healthScore}
                      showScore
                      recentPassRate={health?.recentPassRate}
                      overallPassRate={health?.passRate}
                    />
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Pass Rate</div>
                    <div className="font-medium text-sm">
                      {health ? `${Number(health.passRate).toFixed(0)}%` : "--"}
                    </div>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Flakiness</div>
                    <div className="font-medium text-sm">
                      {health ? `${Number(health.flakinessRate).toFixed(0)}%` : "--"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {health ? formatDuration(health.avgDurationMs) : "--"}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    Trend:
                    <Badge variant="outline" className="text-xs py-0">
                      {health?.trend ?? "--"}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">
                    {health ? `${health.totalRuns} runs` : "--"}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Run Streak */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Run Streak (last {streakResults.length})</h4>
                {streakResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No results yet</p>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap">
                    {streakResults.map((r) => (
                      <Tooltip key={r.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`h-3 w-3 rounded-full cursor-default ${getDotColor(r.outcome)}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {r.outcome} · {formatDuration(r.durationMs)} ·{" "}
                            {r.run.branch ?? "unknown"} ·{" "}
                            {formatRelativeTime(r.startedAt)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Recent Results */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Recent Results</h4>
                {recentResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No results yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentResults.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-md border p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <OutcomeBadge outcome={r.outcome} />
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(r.durationMs)}
                          </span>
                          {r.retryCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs px-1.5 py-0 cursor-help text-muted-foreground border-muted-foreground/30">
                                  <RotateCw className="h-3 w-3 mr-1" />
                                  {r.retryCount}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {r.retryCount === 1 ? "1 retry attempt" : `${r.retryCount} retry attempts`}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {r.run.branch && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {r.run.branch}
                            </span>
                          )}
                          {r.run.commitSha && (
                            <code className="bg-muted px-1 py-0.5 rounded">
                              {r.run.commitSha.slice(0, 7)}
                            </code>
                          )}
                          <span>{formatRelativeTime(r.startedAt)}</span>
                          <div className="flex items-center gap-1">
                            {r.run.reportPath && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() =>
                                      openReportUrl(r.run.id, test.playwrightTestId)
                                    }
                                    className="p-1 hover:bg-muted rounded"
                                  >
                                    <PlaywrightIcon className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>View in Report</TooltipContent>
                              </Tooltip>
                            )}
                            {r.run.ciJobUrl && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={r.run.ciJobUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 hover:bg-muted rounded"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Open CI Job</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  href={buildUrl("/dashboard/results", {
                                    testRunId: r.run.id,
                                  })}
                                  className="p-1 hover:bg-muted rounded"
                                >
                                  <ListChecks className="h-3.5 w-3.5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>View in Results</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {results.length > 10 && (
                  <Link
                    href={buildUrl("/dashboard/results", { testId: test.id })}
                    className="text-xs text-primary hover:underline"
                  >
                    View all {results.length > 50 ? "50+" : results.length} results →
                  </Link>
                )}
              </div>

              <Separator />

              {/* Skip Rules */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">
                  Skip Rules ({activeSkipRules.length} active)
                </h4>
                {activeSkipRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active skip rules</p>
                ) : (
                  <div className="space-y-2">
                    {activeSkipRules.map((rule) => {
                      const Icon = getRuleIcon(rule);
                      return (
                        <div key={rule.id} className="rounded-lg border p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <Badge variant="secondary" className="text-xs">
                                {getRuleTypeLabel(getRuleType(rule))}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditRule(rule)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-sm">{rule.reason}</p>
                          {(rule.branchPattern || rule.envPattern) && (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {rule.branchPattern && (
                                <div className="flex items-center gap-1">
                                  <GitBranch className="h-3 w-3" />
                                  <span>Branch:</span>
                                  <code className="bg-muted px-1 rounded">
                                    {rule.branchPattern}
                                  </code>
                                </div>
                              )}
                              {rule.envPattern && (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  <span>Environment:</span>
                                  <code className="bg-muted px-1 rounded">
                                    {rule.envPattern}
                                  </code>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Created {formatDate(rule.createdAt)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {onOpenRulesSheet && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onOpenRulesSheet(test.id)}
                  >
                    <ScrollText className="mr-2 h-4 w-4" />
                    Manage Rules
                  </Button>
                )}
              </div>

              <Separator />

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <Link href={buildUrl("/dashboard/results", { testId: test.id })}>
                    <ListChecks className="mr-2 h-4 w-4" />
                    View All Results
                  </Link>
                </Button>
                {onOpenRulesSheet && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onOpenRulesSheet(test.id)}
                  >
                    <ScrollText className="mr-2 h-4 w-4" />
                    Manage Rules
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a test to view details
          </div>
        )}
      </SheetContent>
    </Sheet>

    <EditRuleDialog
      rule={editRule}
      testTitle={test?.testTitle}
      onClose={() => setEditRule(null)}
    />
    </>
  );
}
