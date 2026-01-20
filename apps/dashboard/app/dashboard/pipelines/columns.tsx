"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  ListChecks,
  Eye,
} from "lucide-react";
import { PlaywrightIcon } from "@/components/icons/playwright-icon";
import Link from "next/link";
import { DataTableColumnHeader } from "@/components/data-table";
import { formatDate, formatDuration } from "@/lib/utils/format";
import { openReportUrl } from "@/lib/utils/report";
import type { Pipeline } from "@/types";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "passed":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    case "interrupted":
      return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

export const pipelineColumns = (
  onOpenSheet: (id: string) => void
): ColumnDef<Pipeline>[] => [
  {
    accessorKey: "status",
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        {getStatusIcon(row.original.status)}
      </div>
    ),
    size: 50,
    enableSorting: false,
  },
  {
    accessorKey: "branch",
    id: "branch",
    header: "Branch / Commit",
    cell: ({ row }) => {
      const pipeline = row.original;
      return (
        <div className="flex flex-col gap-1">
          {pipeline.branch && (
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{pipeline.branch}</span>
            </div>
          )}
          {pipeline.commitSha && (
            <Tooltip>
              <TooltipTrigger asChild>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit cursor-default">
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
          {!pipeline.branch && !pipeline.commitSha && (
            <span className="text-muted-foreground">--</span>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "repository",
    id: "repository",
    header: "Repository",
    cell: ({ row }) => {
      const repository = row.original.repository;
      return repository ? (
        <Badge variant="outline" className="text-xs">
          {repository}
        </Badge>
      ) : (
        <span className="text-muted-foreground">--</span>
      );
    },
    size: 100,
    enableSorting: false,
  },
  {
    accessorKey: "baseUrl",
    id: "baseUrl",
    header: "Base URL",
    cell: ({ row }) => {
      const baseUrl = row.original.baseUrl;
      return baseUrl ? (
        <a
          href={baseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline text-sm truncate max-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          {baseUrl.replace(/^https?:\/\//, "")}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="text-muted-foreground">--</span>
      );
    },
    size: 130,
    enableSorting: false,
  },
  {
    accessorKey: "startedAt",
    id: "startedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.startedAt)}
      </span>
    ),
    size: 120,
  },
  {
    accessorKey: "durationMs",
    id: "duration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    cell: ({ row }) => (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {row.original.durationMs ? formatDuration(row.original.durationMs) : "--"}
      </span>
    ),
    size: 80,
  },
  {
    id: "results",
    header: "Results",
    cell: ({ row }) => {
      const pipeline = row.original;
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-green-600 font-medium">{pipeline.passedCount}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-red-600 font-medium">{pipeline.failedCount}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-gray-500">{pipeline.skippedCount}</span>
          {pipeline.flakyCount > 0 && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-yellow-600">{pipeline.flakyCount}</span>
            </>
          )}
          <span className="text-xs text-muted-foreground ml-1">
            ({pipeline.totalTests} total)
          </span>
        </div>
      );
    },
    size: 160,
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const pipeline = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenSheet(pipeline.id)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/results?testRunId=${pipeline.id}`}>
                <ListChecks className="mr-2 h-4 w-4" />
                View Results
              </Link>
            </DropdownMenuItem>
            {pipeline.ciJobUrl && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href={pipeline.ciJobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open CI Job
                  </a>
                </DropdownMenuItem>
              </>
            )}
            {pipeline.reportPath && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openReportUrl(pipeline.id)}>
                  <PlaywrightIcon className="mr-2 h-4 w-4" />
                  View HTML Report
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 50,
    enableSorting: false,
  },
];
