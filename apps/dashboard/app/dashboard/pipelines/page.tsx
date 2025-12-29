"use client";

import { useState } from "react";
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
import { pipelineColumns } from "./columns";
import { useDataTableUrlState } from "@/hooks";
import { usePipelines } from "@/hooks/queries";
import type { PipelineFilters } from "@/hooks/queries";

export default function PipelinesPage() {
  const {
    pageIndex,
    sorting,
    sortBy,
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

  const filters: PipelineFilters = {
    search: search || undefined,
    repository: repository || undefined,
    branch: branch || undefined,
    status: status || undefined,
    sortBy,
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

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">
            View CI pipeline runs and their test results.
          </p>
        </div>

        {/* DataTable with toolbar */}
        <DataTable
          columns={pipelineColumns}
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
          // Toolbar
          toolbar={(table) => (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 overflow-x-auto pb-2">
                <div className="relative min-w-[200px] max-w-sm shrink-0">
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
                  value={branch}
                  onValueChange={(v) =>
                    updateUrl({ branch: v === "all" ? undefined : v })
                  }
                >
                  <SelectTrigger className="w-[150px] shrink-0">
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

              <DataTableColumnToggle table={table} />
            </div>
          )}
        />
      </div>
    </TooltipProvider>
  );
}
