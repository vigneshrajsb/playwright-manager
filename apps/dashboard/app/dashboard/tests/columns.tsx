"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ListChecks } from "lucide-react";
import Link from "next/link";
import { HealthBadge } from "@/components/badges";
import { DataTableColumnHeader } from "@/components/data-table";
import { formatDate } from "@/lib/utils/format";
import type { Test } from "@/types";

export const testColumns: ColumnDef<Test>[] = [
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
    accessorKey: "testTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Test" />
    ),
    cell: ({ row }) => {
      const test = row.original;
      return (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{test.testTitle}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[400px]">
            {test.filePath}
          </span>
          {test.tags && test.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {test.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          {!test.isEnabled && test.disabledReason && (
            <span className="text-xs text-red-500">
              Reason: {test.disabledReason}
            </span>
          )}
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "projectName",
    id: "projectName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Project" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("projectName")}</Badge>
    ),
    size: 100,
    enableSorting: false,
  },
  {
    accessorKey: "health.healthScore",
    id: "healthScore",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Health" />
    ),
    cell: ({ row }) => <HealthBadge score={row.original.health?.healthScore} />,
    size: 80,
  },
  {
    accessorKey: "health.passRate",
    id: "passRate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pass Rate" />
    ),
    cell: ({ row }) => {
      const health = row.original.health;
      return health ? `${Number(health.passRate).toFixed(0)}%` : "--";
    },
    size: 70,
  },
  {
    accessorKey: "health.lastRunAt",
    id: "lastRunAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Run" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.health?.lastRunAt || null)}
      </span>
    ),
    size: 120,
  },
  {
    accessorKey: "isEnabled",
    id: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const isEnabled = row.original.isEnabled;
      return (
        <Badge variant={isEnabled ? "default" : "secondary"}>
          {isEnabled ? "Enabled" : "Disabled"}
        </Badge>
      );
    },
    size: 80,
    enableSorting: false,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const test = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/results?testId=${test.id}`}>
                <ListChecks className="mr-2 h-4 w-4" />
                View Results
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 50,
    enableSorting: false,
  },
];
