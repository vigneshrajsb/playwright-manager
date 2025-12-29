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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Search, ChevronDown, Clock, GitBranch, MoreHorizontal, X, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResultSheet } from "@/components/results/result-sheet";

interface TestResult {
  id: string;
  testId: string;
  testRunId: string;
  status: string;
  expectedStatus: string;
  outcome: string;
  durationMs: number;
  errorMessage: string | null;
  retryCount: number;
  startedAt: string;
  baseUrl: string | null;
  test: {
    id: string;
    testTitle: string;
    filePath: string;
    projectName: string;
    repository: string;
    tags: string[] | null;
  };
  run: {
    id: string;
    runId: string;
    branch: string | null;
    commitSha: string | null;
    status: string;
    startedAt: string;
  };
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
  statuses: string[];
  outcomes: string[];
}

interface RunInfo {
  id: string;
  runId: string;
  branch: string | null;
  commitSha: string | null;
  status: string;
  startedAt: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [results, setResults] = useState<TestResult[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filters, setFilters] = useState<FiltersData | null>(null);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  // Filter state from URL
  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || "";
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];
  const status = searchParams.get("status") || "";
  const outcome = searchParams.get("outcome") || "";
  const testRunId = searchParams.get("testRunId") || "";
  const resultId = searchParams.get("resultId") || "";
  const sortBy = searchParams.get("sortBy") || "startedAt";
  const page = parseInt(searchParams.get("page") || "1");

  // Sync selectedResultId with URL param
  useEffect(() => {
    if (resultId) {
      setSelectedResultId(resultId);
    }
  }, [resultId]);

  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (repository) params.set("repository", repository);
      if (project) params.set("project", project);
      if (tags) params.set("tags", tags);
      if (status) params.set("status", status);
      if (outcome) params.set("outcome", outcome);
      if (testRunId) params.set("testRunId", testRunId);
      if (sortBy) params.set("sortBy", sortBy);
      params.set("page", page.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/results?${params.toString()}`);
      const data = await response.json();

      setResults(data.results || []);
      setPagination(data.pagination);
      setFilters(data.filters);
      setRunInfo(data.runInfo || null);
    } catch (error) {
      console.error("Failed to fetch results:", error);
    } finally {
      setLoading(false);
    }
  }, [search, repository, project, tags, status, outcome, testRunId, sortBy, page]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

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
    router.push(`/dashboard/results?${params.toString()}`);
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

  const clearRunFilter = () => {
    updateUrl({ testRunId: "" });
  };

  const getStatusBadgeWithTooltip = (status: string, expectedStatus: string, outcomeValue: string) => {
    // Red for failures AND unexpected outcomes
    const isUnexpected = outcomeValue === "unexpected";
    const isFailed = status === "failed" || status === "timedOut";
    const isRed = isFailed || isUnexpected;

    const variants: Record<string, string> = {
      passed: isRed ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600",
      failed: "bg-red-500/10 text-red-600",
      timedOut: "bg-orange-500/10 text-orange-600",
      skipped: "bg-gray-500/10 text-gray-600",
      interrupted: "bg-yellow-500/10 text-yellow-600",
    };

    // Generate tooltip message
    let tooltipMessage = "";
    let tooltipColor = "text-green-600";

    if (outcomeValue === "skipped") {
      tooltipMessage = "Skipped";
      tooltipColor = "text-muted-foreground";
    } else if (status === expectedStatus || (status === "passed" && expectedStatus === "passed")) {
      tooltipMessage = expectedStatus === "failed" ? "Expected to fail" : "Expected to pass";
      tooltipColor = "text-green-600";
    } else if (expectedStatus === "failed" && status === "passed") {
      tooltipMessage = "Expected to fail, but passed";
      tooltipColor = "text-red-600";
    } else if (expectedStatus === "passed" && (status === "failed" || status === "timedOut")) {
      tooltipMessage = "Expected to pass, but failed";
      tooltipColor = "text-red-600";
    } else {
      tooltipMessage = `Expected: ${expectedStatus}, Actual: ${status}`;
      tooltipColor = isUnexpected ? "text-red-600" : "text-green-600";
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${variants[status] || variants.skipped} cursor-help`}>
            {status}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <span className={tooltipColor}>{tooltipMessage}</span>
        </TooltipContent>
      </Tooltip>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      passed: "bg-green-500/10 text-green-600",
      failed: "bg-red-500/10 text-red-600",
      timedOut: "bg-orange-500/10 text-orange-600",
      skipped: "bg-gray-500/10 text-gray-600",
      interrupted: "bg-yellow-500/10 text-yellow-600",
    };
    return (
      <Badge className={variants[status] || variants.skipped}>{status}</Badge>
    );
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, string> = {
      expected: "bg-green-500/10 text-green-600",
      unexpected: "bg-red-500/10 text-red-600",
      flaky: "bg-yellow-500/10 text-yellow-600",
      skipped: "bg-gray-500/10 text-gray-600",
    };
    return (
      <Badge className={variants[outcome] || variants.skipped}>{outcome}</Badge>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openResultSheet = (id: string) => {
    setSelectedResultId(id);
    updateUrl({ resultId: id });
  };

  const closeResultSheet = () => {
    setSelectedResultId(null);
    updateUrl({ resultId: "" });
  };

  return (
    <TooltipProvider>
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Results</h1>
        <p className="text-muted-foreground">
          View individual test execution results across all runs.
        </p>
      </div>

      {/* Run filter banner */}
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by test, path, URL..."
            value={search}
            onChange={(e) => updateUrl({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={repository}
          onValueChange={(v) => updateUrl({ repository: v === "all" ? "" : v })}
        >
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

        <Select
          value={project}
          onValueChange={(v) => updateUrl({ project: v === "all" ? "" : v })}
        >
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

        <Select
          value={status}
          onValueChange={(v) => updateUrl({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {filters?.statuses?.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={outcome}
          onValueChange={(v) => updateUrl({ outcome: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            {filters?.outcomes?.map((o) => (
              <SelectItem key={o} value={o}>
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => updateUrl({ sortBy: v })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="startedAt">Started At</SelectItem>
            <SelectItem value="duration">Duration</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Test</TableHead>
              <TableHead className="w-[90px]">Project</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[80px]">Duration</TableHead>
              <TableHead className="w-[130px]">Base URL</TableHead>
              <TableHead className="w-[120px]">Run Info</TableHead>
              <TableHead className="w-[130px]">Started At</TableHead>
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
            ) : results.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No results found
                </TableCell>
              </TableRow>
            ) : (
              results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{result.test.testTitle}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[350px]">
                        {result.test.filePath}
                      </span>
                      {result.test.tags && result.test.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {result.test.tags.slice(0, 3).map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                            >
                              {t}
                            </Badge>
                          ))}
                          {result.test.tags.length > 3 && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0"
                            >
                              +{result.test.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{result.test.projectName}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadgeWithTooltip(result.status, result.expectedStatus, result.outcome)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(result.durationMs)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {result.baseUrl ? (
                      <a
                        href={result.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm truncate max-w-[120px]"
                      >
                        {result.baseUrl.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {result.run.branch && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <GitBranch className="h-3 w-3" />
                          {result.run.branch}
                        </span>
                      )}
                      {result.run.commitSha && (
                        <code className="text-muted-foreground">
                          {result.run.commitSha.slice(0, 7)}
                        </code>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(result.startedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openResultSheet(result.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
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
            {pagination.total} results
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

      {/* Result Detail Sheet */}
      <ResultSheet
        resultId={selectedResultId}
        onClose={closeResultSheet}
      />
    </div>
    </TooltipProvider>
  );
}
