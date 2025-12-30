"use client";

import { useState, useMemo } from "react";
import { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { Search, X, Trash2, ShieldBan } from "lucide-react";
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
import { ConfirmationDialog } from "@/components/dialogs";
import { EditRuleSheet } from "@/components/quarantined/edit-rule-sheet";
import { quarantinedColumns, type QuarantinedTableMeta } from "./columns";
import { useDataTableUrlState } from "@/hooks";
import {
  useQuarantinedRules,
  useDeleteQuarantinedRule,
  useBulkDeleteQuarantined,
  type QuarantinedRule,
} from "@/hooks/queries";
import type { QuarantinedFilters } from "@/hooks/queries";

export default function QuarantinedPage() {
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
    basePath: "/dashboard/quarantined",
    defaultSortField: "createdAt",
    defaultSortOrder: "desc",
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [editRule, setEditRule] = useState<QuarantinedRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<QuarantinedRule | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // Parse filters from URL
  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const ruleType = searchParams.get("ruleType") || "";

  const filters: QuarantinedFilters = {
    search: search || undefined,
    repository: repository || undefined,
    project: project || undefined,
    ruleType: ruleType || undefined,
    sortBy,
    sortOrder,
    page: pageIndex + 1,
  };

  const { data, isLoading } = useQuarantinedRules(filters);
  const deleteMutation = useDeleteQuarantinedRule();
  const bulkDeleteMutation = useBulkDeleteQuarantined();

  const rules = data?.rules ?? [];
  const pagination = data?.pagination ?? null;
  const filterOptions = data?.filters ?? null;

  // Get selected IDs from row selection
  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const handleDelete = async () => {
    if (!deleteRule) return;
    deleteMutation.mutate(deleteRule.id, {
      onSuccess: () => {
        setDeleteRule(null);
      },
    });
  };

  const handleBulkDelete = async () => {
    await bulkDeleteMutation.mutateAsync({ ruleIds: selectedIds });
    setRowSelection({});
    setShowBulkDelete(false);
  };

  const isActionPending = deleteMutation.isPending || bulkDeleteMutation.isPending;

  const tableMeta: QuarantinedTableMeta = {
    onEdit: (rule) => setEditRule(rule),
    onDelete: (rule) => setDeleteRule(rule),
  };

  // Build faceted filter options for rule type
  const ruleTypeFilterOptions = useMemo(
    () => [
      { label: "Global", value: "global" },
      { label: "Branch Only", value: "branch" },
      { label: "Environment Only", value: "env" },
      { label: "Branch + Env", value: "branch+env" },
    ],
    []
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quarantined</h1>
          <p className="text-muted-foreground">
            View and manage all skip rules. Tests with skip rules are disabled.
          </p>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
            <span className="text-sm font-medium">
              {selectedIds.length} rule{selectedIds.length > 1 ? "s" : ""} selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDelete(true)}
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
          columns={quarantinedColumns}
          data={rules}
          isLoading={isLoading}
          emptyMessage="No quarantined tests"
          emptyIcon={
            <ShieldBan className="h-10 w-10 mx-auto text-muted-foreground/50" />
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
                    placeholder="Search rules..."
                    value={search}
                    onChange={(e) =>
                      updateUrl({ search: e.target.value || undefined })
                    }
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

                <DataTableFacetedFilter
                  title="Rule Type"
                  options={ruleTypeFilterOptions}
                  selectedValues={new Set(ruleType ? ruleType.split(",") : [])}
                  onSelectionChange={(values) =>
                    updateUrl({
                      ruleType: Array.from(values).join(",") || undefined,
                    })
                  }
                />
              </div>

              <DataTableResetFilter
                filterKeys={["search", "repository", "project", "ruleType"]}
                searchParams={searchParams}
                updateUrl={updateUrl}
              />
              <DataTableColumnToggle table={table} />
            </div>
          )}
        />

        {/* Edit Rule Sheet */}
        <EditRuleSheet rule={editRule} onClose={() => setEditRule(null)} />

        {/* Single Delete Dialog */}
        <ConfirmationDialog
          open={!!deleteRule}
          onOpenChange={(open) => !open && setDeleteRule(null)}
          title="Delete Skip Rule"
          description={
            <>
              Are you sure you want to delete this skip rule? The test will be
              re-enabled.
              {deleteRule && (
                <span className="block mt-2 font-medium text-foreground">
                  &quot;{deleteRule.reason}&quot;
                </span>
              )}
            </>
          }
          confirmText="Delete"
          confirmVariant="destructive"
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
        />

        {/* Bulk Delete Dialog */}
        <ConfirmationDialog
          open={showBulkDelete}
          onOpenChange={(open) => !open && setShowBulkDelete(false)}
          title={`Delete ${selectedIds.length} Rule${selectedIds.length > 1 ? "s" : ""}`}
          description="Are you sure you want to delete these skip rules? The affected tests will be re-enabled."
          confirmText="Delete"
          confirmVariant="destructive"
          loading={bulkDeleteMutation.isPending}
          onConfirm={handleBulkDelete}
        />
      </div>
    </TooltipProvider>
  );
}
