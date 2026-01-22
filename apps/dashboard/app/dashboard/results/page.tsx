"use client";

import { useState, useMemo, useCallback } from "react";
import { VisibilityState } from "@tanstack/react-table";
import { Search, GitBranch, X, ClipboardList, FlaskConical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DataTable,
  DataTableColumnToggle,
  DataTableFacetedFilter,
} from "@/components/data-table";
import { ResultSheet } from "@/components/results/result-sheet";
import { TagFilterPopover } from "@/components/filters";
import { TimeRangePicker } from "@/components/time-range-picker";
import { resultColumns } from "./columns";
import { useDataTableUrlState } from "@/hooks";
import { DEFAULT_TIME_RANGE } from "@/lib/utils/time-range";
import { useResults } from "@/hooks/queries";
import type { ResultFilters } from "@/hooks/queries";

export default function ResultsPage() {
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
    basePath: "/dashboard/results",
    defaultSortField: "startedAt",
    defaultSortOrder: "desc",
  });

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Parse filters from URL
  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || "";
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];
  const status = searchParams.get("status") || "";
  const outcome = searchParams.get("outcome") || "";
  const testRunId = searchParams.get("testRunId") || "";
  const testId = searchParams.get("testId") || "";
  const selectedResultId = searchParams.get("resultId") || null;
  const timeRange = searchParams.get("timeRange") || "";
  const filterStartDate = searchParams.get("startDate") || "";
  const filterEndDate = searchParams.get("endDate") || "";

  const filters: ResultFilters = {
    search: search || undefined,
    repository: repository || undefined,
    project: project || undefined,
    tags: tags || undefined,
    status: status || undefined,
    outcome: outcome || undefined,
    testRunId: testRunId || undefined,
    testId: testId || undefined,
    timeRange: timeRange || DEFAULT_TIME_RANGE,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
    sortBy,
    sortOrder,
    page: pageIndex + 1,
  };

  const { data, isLoading } = useResults(filters);
  const results = data?.results ?? [];
  const pagination = data?.pagination ?? null;
  const filterOptions = data?.filters ?? null;
  const runInfo = data?.runInfo ?? null;
  const testInfo = data?.testInfo ?? null;

  const clearRunFilter = () => {
    updateUrl({ testRunId: undefined });
  };

  const clearTestFilter = () => {
    updateUrl({ testId: undefined });
  };

  const openResultSheet = useCallback(
    (id: string) => updateUrl({ resultId: id }),
    [updateUrl]
  );

  const closeResultSheet = useCallback(
    () => updateUrl({ resultId: undefined }),
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

  // Build faceted filter options
  const statusFilterOptions = useMemo(
    () =>
      (filterOptions?.statuses || []).map((s) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        value: s,
      })),
    [filterOptions?.statuses]
  );

  const outcomeFilterOptions = useMemo(
    () =>
      (filterOptions?.outcomes || []).map((o) => ({
        label: o.charAt(0).toUpperCase() + o.slice(1),
        value: o,
      })),
    [filterOptions?.outcomes]
  );

  // Memoize columns with the callback
  const columns = useMemo(() => resultColumns(openResultSheet), [openResultSheet]);

  return (
    <TooltipProvider>
      <div className="space-y-4 overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>
          <p className="text-muted-foreground">
            View individual test execution results across all runs.
          </p>
        </div>

        {runInfo && (
          <Alert className="flex items-center justify-between">
            <AlertDescription className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              <span>
                Showing results from run:{" "}
                <span className="font-medium">
                  {runInfo.branch || "unknown branch"}
                </span>
                {runInfo.commitSha && (
                  <code className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                    {runInfo.commitSha.slice(0, 7)}
                  </code>
                )}
                <span className="ml-2 text-muted-foreground">
                  ({runInfo.passedCount}/{runInfo.totalTests} passed)
                </span>
              </span>
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearRunFilter}
              className="h-auto p-1"
            >
              <X className="h-4 w-4" />
              <span className="ml-1">Clear filter</span>
            </Button>
          </Alert>
        )}

        {testInfo && (
          <Alert className="flex items-center justify-between">
            <AlertDescription className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              <span>
                Showing results for test:{" "}
                <span className="font-medium">{testInfo.testTitle}</span>
                <span className="ml-2 text-muted-foreground">
                  ({testInfo.projectName})
                </span>
              </span>
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearTestFilter}
              className="h-auto p-1"
            >
              <X className="h-4 w-4" />
              <span className="ml-1">Clear filter</span>
            </Button>
          </Alert>
        )}

        <DataTable
          columns={columns}
          data={results}
          isLoading={isLoading}
          emptyMessage="No results found"
          emptyIcon={
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50" />
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
          onRowClick={(row) => openResultSheet(row.id)}
          // Highlight selected row
          highlightedRowId={selectedResultId || undefined}
          // Toolbar
          toolbar={(table) => (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                <div className="relative min-w-[200px] max-w-sm shrink-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by test, path, URL..."
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
                  <SelectTrigger className="w-[180px] shrink-0">
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
                  value={project}
                  onValueChange={(v) =>
                    updateUrl({ project: v === "all" ? undefined : v })
                  }
                >
                  <SelectTrigger className="w-[150px] shrink-0">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {filterOptions?.projects?.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <TagFilterPopover
                  tags={filterOptions?.tags || []}
                  selectedTags={selectedTags}
                  onTagsChange={(newTags) =>
                    updateUrl({ tags: newTags.join(",") || undefined })
                  }
                />

                <DataTableFacetedFilter
                  title="Status"
                  options={statusFilterOptions}
                  selectedValues={new Set(status ? status.split(",") : [])}
                  onSelectionChange={(values) =>
                    updateUrl({ status: Array.from(values).join(",") || undefined })
                  }
                />

                <DataTableFacetedFilter
                  title="Outcome"
                  options={outcomeFilterOptions}
                  selectedValues={new Set(outcome ? outcome.split(",") : [])}
                  onSelectionChange={(values) =>
                    updateUrl({ outcome: Array.from(values).join(",") || undefined })
                  }
                />
              </div>

              <TimeRangePicker
                timeRange={timeRange || DEFAULT_TIME_RANGE}
                startDate={filterStartDate}
                endDate={filterEndDate}
                onTimeRangeChange={handleTimeRangeChange}
                onDateRangeChange={handleDateRangeChange}
              />
              <DataTableColumnToggle table={table} />
            </div>
          )}
        />

        {/* Result Detail Sheet */}
        <ResultSheet resultId={selectedResultId} onClose={closeResultSheet} />
      </div>
    </TooltipProvider>
  );
}
