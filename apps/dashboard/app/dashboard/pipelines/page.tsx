"use client";

import { useState, useMemo, useCallback } from "react";
import { VisibilityState } from "@tanstack/react-table";
import { Search, GitPullRequest } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DataTable,
  DataTableColumnToggle,
  DataTableFacetedFilter,
} from "@/components/data-table";
import { TimeRangePicker } from "@/components/time-range-picker";
import { PipelineSheet } from "@/components/pipelines/pipeline-sheet";
import { pipelineColumns } from "./columns";
import { useDataTableUrlState } from "@/hooks";
import { usePipelines } from "@/hooks/queries";
import type { PipelineFilters } from "@/hooks/queries";
import { DEFAULT_TIME_RANGE } from "@/lib/utils/time-range";

export default function PipelinesPage() {
  const {
    pageIndex,
    sorting,
    sortBy,
    sortOrder,
    updateUrl,
    onSortingChange,
    onPageChange,
    searchParams,
  } = useDataTableUrlState({
    basePath: "/dashboard/pipelines",
    defaultSortField: "startedAt",
    defaultSortOrder: "desc",
  });

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Parse filters from URL
  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const branch = searchParams.get("branch") || "";
  const status = searchParams.get("status") || "";
  const timeRange = searchParams.get("timeRange") || "";
  const filterStartDate = searchParams.get("startDate") || "";
  const filterEndDate = searchParams.get("endDate") || "";
  const selectedPipelineId = searchParams.get("pipelineId") || null;

  const openPipelineSheet = useCallback(
    (id: string) => updateUrl({ pipelineId: id }),
    [updateUrl]
  );

  const closePipelineSheet = useCallback(
    () => updateUrl({ pipelineId: undefined }),
    [updateUrl]
  );

  const handleTimeRangeChange = useCallback(
    (newTimeRange: string) => {
      updateUrl({
        timeRange: newTimeRange,
        startDate: undefined,
        endDate: undefined,
      });
    },
    [updateUrl]
  );

  const handleDateRangeChange = useCallback(
    (newStartDate: string, newEndDate: string) => {
      updateUrl({
        timeRange: undefined,
        startDate: newStartDate,
        endDate: newEndDate,
      });
    },
    [updateUrl]
  );

  const filters: PipelineFilters = {
    search: search || undefined,
    repository: repository || undefined,
    branch: branch || undefined,
    status: status || undefined,
    timeRange: timeRange || DEFAULT_TIME_RANGE,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
    sortBy,
    sortOrder,
    page: pageIndex + 1,
  };

  const { data, isLoading } = usePipelines(filters);
  const pipelines = data?.pipelines ?? [];
  const pagination = data?.pagination ?? null;
  const filterOptions = data?.filters ?? null;

  // Build faceted filter options
  const statusFilterOptions = (filterOptions?.statuses || []).map((s) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    value: s,
  }));

  // Memoize columns with the callback
  const columns = useMemo(() => pipelineColumns(openPipelineSheet), [openPipelineSheet]);

  return (
    <TooltipProvider>
      <div className="space-y-4 overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">
            View CI pipeline runs and their test results.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={pipelines}
          isLoading={isLoading}
          emptyMessage="No pipelines found"
          emptyIcon={
            <GitPullRequest className="h-10 w-10 mx-auto text-muted-foreground/50" />
          }
          // Pagination
          pageCount={pagination?.totalPages}
          pageIndex={pageIndex}
          pageSize={20}
          total={pagination?.total}
          onPaginationChange={onPageChange}
          // Sorting
          sorting={sorting}
          onSortingChange={onSortingChange}
          // Column visibility
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          getRowId={(row) => row.id}
          // Row click
          onRowClick={(row) => openPipelineSheet(row.id)}
          // Highlight selected row
          highlightedRowId={selectedPipelineId || undefined}
          // Toolbar
          toolbar={(table) => (
            <div className="flex items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-center gap-3 flex-1 min-w-0 overflow-x-auto">
                <div className="relative min-w-[160px] max-w-sm shrink-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by branch, commit, URL..."
                    value={search}
                    onChange={(e) => updateUrl({ search: e.target.value || undefined })}
                    className="pl-9"
                  />
                </div>

                <Select
                  value={repository}
                  onValueChange={(v) =>
                    updateUrl({ repository: v === "all" ? undefined : v })
                  }
                >
                  <SelectTrigger className="w-[150px] shrink-0">
                    <SelectValue placeholder="Repository" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Repositories</SelectItem>
                    {filterOptions?.repositories?.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={branch}
                  onValueChange={(v) =>
                    updateUrl({ branch: v === "all" ? undefined : v })
                  }
                >
                  <SelectTrigger className="w-[130px] shrink-0">
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {filterOptions?.branches?.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <DataTableFacetedFilter
                  title="Status"
                  options={statusFilterOptions}
                  selectedValues={new Set(status ? status.split(",") : [])}
                  onSelectionChange={(values) =>
                    updateUrl({ status: Array.from(values).join(",") || undefined })
                  }
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <TimeRangePicker
                  timeRange={timeRange || DEFAULT_TIME_RANGE}
                  startDate={filterStartDate}
                  endDate={filterEndDate}
                  onTimeRangeChange={handleTimeRangeChange}
                  onDateRangeChange={handleDateRangeChange}
                />
                <DataTableColumnToggle table={table} />
              </div>
            </div>
          )}
        />

        {/* Pipeline Detail Sheet */}
        <PipelineSheet pipelineId={selectedPipelineId} onClose={closePipelineSheet} />
      </div>
    </TooltipProvider>
  );
}
