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
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, Clock, GitBranch } from "lucide-react";

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
    attachments: any[];
    annotations: any[];
  };
  test: {
    id: string;
    testTitle: string;
    filePath: string;
    projectName: string;
    repository: string;
    tags: string[] | null;
    isEnabled: boolean;
  };
  health: {
    healthScore: number;
    passRate: string;
    flakinessRate: string;
    totalRuns: number;
    consecutivePasses: number;
    consecutiveFailures: number;
    trend: string;
    lastStatus: string | null;
  } | null;
  recentHistory: Array<{
    id: string;
    status: string;
    outcome: string;
    durationMs: number;
    startedAt: string;
    errorMessage: string | null;
    branch: string | null;
    commitSha: string | null;
  }>;
  run: {
    id: string;
    runId: string;
    branch: string | null;
    commitSha: string | null;
    commitMessage: string | null;
    ciJobUrl: string | null;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  };
}

interface ResultSheetProps {
  resultId: string | null;
  onClose: () => void;
}

export function ResultSheet({ resultId, onClose }: ResultSheetProps) {
  const [data, setData] = useState<ResultDetail | null>(null);
  const [loading, setLoading] = useState(false);

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      passed: "bg-green-500/10 text-green-600",
      failed: "bg-red-500/10 text-red-600",
      timedOut: "bg-orange-500/10 text-orange-600",
      skipped: "bg-gray-500/10 text-gray-600",
      interrupted: "bg-yellow-500/10 text-yellow-600",
    };
    return (
      <Badge className={variants[status] || variants.skipped}>{status}</Badge>
    );
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, string> = {
      expected: "bg-green-500/10 text-green-600",
      unexpected: "bg-red-500/10 text-red-600",
      flaky: "bg-yellow-500/10 text-yellow-600",
      skipped: "bg-gray-500/10 text-gray-600",
    };
    return (
      <Badge className={variants[outcome] || variants.skipped}>{outcome}</Badge>
    );
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge className="bg-green-500/10 text-green-600">
          Healthy ({score})
        </Badge>
      );
    } else if (score >= 50) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600">
          Flaky ({score})
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-500/10 text-red-600">Failing ({score})</Badge>
      );
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

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
                </div>

                {data.result.errorMessage && (
                  <div className="mt-3 rounded-md bg-red-500/10 p-3">
                    <p className="text-xs font-medium text-red-600">Error</p>
                    <p className="mt-1 text-xs text-red-600/80 whitespace-pre-wrap">
                      {data.result.errorMessage}
                    </p>
                  </div>
                )}
              </div>

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
                        {getHealthBadge(data.health.healthScore)}
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {run.branch && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {run.branch}
                            </span>
                          )}
                          <span>{formatRelativeTime(run.startedAt)}</span>
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
                          <Badge
                            className={
                              annotation.type === "fail"
                                ? "bg-red-500/10 text-red-600"
                                : annotation.type === "skip" || annotation.type === "fixme"
                                ? "bg-yellow-500/10 text-yellow-600"
                                : annotation.type === "slow"
                                ? "bg-orange-500/10 text-orange-600"
                                : "bg-gray-500/10 text-gray-600"
                            }
                          >
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
