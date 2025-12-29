"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, X, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Shared components
import { HealthBadge } from "@/components/badges";
import { TagFilterPopover } from "@/components/filters";
import { ConfirmationDialog, BulkConfirmationDialog } from "@/components/dialogs";

// Shared utilities
import { formatDate } from "@/lib/utils/format";

// Shared types
import type { Test, Pagination, TestFiltersData } from "@/types";

export default function TestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tests, setTests] = useState<Test[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filters, setFilters] = useState<TestFiltersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Bulk disable dialog state
  const [bulkDisableOpen, setBulkDisableOpen] = useState(false);
  const [bulkDisabling, setBulkDisabling] = useState(false);

  // Single test disable dialog state
  const [singleDisableOpen, setSingleDisableOpen] = useState(false);
  const [singleDisableTestId, setSingleDisableTestId] = useState<string | null>(null);
  const [singleDisableTestTitle, setSingleDisableTestTitle] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTestId, setDeleteTestId] = useState<string | null>(null);
  const [deleteTestTitle, setDeleteTestTitle] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Bulk delete dialog state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Filter state from URL
  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || ""; // comma-separated
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];
  const status = searchParams.get("status") || "";
  const health = searchParams.get("health") || "";
  const sortBy = searchParams.get("sortBy") || "lastSeenAt";
  const page = parseInt(searchParams.get("page") || "1");

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (repository) params.set("repository", repository);
      if (project) params.set("project", project);
      if (tags) params.set("tags", tags);
      if (status) params.set("status", status);
      if (health) params.set("health", health);
      if (sortBy) params.set("sortBy", sortBy);
      params.set("page", page.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/tests?${params.toString()}`);
      const data = await response.json();

      setTests(data.tests || []);
      setPagination(data.pagination);
      setFilters(data.filters);
    } catch (error) {
      console.error("Failed to fetch tests:", error);
      toast.error("Failed to load tests");
    } finally {
      setLoading(false);
    }
  }, [search, repository, project, tags, status, health, sortBy, page]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    // Reset to page 1 when filters change
    if (!updates.page) {
      params.delete("page");
    }
    router.push(`/dashboard/tests?${params.toString()}`);
  };

  const handleTagsChange = (newTags: string[]) => {
    updateUrl({ tags: newTags.join(",") });
  };

  const toggleTest = async (testId: string, enabled: boolean, reason?: string) => {
    setTogglingId(testId);
    try {
      const response = await fetch(`/api/tests/${testId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, reason }),
      });

      if (response.ok) {
        setTests((prev) =>
          prev.map((t) =>
            t.id === testId
              ? { ...t, isEnabled: enabled, disabledReason: enabled ? null : reason || null }
              : t
          )
        );
        toast.success(enabled ? "Test enabled" : "Test disabled");
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || "Failed to toggle test");
      }
    } catch (error) {
      console.error("Failed to toggle test:", error);
      toast.error("Failed to toggle test");
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleSwitch = (test: Test, enabled: boolean) => {
    if (enabled) {
      // Enable directly without confirmation
      toggleTest(test.id, true);
    } else {
      // Show confirmation dialog for disabling
      setSingleDisableTestId(test.id);
      setSingleDisableTestTitle(test.testTitle);
      setSingleDisableOpen(true);
    }
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

  const handleBulkEnable = async () => {
    setBulkDisabling(true);
    const count = selectedIds.size;
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/tests/${id}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        })
      );
      await Promise.all(promises);
      await fetchTests();
      setSelectedIds(new Set());
      toast.success(`${count} test${count > 1 ? "s" : ""} enabled`);
    } catch (error) {
      console.error("Failed to bulk enable:", error);
      toast.error("Failed to enable tests");
    } finally {
      setBulkDisabling(false);
    }
  };

  const handleDeleteClick = (test: Test) => {
    setDeleteTestId(test.id);
    setDeleteTestTitle(test.testTitle);
    setDeleteDialogOpen(true);
  };

  const allSelected = tests.length > 0 && selectedIds.size === tests.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < tests.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
        <p className="text-muted-foreground">
          Manage your test suite. Enable or disable tests remotely.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tests..."
            value={search}
            onChange={(e) => updateUrl({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select value={repository} onValueChange={(v) => updateUrl({ repository: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Repository" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Repositories</SelectItem>
            {filters?.repositories?.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={project} onValueChange={(v) => updateUrl({ project: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {filters?.projects?.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TagFilterPopover
          tags={filters?.tags || []}
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
        />

        <Select value={status} onValueChange={(v) => updateUrl({ status: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={health} onValueChange={(v) => updateUrl({ health: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[130px]">
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
          <SelectTrigger className="w-[150px]">
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
              onClick={handleBulkEnable}
              disabled={bulkDisabling}
            >
              Enable Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDisableOpen(true)}
              disabled={bulkDisabling}
            >
              Disable Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete Selected
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
              <TableHead className="w-[70px]">Enabled</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : tests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                    <Switch
                      checked={test.isEnabled}
                      onCheckedChange={(enabled) => handleToggleSwitch(test, enabled)}
                      disabled={togglingId === test.id}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleDeleteClick(test)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {/* Bulk Disable Dialog */}
      <BulkConfirmationDialog
        open={bulkDisableOpen}
        onOpenChange={setBulkDisableOpen}
        count={selectedIds.size}
        action="disable"
        description="Disabled tests will be automatically skipped during test runs."
        loading={bulkDisabling}
        requireReason
        reasonPlaceholder="Reason for disabling (required)"
        onConfirm={() => {}}
        onConfirmWithReason={async (reason) => {
          setBulkDisabling(true);
          const count = selectedIds.size;
          try {
            const promises = Array.from(selectedIds).map((id) =>
              fetch(`/api/tests/${id}/toggle`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: false, reason }),
              })
            );
            await Promise.all(promises);
            await fetchTests();
            setSelectedIds(new Set());
            setBulkDisableOpen(false);
            toast.success(`${count} test${count > 1 ? "s" : ""} disabled`);
          } catch (error) {
            console.error("Failed to bulk disable:", error);
            toast.error("Failed to disable tests");
          } finally {
            setBulkDisabling(false);
          }
        }}
      />

      {/* Single Test Disable Dialog */}
      <ConfirmationDialog
        open={singleDisableOpen}
        onOpenChange={(open) => {
          setSingleDisableOpen(open);
          if (!open) {
            setSingleDisableTestId(null);
            setSingleDisableTestTitle("");
          }
        }}
        title="Disable Test"
        description={
          <>
            <span className="font-medium text-foreground">{singleDisableTestTitle}</span>
            <br />
            This test will be automatically skipped during test runs.
          </>
        }
        confirmText="Disable Test"
        loading={togglingId === singleDisableTestId}
        requireReason
        reasonPlaceholder="Reason for disabling (required)"
        onConfirm={() => {}}
        onConfirmWithReason={async (reason) => {
          if (!singleDisableTestId) return;
          await toggleTest(singleDisableTestId, false, reason);
          setSingleDisableOpen(false);
          setSingleDisableTestId(null);
          setSingleDisableTestTitle("");
        }}
      />

      {/* Delete Test Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTestId(null);
            setDeleteTestTitle("");
          }
        }}
        title="Delete Test"
        description={
          <>
            <span className="font-medium text-foreground">{deleteTestTitle}</span>
            <br />
            This action cannot be undone.
          </>
        }
        confirmText="Delete Test"
        confirmVariant="destructive"
        loading={deleting}
        requireReason
        reasonPlaceholder="Reason for deleting (required)"
        onConfirm={() => {}}
        onConfirmWithReason={async (reason) => {
          if (!deleteTestId) return;
          setDeleting(true);
          try {
            const response = await fetch(`/api/tests/${deleteTestId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            });
            if (response.ok) {
              await fetchTests();
              setDeleteDialogOpen(false);
              setDeleteTestId(null);
              setDeleteTestTitle("");
              toast.success("Test deleted");
            } else {
              const data = await response.json().catch(() => ({}));
              toast.error(data.error || "Failed to delete test");
            }
          } catch (error) {
            console.error("Failed to delete test:", error);
            toast.error("Failed to delete test");
          } finally {
            setDeleting(false);
          }
        }}
      />

      {/* Bulk Delete Dialog */}
      <BulkConfirmationDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedIds.size}
        action="delete"
        confirmVariant="destructive"
        loading={bulkDeleting}
        requireReason
        reasonPlaceholder="Reason for deleting (required)"
        onConfirm={() => {}}
        onConfirmWithReason={async (reason) => {
          setBulkDeleting(true);
          const count = selectedIds.size;
          try {
            const promises = Array.from(selectedIds).map((id) =>
              fetch(`/api/tests/${id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
              })
            );
            await Promise.all(promises);
            await fetchTests();
            setSelectedIds(new Set());
            setBulkDeleteOpen(false);
            toast.success(`${count} test${count > 1 ? "s" : ""} deleted`);
          } catch (error) {
            console.error("Failed to bulk delete:", error);
            toast.error("Failed to delete tests");
          } finally {
            setBulkDeleting(false);
          }
        }}
      />
    </div>
  );
}
