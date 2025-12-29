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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  ListChecks,
  GitPullRequest,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Pipeline {
  id: string;
  runId: string;
  repository: string | null;
  branch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  ciJobUrl: string | null;
  baseUrl: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  flakyCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FiltersData {
  branches: string[];
  repositories: string[];
  statuses: string[];
}

export default function PipelinesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filters, setFilters] = useState<FiltersData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state from URL
  const search = searchParams.get("search") || "";
  const repository = searchParams.get("repository") || "";
  const branch = searchParams.get("branch") || "";
  const status = searchParams.get("status") || "";
  const sortBy = searchParams.get("sortBy") || "startedAt";
  const page = parseInt(searchParams.get("page") || "1");

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (repository) params.set("repository", repository);
      if (branch) params.set("branch", branch);
      if (status) params.set("status", status);
      if (sortBy) params.set("sortBy", sortBy);
      params.set("page", page.toString());
      params.set("limit", "20");

      const response = await fetch(`/api/pipelines?${params.toString()}`);
      const data = await response.json();

      setPipelines(data.pipelines || []);
      setPagination(data.pagination);
      setFilters(data.filters);
    } catch (error) {
      console.error("Failed to fetch pipelines:", error);
      toast.error("Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }, [search, repository, branch, status, sortBy, page]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

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
    router.push(`/dashboard/pipelines?${params.toString()}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case "interrupted":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      passed: "bg-green-500/10 text-green-600",
      failed: "bg-red-500/10 text-red-600",
      running: "bg-blue-500/10 text-blue-600",
      interrupted: "bg-yellow-500/10 text-yellow-600",
    };
    return (
      <Badge className={variants[status] || "bg-gray-500/10 text-gray-600"}>
        {status}
      </Badge>
    );
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "--";
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

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">
            View CI pipeline runs and their test results.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by branch, commit, URL..."
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
            value={branch}
            onValueChange={(v) => updateUrl({ branch: v === "all" ? "" : v })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {filters?.branches?.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead className="min-w-[140px]">Branch / Commit</TableHead>
                <TableHead className="w-[100px]">Repository</TableHead>
                <TableHead className="w-[130px]">Base URL</TableHead>
                <TableHead className="w-[120px]">Started</TableHead>
                <TableHead className="w-[80px]">Duration</TableHead>
                <TableHead className="w-[160px]">Results</TableHead>
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
              ) : pipelines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12">
                    <div className="text-center">
                      <GitPullRequest className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No pipelines found
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Run your CI pipeline to start tracking test runs.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pipelines.map((pipeline) => (
                  <TableRow key={pipeline.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getStatusIcon(pipeline.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {pipeline.branch && (
                          <div className="flex items-center gap-1.5">
                            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{pipeline.branch}</span>
                          </div>
                        )}
                        {pipeline.commitSha && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit cursor-default">
                                {pipeline.commitSha.slice(0, 7)}
                              </code>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-[300px] break-words">
                                {pipeline.commitMessage || pipeline.commitSha}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {!pipeline.branch && !pipeline.commitSha && (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pipeline.repository ? (
                        <Badge variant="outline" className="text-xs">
                          {pipeline.repository}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pipeline.baseUrl ? (
                        <a
                          href={pipeline.baseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-sm truncate max-w-[140px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pipeline.baseUrl.replace(/^https?:\/\//, "")}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(pipeline.startedAt)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(pipeline.durationMs)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600 font-medium">
                          {pipeline.passedCount}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-600 font-medium">
                          {pipeline.failedCount}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-gray-500">
                          {pipeline.skippedCount}
                        </span>
                        {pipeline.flakyCount > 0 && (
                          <>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-yellow-600">
                              {pipeline.flakyCount}
                            </span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({pipeline.totalTests} total)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/results?testRunId=${pipeline.id}`}>
                              <ListChecks className="mr-2 h-4 w-4" />
                              View Results
                            </Link>
                          </DropdownMenuItem>
                          {pipeline.ciJobUrl && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <a
                                  href={pipeline.ciJobUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Open CI Job
                                </a>
                              </DropdownMenuItem>
                            </>
                          )}
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
              {pagination.total} pipelines
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
      </div>
    </TooltipProvider>
  );
}
