"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, Pencil, Trash2, GitBranch, Globe, Ban } from "lucide-react";
import Link from "next/link";
import { DataTableColumnHeader } from "@/components/data-table";
import { formatDate } from "@/lib/utils/format";
import type { QuarantinedRule } from "@/hooks/queries/use-quarantined";

export interface QuarantinedTableMeta {
  onEdit: (rule: QuarantinedRule) => void;
  onDelete: (rule: QuarantinedRule) => void;
}

function getRuleType(rule: QuarantinedRule): string {
  if (!rule.branchPattern && !rule.envPattern) return "global";
  if (rule.branchPattern && rule.envPattern) return "branch+env";
  if (rule.branchPattern) return "branch";
  if (rule.envPattern) return "env";
  return "unknown";
}

function getRuleTypeLabel(type: string): string {
  switch (type) {
    case "global":
      return "Global";
    case "branch":
      return "Branch";
    case "env":
      return "Environment";
    case "branch+env":
      return "Branch + Env";
    default:
      return "Unknown";
  }
}

function getRuleTypeBadgeVariant(
  type: string
): "destructive" | "secondary" | "outline" | "default" {
  switch (type) {
    case "global":
      return "destructive";
    case "branch":
    case "env":
      return "secondary";
    case "branch+env":
      return "outline";
    default:
      return "default";
  }
}

export const quarantinedColumns: ColumnDef<QuarantinedRule>[] = [
  {
    id: "select",
    size: 40,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "test.testTitle",
    id: "testTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Test" />
    ),
    cell: ({ row }) => {
      const rule = row.original;
      return (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`/dashboard/tests?search=${encodeURIComponent(rule.test.testTitle)}`}
            className="font-medium hover:underline"
          >
            {rule.test.testTitle}
          </Link>
          <span className="text-xs text-muted-foreground truncate max-w-[300px]">
            {rule.test.filePath}
          </span>
        </div>
      );
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: "test.projectName",
    id: "projectName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Project" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.test.projectName}</Badge>
    ),
    size: 100,
    enableSorting: true,
  },
  {
    accessorKey: "branchPattern",
    id: "branchPattern",
    header: () => (
      <div className="flex items-center gap-1">
        <GitBranch className="h-3.5 w-3.5" />
        <span>Branch</span>
      </div>
    ),
    cell: ({ row }) => {
      const pattern = row.original.branchPattern;
      if (!pattern) {
        return <span className="text-muted-foreground text-xs">All</span>;
      }
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
          {pattern}
        </code>
      );
    },
    size: 120,
    enableSorting: false,
  },
  {
    accessorKey: "envPattern",
    id: "envPattern",
    header: () => (
      <div className="flex items-center gap-1">
        <Globe className="h-3.5 w-3.5" />
        <span>Environment</span>
      </div>
    ),
    cell: ({ row }) => {
      const pattern = row.original.envPattern;
      if (!pattern) {
        return <span className="text-muted-foreground text-xs">All</span>;
      }
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
          {pattern}
        </code>
      );
    },
    size: 150,
    enableSorting: false,
  },
  {
    accessorKey: "reason",
    id: "reason",
    header: "Reason",
    cell: ({ row }) => {
      const reason = row.original.reason;
      const ruleType = getRuleType(row.original);
      return (
        <div className="flex items-center gap-2 max-w-[250px]">
          <Badge variant={getRuleTypeBadgeVariant(ruleType)} className="shrink-0">
            {ruleType === "global" && <Ban className="h-3 w-3 mr-1" />}
            {getRuleTypeLabel(ruleType)}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate text-sm">{reason}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{reason}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      );
    },
    size: 250,
    enableSorting: false,
  },
  {
    accessorKey: "createdAt",
    id: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDate(row.original.createdAt)}
      </span>
    ),
    size: 120,
    enableSorting: true,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const rule = row.original;
      const meta = table.options.meta as QuarantinedTableMeta | undefined;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => meta?.onEdit?.(rule)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Rule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => meta?.onDelete?.(rule)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Rule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 50,
    enableSorting: false,
  },
];
