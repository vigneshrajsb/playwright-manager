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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  ExternalLink,
  Clock,
  GitBranch,
  Server,
  ListChecks,
} from "lucide-react";
import { PlaywrightIcon } from "@/components/icons/playwright-icon";
import Link from "next/link";
import { formatDuration, formatRelativeTime } from "@/lib/utils/format";
import { openReportUrl } from "@/lib/utils/report";

interface PipelineDetail {
  pipeline: {
    id: string;
    runId: string;
    branch: string | null;
    commitSha: string | null;
    commitMessage: string | null;
    ciJobUrl: string | null;
    baseUrl: string | null;
    reportPath: string | null;
    playwrightVersion: string | null;
    totalWorkers: number | null;
    shardCurrent: number | null;
    shardTotal: number | null;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    totalTests: number;
    passedCount: number;
    failedCount: number;
    skippedCount: number;
    flakyCount: number;
    status: string;
    repository: string | null;
  };
  recentRuns: Array<{
    id: string;
    runId: string;
    branch: string | null;
    status: string;
    startedAt: string;
    durationMs: number | null;
    totalTests: number;
    passedCount: number;
    failedCount: number;
    skippedCount: number;
    flakyCount: number;
    ciJobUrl: string | null;
    reportPath: string | null;
  }>;
  stats: {
    avgDuration: number | null;
    totalRecentRuns: number;
  };
}

interface PipelineSheetProps {
  pipelineId: string | null;
  onClose: () => void;
}

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  passed: "bg-green-500/10 text-green-600",
  failed: "bg-red-500/10 text-red-600",
  running: "bg-blue-500/10 text-blue-600",
  interrupted: "bg-yellow-500/10 text-yellow-600",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  passed: "bg-green-500",
  failed: "bg-red-500",
  running: "bg-blue-500",
  interrupted: "bg-yellow-500",
};

function getStatusBadge(status: string) {
  const variant = STATUS_BADGE_VARIANTS[status] || STATUS_BADGE_VARIANTS.interrupted;
  return <Badge className={variant}>{status}</Badge>;
}

function getStatusDot(status: string) {
  const color = STATUS_DOT_COLORS[status] || STATUS_DOT_COLORS.interrupted;
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function PipelineSheet({ pipelineId, onClose }: PipelineSheetProps) {
  const [data, setData] = useState<PipelineDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pipelineId) {
      setLoading(true);
      fetch(`/api/pipelines/${pipelineId}`)
        .then((res) => res.json())
        .then((data) => {
          setData(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch pipeline details:", error);
          setLoading(false);
        });
    } else {
      setData(null);
    }
  }, [pipelineId]);

  const pipeline = data?.pipeline;
  const recentRuns = data?.recentRuns || [];

  // Calculate test result percentages for stacked bar
  const percentages =
    pipeline && pipeline.totalTests > 0
      ? {
          passed: (pipeline.passedCount / pipeline.totalTests) * 100,
          failed: (pipeline.failedCount / pipeline.totalTests) * 100,
          skipped: (pipeline.skippedCount / pipeline.totalTests) * 100,
          flaky: (pipeline.flakyCount / pipeline.totalTests) * 100,
        }
      : null;

  return (
    <Sheet open={!!pipelineId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data && pipeline ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                {getStatusBadge(pipeline.status)}
                {pipeline.repository && (
                  <Badge variant="outline" className="text-xs">
                    {pipeline.repository}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-base flex items-center gap-2">
                {pipeline.branch && (
                  <>
                    <GitBranch className="h-4 w-4" />
                    {pipeline.branch}
                  </>
                )}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                {pipeline.commitSha && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded cursor-default">
                        {pipeline.commitSha.slice(0, 7)}
                      </code>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[300px] break-words">
                        {pipeline.commitMessage || pipeline.commitSha}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <span className="text-xs text-muted-foreground">
                  {pipeline.runId}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-6 px-4 pb-4">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/dashboard/results?testRunId=${pipeline.id}`}
                  title="View all test results for this pipeline"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted transition-colors"
                >
                  <ListChecks className="h-4 w-4" />
                  Results
                </Link>
                {pipeline.reportPath && (
                  <button
                    onClick={() => openReportUrl(pipeline.id)}
                    title="Open Playwright HTML report in new tab"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted transition-colors"
                  >
                    <PlaywrightIcon className="h-4 w-4" />
                    Report
                  </button>
                )}
                {pipeline.ciJobUrl && (
                  <a
                    href={pipeline.ciJobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open CI job in new tab"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    CI Job
                  </a>
                )}
              </div>

              <Separator />

              {/* Test Results - Horizontal Stacked Bar */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Test Results</h4>
                {percentages && (
                  <div className="space-y-2">
                    {/* Stacked bar */}
                    <div className="h-3 w-full rounded-full overflow-hidden bg-muted flex">
                      {percentages.passed > 0 && (
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${percentages.passed}%` }}
                        />
                      )}
                      {percentages.flaky > 0 && (
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${percentages.flaky}%` }}
                        />
                      )}
                      {percentages.failed > 0 && (
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${percentages.failed}%` }}
                        />
                      )}
                      {percentages.skipped > 0 && (
                        <div
                          className="h-full bg-gray-400"
                          style={{ width: `${percentages.skipped}%` }}
                        />
                      )}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">Passed:</span>
                        <span className="font-medium">{pipeline.passedCount}</span>
                      </span>
                      {pipeline.flakyCount > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-yellow-500" />
                          <span className="text-muted-foreground">Flaky:</span>
                          <span className="font-medium">{pipeline.flakyCount}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-muted-foreground">Failed:</span>
                        <span className="font-medium">{pipeline.failedCount}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        <span className="text-muted-foreground">Skipped:</span>
                        <span className="font-medium">{pipeline.skippedCount}</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pipeline.totalTests} total tests
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Duration */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Duration</h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Duration
                  </span>
                  <span className="font-medium">
                    {pipeline.durationMs ? formatDuration(pipeline.durationMs) : "--"}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Environment Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Environment
                </h4>
                <div className="space-y-2 text-sm">
                  {pipeline.baseUrl && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Base URL</span>
                      <a
                        href={pipeline.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline truncate max-w-[200px]"
                      >
                        {pipeline.baseUrl.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  )}
                  {pipeline.playwrightVersion && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Playwright</span>
                      <span>v{pipeline.playwrightVersion}</span>
                    </div>
                  )}
                  {pipeline.totalWorkers && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Workers</span>
                      <span>{pipeline.totalWorkers}</span>
                    </div>
                  )}
                  {pipeline.shardTotal && pipeline.shardTotal > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Shard</span>
                      <span>
                        {pipeline.shardCurrent} / {pipeline.shardTotal}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Recent Runs */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Recent Runs</h4>
                {recentRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No other runs from this repository
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentRuns.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between rounded-md border p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {getStatusDot(run.status)}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {run.branch || "unknown"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="text-green-600">{run.passedCount}</span>
                          <span>/</span>
                          <span className="text-red-600">{run.failedCount}</span>
                          <span>{formatRelativeTime(run.startedAt)}</span>
                          <div className="flex items-center gap-1">
                            {run.reportPath && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => openReportUrl(run.id)}
                                    className="p-1 hover:bg-muted rounded"
                                  >
                                    <PlaywrightIcon className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>View Report</TooltipContent>
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
                                  href={`/dashboard/results?testRunId=${run.id}`}
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
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a pipeline to view details
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
