"use client";

import { useState, useMemo } from "react";
import { Search, Loader2, ShieldBan } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTableFacetedFilter,
  DataTableResetFilter,
  DataTablePagination,
} from "@/components/data-table";
import { ConfirmationDialog } from "@/components/dialogs";
import { EditRuleDialog } from "@/components/quarantined/edit-rule-dialog";
import { QuarantineRuleCard } from "@/components/quarantined/quarantine-rule-card";
import { useDataTableUrlState, useTimeRangeUrl } from "@/hooks";
import {
  useQuarantinedRules,
  useDeleteQuarantinedRule,
  type QuarantinedRule,
} from "@/hooks/queries";
import type { QuarantinedFilters } from "@/hooks/queries";

export default function QuarantinedPage() {
  const {
    pageIndex,
    sortBy,
    sortOrder,
    updateUrl,
    onPageChange,
    searchParams,
  } = useDataTableUrlState({
    basePath: "/quarantined",
    defaultSortField: "createdAt",
    defaultSortOrder: "desc",
  });

  const [editRule, setEditRule] = useState<QuarantinedRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<QuarantinedRule | null>(null);

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
  const { buildUrl } = useTimeRangeUrl();
  const deleteMutation = useDeleteQuarantinedRule();

  const rules = data?.rules ?? [];
  const pagination = data?.pagination ?? null;
  const filterOptions = data?.filters ?? null;

  const handleDelete = async () => {
    if (!deleteRule) return;
    deleteMutation.mutate(deleteRule.id, {
      onSuccess: () => {
        setDeleteRule(null);
      },
    });
  };

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

        {/* Filters */}
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
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <ShieldBan className="h-10 w-10 opacity-50" />
            <p className="text-sm">No quarantined tests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <QuarantineRuleCard
                key={rule.id}
                rule={rule}
                testUrl={buildUrl("/tests", { testId: rule.test.id })}
                onEdit={(r) => setEditRule(r)}
                onDelete={(r) => setDeleteRule(r)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 0 && (
          <DataTablePagination
            pageIndex={pageIndex}
            pageCount={pagination.totalPages}
            pageSize={20}
            total={pagination.total}
            onPageChange={onPageChange}
          />
        )}

        <EditRuleDialog
          rule={editRule}
          testTitle={editRule?.test.testTitle}
          onClose={() => setEditRule(null)}
        />

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
      </div>
    </TooltipProvider>
  );
}
