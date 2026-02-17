"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/badges";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Loader2, ExternalLink, Clock, GitBranch, ListChecks, ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDuration, formatDate, formatRelativeTime, stripAnsi } from "@/lib/utils/format";
import { openReportUrl } from "@/lib/utils/report";
import { PlaywrightIcon } from "@/components/icons/playwright-icon";
import { useTimeRangeUrl } from "@/hooks";

interface ResultDetail {
  result: {
    id: string;
    status: string;
    outcome: string;
    durationMs: number;
    errorMessage: string | null;
    errorStack: string | null;
    retryCount: number;
    startedAt: string;
    attachments: Array<{ name: string; contentType: string; path?: string; body?: string }>;
    annotations: Array<{ type: string; description?: string }>;
    baseUrl: string | null;
  };
  test: {
    id: string;
    playwrightTestId: string;
    testTitle: string;
    filePath: string;
    projectName: string;
    repository: string;
    tags: string[] | null;
  };
  health: {
    healthScore: number | null;
    passRate: string;
    flakinessRate: string;
    recentPassRate?: string;
    recentFlakinessRate?: string;
    healthDivergence?: string;
    totalRuns: number;
    consecutivePasses: number;
    consecutiveFailures: number;
    trend: string;
    lastStatus: string | null;
  } | null;
  recentHistory: Array<{
    id: string;
    testRunId: string;
    status: string;
    outcome: string;
    durationMs: number;
    startedAt: string;
    errorMessage: string | null;
    branch: string | null;
    commitSha: string | null;
    ciJobUrl: string | null;
    reportPath: string | null;
  }>;
  retryHistory: Array<{
    id: string;
    status: string;
    outcome: string;
    durationMs: number;
    retryCount: number;
    isFinalAttempt: boolean;
    errorMessage: string | null;
    startedAt: string;
  }>;
  run: {
    id: string;
    runId: string;
    branch: string | null;
    commitSha: string | null;
    commitMessage: string | null;
    ciJobUrl: string | null;
    reportPath: string | null;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  };
}

interface ResultSheetProps {
  resultId: string | null;
  onClose: () => void;
}

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  passed: "bg-green-500/10 text-green-600",
  failed: "bg-red-500/10 text-red-600",
  timedOut: "bg-orange-500/10 text-orange-600",
  skipped: "bg-gray-500/10 text-gray-600",
  interrupted: "bg-yellow-500/10 text-yellow-600",
};

const OUTCOME_BADGE_VARIANTS: Record<string, string> = {
  expected: "bg-green-500/10 text-green-600",
  unexpected: "bg-red-500/10 text-red-600",
  flaky: "bg-yellow-500/10 text-yellow-600",
  skipped: "bg-gray-500/10 text-gray-600",
};

const ANNOTATION_BADGE_VARIANTS: Record<string, string> = {
  fail: "bg-red-500/10 text-red-600",
  skip: "bg-yellow-500/10 text-yellow-600",
  fixme: "bg-yellow-500/10 text-yellow-600",
  slow: "bg-orange-500/10 text-orange-600",
};

function getStatusBadge(status: string) {
  const variant = STATUS_BADGE_VARIANTS[status] || STATUS_BADGE_VARIANTS.skipped;
  return <Badge className={variant}>{status}</Badge>;
}

function getOutcomeBadge(outcome: string) {
  const variant = OUTCOME_BADGE_VARIANTS[outcome] || OUTCOME_BADGE_VARIANTS.skipped;
  return <Badge className={variant}>{outcome}</Badge>;
}

function getAnnotationBadgeVariant(type: string): string {
  return ANNOTATION_BADGE_VARIANTS[type] || "bg-gray-500/10 text-gray-600";
}

export function ResultSheet({ resultId, onClose }: ResultSheetProps) {
  const [data, setData] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const { buildUrl } = useTimeRangeUrl();

  /* eslint-disable react-hooks/set-state-in-effect -- data fetch requires setState in effect */
  useEffect(() => {
    if (resultId) {
      setLoading(true);
      fetch(`/api/results/${resultId}`)
        .then((res) => res.json())
        .then((data) => {
          setData(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch result details:", error);
          setLoading(false);
        });
    } else {
      setData(null);
    }
  }, [resultId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Sheet open={!!resultId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data ? (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">
                {data.test.testTitle}
              </SheetTitle>
              <SheetDescription className="truncate text-xs">
                {data.test.filePath}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-6 px-4 pb-4">
              {/* Execution Details */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Execution Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    {getStatusBadge(data.result.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Outcome</span>
                    {getOutcomeBadge(data.result.outcome)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(data.result.durationMs)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Retries</span>
                    <span>{data.result.retryCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Project</span>
                    <Badge variant="outline">{data.test.projectName}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span>{formatDate(data.result.startedAt)}</span>
                  </div>
                  {data.result.baseUrl && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Base URL</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={data.result.baseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline max-w-[200px]"
                          >
                            <span className="truncate">{data.result.baseUrl.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{data.result.baseUrl}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>

                {data.result.errorMessage && (
                  <div className="mt-3 rounded-md bg-red-500/10 p-3">
                    <p className="text-xs text-red-600/80 whitespace-pre-wrap">
                      {stripAnsi(data.result.errorMessage)}
                    </p>
                  </div>
                )}
              </div>

              {/* Retry History Timeline */}
              {data.result.retryCount > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Retry History</h4>
                    <div className="space-y-3">
                      {data.retryHistory.map((attempt, idx) => (
                        <div key={attempt.id} className="relative pl-6">
                          {/* Timeline connector line */}
                          {idx < data.retryHistory.length - 1 && (
                            <div className="absolute left-2 top-6 h-full w-px bg-border" />
                          )}

                          {/* Timeline dot */}
                          <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-border bg-background flex items-center justify-center">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                attempt.status === "passed"
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                            />
                          </div>

                          {/* Attempt content */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {attempt.isFinalAttempt
                                  ? "Final Attempt"
                                  : `Attempt ${attempt.retryCount + 1}`}
                              </span>
                              {getStatusBadge(attempt.status)}
                              <span className="text-xs text-muted-foreground">
                                {formatDuration(attempt.durationMs)}
                              </span>
                            </div>

                            {attempt.errorMessage && (
                              <Collapsible>
                                <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                  <ChevronDown className="h-3 w-3" />
                                  View error
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 rounded-md bg-red-500/10 p-2">
                                    <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
                                      {stripAnsi(attempt.errorMessage)}
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            <span className="text-xs text-muted-foreground">
                              {formatDate(attempt.startedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Run Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Run Info</h4>
                <div className="space-y-2 text-sm">
                  {data.run.branch && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Branch</span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {data.run.branch}
                      </span>
                    </div>
                  )}
                  {data.run.commitSha && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Commit</span>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {data.run.commitSha.slice(0, 7)}
                      </code>
                    </div>
                  )}
                  {data.run.ciJobUrl && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">CI Job</span>
                      <a
                        href={data.run.ciJobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {data.run.reportPath && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        Report <PlaywrightIcon className="h-[1em] w-[1em]" />
                      </span>
                      <button
                        onClick={() => openReportUrl(data.run.id, data.test.playwrightTestId)}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Test Health */}
              {data.health && (
                <>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Test Health</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Health Score
                        </span>
                        <HealthBadge
                          score={data.health.healthScore}
                          showScore
                          recentPassRate={data.health.recentPassRate}
                          overallPassRate={data.health.passRate}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Pass Rate</span>
                        <span>{data.health.passRate}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Flakiness Rate
                        </span>
                        <span>{data.health.flakinessRate}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Runs</span>
                        <span>{data.health.totalRuns}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Trend</span>
                        <Badge variant="outline">{data.health.trend}</Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />
                </>
              )}

              {/* Recent History */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Recent Runs</h4>
                {data.recentHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent runs
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.recentHistory.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between rounded-md border p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {getStatusBadge(run.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(run.durationMs)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {run.branch && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {run.branch}
                            </span>
                          )}
                          <span>{formatRelativeTime(run.startedAt)}</span>
                          <div className="flex items-center gap-1">
                            {run.reportPath && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => openReportUrl(run.testRunId, data.test.playwrightTestId)}
                                    className="p-1 hover:bg-muted rounded"
                                  >
                                    <PlaywrightIcon className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>View in Report</TooltipContent>
                              </Tooltip>
                            )}
                            {run.ciJobUrl && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={run.ciJobUrl}
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
                                  href={buildUrl("/dashboard/results", { testRunId: run.testRunId })}
                                  className="p-1 hover:bg-muted rounded"
                                >
                                  <ListChecks className="h-3.5 w-3.5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>View All Results</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              {data.test.tags && data.test.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {data.test.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Annotations */}
              {data.result.annotations && data.result.annotations.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Annotations</h4>
                    <div className="space-y-2">
                      {data.result.annotations.map((annotation: { type: string; description?: string }, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 rounded-md border p-2"
                        >
                          <Badge className={getAnnotationBadgeVariant(annotation.type)}>
                            {annotation.type}
                          </Badge>
                          {annotation.description && (
                            <span className="text-sm text-muted-foreground">
                              {annotation.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a result to view details
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
