"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, X, Trash2, CheckCircle, XCircle } from "lucide-react";

import { HealthBadge } from "@/components/badges";
import { TagFilterPopover } from "@/components/filters";
import { ConfirmationDialog } from "@/components/dialogs";
import { formatDate } from "@/lib/utils/format";
import { useTests, useToggleTests, useDeleteTests } from "@/hooks/queries";
import type { TestFilters } from "@/hooks/queries";
import type { DialogState } from "@/types/dialog";
import { dialogActions } from "@/types/dialog";

export default function TestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogState, setDialogState] = useState<DialogState>({ type: "closed" });

  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || "";
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];
  const status = searchParams.get("status") || "";
  const health = searchParams.get("health") || "";
  const sortBy = searchParams.get("sortBy") || "lastSeenAt";
  const page = parseInt(searchParams.get("page") || "1");

  const filters: TestFilters = {
    search: search || undefined,
    repository: repository || undefined,
    project: project || undefined,
    tags: tags || undefined,
    status: status || undefined,
    health: health || undefined,
    sortBy,
    page,
  };

  const { data, isLoading } = useTests(filters);
  const tests = data?.tests ?? [];
  const pagination = data?.pagination ?? null;
  const filterOptions = data?.filters ?? null;

  const toggleMutation = useToggleTests();
  const deleteMutation = useDeleteTests();

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    if (!updates.page) {
      params.delete("page");
    }
    router.push(`/dashboard/tests?${params.toString()}`);
  };

  const handleTagsChange = (newTags: string[]) => {
    updateUrl({ tags: newTags.join(",") });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(tests.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (testId: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(testId);
    } else {
      newSet.delete(testId);
    }
    setSelectedIds(newSet);
  };

  const handleEnable = async () => {
    await toggleMutation.mutateAsync({
      testIds: Array.from(selectedIds),
      enabled: true,
    });
    setSelectedIds(new Set());
  };

  const allSelected = tests.length > 0 && selectedIds.size === tests.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tests.length;
  const isActionPending = toggleMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
        <p className="text-muted-foreground">
          Manage your test suite. Enable or disable tests remotely.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        <div className="relative min-w-[200px] max-w-sm shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tests..."
            value={search}
            onChange={(e) => updateUrl({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select value={repository} onValueChange={(v) => updateUrl({ repository: v === "all" ? "" : v })}>
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

        <Select value={project} onValueChange={(v) => updateUrl({ project: v === "all" ? "" : v })}>
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

        <Select value={status} onValueChange={(v) => updateUrl({ status: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[130px] shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={health} onValueChange={(v) => updateUrl({ health: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[130px] shrink-0">
            <SelectValue placeholder="Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="flaky">Flaky</SelectItem>
            <SelectItem value="failing">Failing</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => updateUrl({ sortBy: v })}>
          <SelectTrigger className="w-[150px] shrink-0">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastSeenAt">Last Seen</SelectItem>
            <SelectItem value="lastRunAt">Last Run</SelectItem>
            <SelectItem value="healthScore">Health Score</SelectItem>
            <SelectItem value="passRate">Pass Rate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} test{selectedIds.size > 1 ? "s" : ""} selected
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
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  {...(someSelected ? { "data-state": "indeterminate" } : {})}
                />
              </TableHead>
              <TableHead className="min-w-[200px]">Test</TableHead>
              <TableHead className="w-[100px]">Project</TableHead>
              <TableHead className="w-[80px]">Health</TableHead>
              <TableHead className="w-[70px]">Pass Rate</TableHead>
              <TableHead className="w-[120px]">Last Run</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : tests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No tests found
                </TableCell>
              </TableRow>
            ) : (
              tests.map((test) => (
                <TableRow key={test.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(test.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(test.id, checked as boolean)
                      }
                      aria-label={`Select ${test.testTitle}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{test.testTitle}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[400px]">
                        {test.filePath}
                      </span>
                      {test.tags && test.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {test.tags.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                            >
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
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{test.projectName}</Badge>
                  </TableCell>
                  <TableCell>
                    <HealthBadge score={test.health?.healthScore} />
                  </TableCell>
                  <TableCell>
                    {test.health ? `${Number(test.health.passRate).toFixed(0)}%` : "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(test.health?.lastRunAt || null)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={test.isEnabled ? "default" : "secondary"}>
                      {test.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} tests
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateUrl({ page: (page - 1).toString() })}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateUrl({ page: (page + 1).toString() })}
              disabled={page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Disable Dialog */}
      {dialogState.type === "disable" && (
        <ConfirmationDialog
          open={true}
          onOpenChange={() => setDialogState(dialogActions.close())}
          title={`Disable ${selectedIds.size} Test${selectedIds.size > 1 ? "s" : ""}`}
          description="Disabled tests will be automatically skipped during test runs."
          confirmText="Disable"
          loading={toggleMutation.isPending}
          requireReason
          reasonPlaceholder="Reason for disabling (required)"
          onConfirm={() => {}}
          onConfirmWithReason={async (reason) => {
            await toggleMutation.mutateAsync({
              testIds: Array.from(selectedIds),
              enabled: false,
              reason,
            });
            setSelectedIds(new Set());
            setDialogState(dialogActions.close());
          }}
        />
      )}

      {/* Delete Dialog */}
      {dialogState.type === "delete" && (
        <ConfirmationDialog
          open={true}
          onOpenChange={() => setDialogState(dialogActions.close())}
          title={`Delete ${selectedIds.size} Test${selectedIds.size > 1 ? "s" : ""}`}
          description="This action cannot be undone. Deleted tests will be removed from the dashboard."
          confirmText="Delete"
          confirmVariant="destructive"
          loading={deleteMutation.isPending}
          requireReason
          reasonPlaceholder="Reason for deleting (required)"
          onConfirm={() => {}}
          onConfirmWithReason={async (reason) => {
            await deleteMutation.mutateAsync({
              testIds: Array.from(selectedIds),
              reason,
            });
            setSelectedIds(new Set());
            setDialogState(dialogActions.close());
          }}
        />
      )}
    </div>
  );
}
