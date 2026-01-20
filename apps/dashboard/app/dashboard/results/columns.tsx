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
import { Clock, GitBranch, MoreHorizontal, ExternalLink } from "lucide-react";
import { PlaywrightIcon } from "@/components/icons/playwright-icon";
import { DataTableColumnHeader } from "@/components/data-table";
import { StatusBadgeWithTooltip } from "@/components/badges";
import { formatDate, formatDuration } from "@/lib/utils/format";
import { openReportUrl } from "@/lib/utils/report";
import type { TestResult } from "@/types";

export const resultColumns = (
  onOpenSheet: (id: string) => void
): ColumnDef<TestResult>[] => [
  {
    accessorKey: "test.testTitle",
    id: "test",
    header: "Test",
    cell: ({ row }) => {
      const result = row.original;
      return (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{result.test.testTitle}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[350px]">
            {result.test.filePath}
          </span>
          {result.test.tags && result.test.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.test.tags.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0">
                  {t}
                </Badge>
              ))}
              {result.test.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  +{result.test.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "test.projectName",
    id: "project",
    header: "Project",
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.test.projectName}</Badge>
    ),
    size: 90,
    enableSorting: false,
  },
  {
    accessorKey: "status",
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadgeWithTooltip
        status={row.original.status}
        expectedStatus={row.original.expectedStatus}
        outcome={row.original.outcome}
      />
    ),
    size: 80,
    enableSorting: false,
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
        {formatDuration(row.original.durationMs)}
      </span>
    ),
    size: 80,
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
          className="flex items-center gap-1 text-primary hover:underline text-sm truncate max-w-[120px]"
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
    accessorKey: "run.branch",
    id: "runInfo",
    header: "Run Info",
    cell: ({ row }) => {
      const run = row.original.run;
      return (
        <div className="flex flex-col gap-0.5 text-xs">
          {run.branch && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              {run.branch}
            </span>
          )}
          {run.commitSha && (
            <code className="text-muted-foreground">
              {run.commitSha.slice(0, 7)}
            </code>
          )}
        </div>
      );
    },
    size: 120,
    enableSorting: false,
  },
  {
    accessorKey: "startedAt",
    id: "startedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started At" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.startedAt)}
      </span>
    ),
    size: 130,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const result = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenSheet(result.id)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            {result.run.reportPath && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    openReportUrl(result.run.id, result.test.playwrightTestId)
                  }
                >
                  <PlaywrightIcon className="mr-2 h-4 w-4" />
                  View in Report
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
