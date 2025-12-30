"use client";

import { useState, useMemo } from "react";
import { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { Search, X, Trash2, CheckCircle, XCircle, ClipboardList } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  DataTableColumnToggle,
  DataTableFacetedFilter,
  DataTableResetFilter,
} from "@/components/data-table";
import { TagFilterPopover } from "@/components/filters";
import { ConfirmationDialog } from "@/components/dialogs";
import { DisableTestDialog } from "@/components/dialogs/disable-test-dialog";
import { RulesSheet } from "@/components/tests/rules-sheet";
import { testColumns, type TestTableMeta } from "./columns";
import { useDataTableUrlState } from "@/hooks";
import { useTests, useTestFilters, useToggleTests, useDeleteTests } from "@/hooks/queries";
import type { TestFilters } from "@/hooks/queries";
import type { DialogState } from "@/types/dialog";
import { dialogActions } from "@/types/dialog";
import type { Test } from "@/types";

export default function TestsPage() {
  const {
    pageIndex,
    sorting,
    sortBy,
    updateUrl,
    onSortingChange,
    onPageChange,
    searchParams,
  } = useDataTableUrlState({
    basePath: "/dashboard/tests",
    defaultSortField: "lastSeenAt",
    defaultSortOrder: "desc",
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [dialogState, setDialogState] = useState<DialogState>({ type: "closed" });
  const [rulesSheetTest, setRulesSheetTest] = useState<Test | null>(null);

  // Parse filters from URL
  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || "";
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];
  const status = searchParams.get("status") || "";
  const health = searchParams.get("health") || "";

  const filters: TestFilters = {
    search: search || undefined,
    repository: repository || undefined,
    project: project || undefined,
    tags: tags || undefined,
    status: status || undefined,
    health: health || undefined,
    sortBy,
    page: pageIndex + 1,
  };

  const { data, isLoading } = useTests(filters);
  const { data: filterOptionsData } = useTestFilters();
  const tests = data?.tests ?? [];
  const pagination = data?.pagination ?? null;
  const filterOptions = filterOptionsData ?? null;

  const toggleMutation = useToggleTests();
  const deleteMutation = useDeleteTests();

  // Get selected IDs from row selection
  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const handleTagsChange = (newTags: string[]) => {
    updateUrl({ tags: newTags.join(",") || undefined });
  };

  const handleEnable = async () => {
    await toggleMutation.mutateAsync({
      testIds: selectedIds,
      enabled: true,
    });
    setRowSelection({});
  };

  const isActionPending = toggleMutation.isPending || deleteMutation.isPending;

  const tableMeta: TestTableMeta = {
    onViewRules: (test) => setRulesSheetTest(test),
  };

  // Build faceted filter options
  const healthFilterOptions = useMemo(
    () => [
      { label: "Healthy", value: "healthy" },
      { label: "Flaky", value: "flaky" },
      { label: "Failing", value: "failing" },
    ],
    []
  );

  const statusFilterOptions = useMemo(
    () => [
      { label: "Enabled", value: "enabled" },
      { label: "Disabled", value: "disabled" },
    ],
    []
  );

  return (
    <TooltipProvider>
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
        <p className="text-muted-foreground">
          Manage your test suite. Enable or disable tests remotely.
        </p>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.length} test{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnable}
              disabled={isActionPending}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              Enable
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogState(dialogActions.disable())}
              disabled={isActionPending}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Disable
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogState(dialogActions.delete())}
              disabled={isActionPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRowSelection({})}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={testColumns}
        data={tests}
        isLoading={isLoading}
        emptyMessage="No tests found"
        emptyIcon={
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50" />
        }
        meta={tableMeta}
        // Pagination
        pageCount={pagination?.totalPages}
        pageIndex={pageIndex}
        pageSize={20}
        total={pagination?.total}
        onPaginationChange={onPageChange}
        // Sorting
        sorting={sorting}
        onSortingChange={onSortingChange}
        // Row selection
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => row.id}
        // Column visibility
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        // Toolbar
        toolbar={(table) => (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 overflow-x-auto pb-2">
              <div className="relative min-w-[200px] max-w-sm shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tests..."
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
                onTagsChange={handleTagsChange}
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
                title="Health"
                options={healthFilterOptions}
                selectedValues={new Set(health ? health.split(",") : [])}
                onSelectionChange={(values) =>
                  updateUrl({ health: Array.from(values).join(",") || undefined })
                }
              />
            </div>

            <DataTableResetFilter
              filterKeys={["search", "repository", "project", "tags", "status", "health"]}
              searchParams={searchParams}
              updateUrl={updateUrl}
            />
            <DataTableColumnToggle table={table} />
          </div>
        )}
      />

      {/* Disable Dialog */}
      {dialogState.type === "disable" && (
        <DisableTestDialog
          open={true}
          onOpenChange={() => setDialogState(dialogActions.close())}
          testCount={selectedIds.length}
          loading={toggleMutation.isPending}
          onConfirm={async ({ reason, branchPattern, envPattern }) => {
            await toggleMutation.mutateAsync({
              testIds: selectedIds,
              enabled: false,
              reason,
              branchPattern,
              envPattern,
            });
            setRowSelection({});
            setDialogState(dialogActions.close());
          }}
        />
      )}

      {/* Delete Dialog */}
      {dialogState.type === "delete" && (
        <ConfirmationDialog
          open={true}
          onOpenChange={() => setDialogState(dialogActions.close())}
          title={`Delete ${selectedIds.length} Test${selectedIds.length > 1 ? "s" : ""}`}
          description="This action cannot be undone. Deleted tests will be removed from the dashboard."
          confirmText="Delete"
          confirmVariant="destructive"
          loading={deleteMutation.isPending}
          requireReason
          reasonPlaceholder="Reason for deleting (required)"
          onConfirm={() => {}}
          onConfirmWithReason={async (reason) => {
            await deleteMutation.mutateAsync({
              testIds: selectedIds,
              reason,
            });
            setRowSelection({});
            setDialogState(dialogActions.close());
          }}
        />
      )}

      {/* Rules Sheet */}
      <RulesSheet
        testId={rulesSheetTest?.id ?? null}
        testTitle={rulesSheetTest?.testTitle}
        onClose={() => setRulesSheetTest(null)}
      />
    </div>
    </TooltipProvider>
  );
}
