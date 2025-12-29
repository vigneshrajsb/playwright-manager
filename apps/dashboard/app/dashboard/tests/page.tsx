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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Search, X, ChevronDown } from "lucide-react";

interface TestHealth {
  healthScore: number;
  passRate: string;
  flakinessRate: string;
  lastRunAt: string | null;
}

interface Test {
  id: string;
  testTitle: string;
  filePath: string;
  repository: string;
  projectName: string;
  tags: string[] | null;
  isEnabled: boolean;
  disabledReason: string | null;
  lastSeenAt: string;
  health: TestHealth | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FiltersData {
  repositories: string[];
  projects: string[];
  tags: string[];
}

export default function TestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tests, setTests] = useState<Test[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filters, setFilters] = useState<FiltersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Bulk disable dialog state
  const [bulkDisableOpen, setBulkDisableOpen] = useState(false);
  const [bulkDisableReason, setBulkDisableReason] = useState("");
  const [bulkDisabling, setBulkDisabling] = useState(false);

  // Single test disable dialog state
  const [singleDisableOpen, setSingleDisableOpen] = useState(false);
  const [singleDisableTestId, setSingleDisableTestId] = useState<string | null>(null);
  const [singleDisableTestTitle, setSingleDisableTestTitle] = useState("");
  const [singleDisableReason, setSingleDisableReason] = useState("");

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

  // Tag dropdown open state
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

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

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    updateUrl({ tags: newTags.join(",") });
  };

  const clearTags = () => {
    updateUrl({ tags: "" });
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
      }
    } catch (error) {
      console.error("Failed to toggle test:", error);
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
      setSingleDisableReason("");
      setSingleDisableOpen(true);
    }
  };

  const handleSingleDisableConfirm = async () => {
    if (!singleDisableTestId || !singleDisableReason.trim()) return;

    await toggleTest(singleDisableTestId, false, singleDisableReason);
    setSingleDisableOpen(false);
    setSingleDisableTestId(null);
    setSingleDisableTestTitle("");
    setSingleDisableReason("");
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
    } catch (error) {
      console.error("Failed to bulk enable:", error);
    } finally {
      setBulkDisabling(false);
    }
  };

  const handleBulkDisableConfirm = async () => {
    if (!bulkDisableReason.trim()) return;

    setBulkDisabling(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/tests/${id}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: false, reason: bulkDisableReason }),
        })
      );
      await Promise.all(promises);
      await fetchTests();
      setSelectedIds(new Set());
      setBulkDisableOpen(false);
      setBulkDisableReason("");
    } catch (error) {
      console.error("Failed to bulk disable:", error);
    } finally {
      setBulkDisabling(false);
    }
  };

  const getHealthBadge = (test: Test) => {
    if (!test.health) {
      return <Badge variant="outline">No data</Badge>;
    }

    const score = test.health.healthScore;
    if (score >= 80) {
      return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Healthy</Badge>;
    } else if (score >= 50) {
      return <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Flaky</Badge>;
    } else {
      return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Failing</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

        <Popover open={tagDropdownOpen} onOpenChange={setTagDropdownOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[150px] justify-between">
              {selectedTags.length > 0 ? (
                <span className="truncate">
                  {selectedTags.length} tag{selectedTags.length > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Tags</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <div className="p-2 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Filter by tags</span>
                {selectedTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 text-xs"
                    onClick={clearTags}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto p-2">
              {filters?.tags?.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No tags found
                </p>
              ) : (
                filters?.tags?.map((t) => (
                  <div
                    key={t}
                    className="flex items-center space-x-2 py-1.5 px-1 hover:bg-muted rounded cursor-pointer"
                    onClick={() => toggleTag(t)}
                  >
                    <Checkbox
                      checked={selectedTags.includes(t)}
                      onCheckedChange={() => toggleTag(t)}
                    />
                    <span className="text-sm">{t}</span>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

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
              <TableHead>Test</TableHead>
              <TableHead className="w-[120px]">Project</TableHead>
              <TableHead className="w-[100px]">Health</TableHead>
              <TableHead className="w-[80px]">Pass Rate</TableHead>
              <TableHead className="w-[140px]">Last Run</TableHead>
              <TableHead className="w-[80px]">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
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
                  <TableCell>{getHealthBadge(test)}</TableCell>
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
      <Dialog open={bulkDisableOpen} onOpenChange={setBulkDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable {selectedIds.size} Tests</DialogTitle>
            <DialogDescription>
              Disabled tests will be automatically skipped during test runs.
              Please provide a reason for disabling these tests.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Reason for disabling (required)"
              value={bulkDisableReason}
              onChange={(e) => setBulkDisableReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkDisableOpen(false);
                setBulkDisableReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDisableConfirm}
              disabled={!bulkDisableReason.trim() || bulkDisabling}
            >
              {bulkDisabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable Tests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Test Disable Dialog */}
      <Dialog open={singleDisableOpen} onOpenChange={setSingleDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Test</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{singleDisableTestTitle}</span>
              <br />
              This test will be automatically skipped during test runs.
              Please provide a reason for disabling.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Reason for disabling (required)"
              value={singleDisableReason}
              onChange={(e) => setSingleDisableReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSingleDisableOpen(false);
                setSingleDisableTestId(null);
                setSingleDisableTestTitle("");
                setSingleDisableReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSingleDisableConfirm}
              disabled={!singleDisableReason.trim() || togglingId === singleDisableTestId}
            >
              {togglingId === singleDisableTestId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
