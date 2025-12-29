"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Clock, GitBranch, MoreHorizontal, X, ExternalLink, ClipboardList } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResultSheet } from "@/components/results/result-sheet";
import { StatusBadgeWithTooltip } from "@/components/badges";
import { TagFilterPopover } from "@/components/filters";
import { formatDate, formatDuration } from "@/lib/utils/format";
import { useResults } from "@/hooks/queries";
import type { ResultFilters } from "@/hooks/queries";

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || "";
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];
  const status = searchParams.get("status") || "";
  const outcome = searchParams.get("outcome") || "";
  const testRunId = searchParams.get("testRunId") || "";
  const sortBy = searchParams.get("sortBy") || "startedAt";
  const page = parseInt(searchParams.get("page") || "1");

  const selectedResultId = searchParams.get("resultId") || null;

  const filters: ResultFilters = {
    search: search || undefined,
    repository: repository || undefined,
    project: project || undefined,
    tags: tags || undefined,
    status: status || undefined,
    outcome: outcome || undefined,
    testRunId: testRunId || undefined,
    sortBy,
    page,
  };

  const { data, isLoading } = useResults(filters);
  const results = data?.results ?? [];
  const pagination = data?.pagination ?? null;
  const filterOptions = data?.filters ?? null;
  const runInfo = data?.runInfo ?? null;

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

  const clearRunFilter = () => {
    updateUrl({ testRunId: "" });
  };

  const openResultSheet = (id: string) => {
    updateUrl({ resultId: id });
  };

  const closeResultSheet = () => {
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
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        <div className="relative min-w-[200px] max-w-sm shrink-0">
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
          onValueChange={(v) => updateUrl({ project: v === "all" ? "" : v })}
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
          onTagsChange={(newTags) => updateUrl({ tags: newTags.join(",") })}
        />

        <Select
          value={status}
          onValueChange={(v) => updateUrl({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[130px] shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {filterOptions?.statuses?.map((s) => (
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
          <SelectTrigger className="w-[130px] shrink-0">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            {filterOptions?.outcomes?.map((o) => (
              <SelectItem key={o} value={o}>
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => updateUrl({ sortBy: v })}>
          <SelectTrigger className="w-[150px] shrink-0">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <div className="text-center">
                    <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No results found
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Run your test suite or adjust filters to see results.
                    </p>
                  </div>
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
                  <TableCell>
                    <StatusBadgeWithTooltip
                      status={result.status}
                      expectedStatus={result.expectedStatus}
                      outcome={result.outcome}
                    />
                  </TableCell>
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
