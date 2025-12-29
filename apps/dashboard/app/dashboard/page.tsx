"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Activity,
  FlaskConical,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Loader2,
  GitBranch,
  Clock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { PassRateChart } from "@/components/dashboard/pass-rate-chart";
import { HealthPieChart } from "@/components/dashboard/health-pie-chart";

interface Overview {
  totalTests: number;
  enabledTests: number;
  disabledTests: number;
  avgHealthScore: number;
  overallPassRate: number;
  flakyCount: number;
  healthDistribution: {
    healthy?: number;
    warning?: number;
    critical?: number;
  };
}

interface RecentRun {
  id: string;
  runId: string;
  branch: string | null;
  commitSha: string | null;
  status: string;
  startedAt: string;
  passRate: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
}

interface TestWithHealth {
  id: string;
  testTitle: string;
  filePath: string;
  projectName: string;
  health: {
    healthScore: number;
    passRate: string;
    flakinessRate: string;
    consecutiveFailures: number;
  };
}

interface PassRateTimeline {
  date: string;
  passRate: number;
  totalTests: number;
  totalRuns: number;
}

interface FiltersData {
  repositories: string[];
  projects: string[];
  tags: string[];
}

interface DashboardData {
  overview: Overview;
  recentRuns: RecentRun[];
  passRateTimeline: PassRateTimeline[];
  flakyTests: TestWithHealth[];
  failingTests: TestWithHealth[];
  filters: FiltersData;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state from URL
  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || "";
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];

  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (repository) params.set("repository", repository);
      if (project) params.set("project", project);
      if (tags) params.set("tags", tags);
      params.set("days", "7");

      const response = await fetch(`/api/dashboard?${params.toString()}`);
      const data = await response.json();
      setData(data);
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [repository, project, tags]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`/dashboard?${params.toString()}`);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge className="bg-green-500/10 text-green-600">Healthy</Badge>
      );
    } else if (score >= 50) {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600">Flaky</Badge>
      );
    } else {
      return <Badge className="bg-red-500/10 text-red-600">Failing</Badge>;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading && !data) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Monitor your test suite health and recent activity.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={repository}
            onValueChange={(v) => updateUrl({ repository: v === "all" ? "" : v })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Repository" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Repositories</SelectItem>
              {data?.filters?.repositories?.map((r) => (
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
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {data?.filters?.projects?.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={tagDropdownOpen} onOpenChange={setTagDropdownOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-between">
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
            <PopoverContent className="w-[200px] p-0" align="end">
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
                {data?.filters?.tags?.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    No tags found
                  </p>
                ) : (
                  data?.filters?.tags?.map((t) => (
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
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Tests"
          value={data?.overview?.totalTests || 0}
          icon={FlaskConical}
          description={`${data?.overview?.enabledTests || 0} enabled`}
        />
        <StatsCard
          title="Pass Rate"
          value={`${data?.overview?.overallPassRate || 0}%`}
          icon={Activity}
          description="Last 7 days"
        />
        <StatsCard
          title="Flaky Tests"
          value={data?.overview?.flakyCount || 0}
          icon={AlertTriangle}
          description="Flakiness rate > 10%"
        />
        <StatsCard
          title="Disabled Tests"
          value={data?.overview?.disabledTests || 0}
          icon={XCircle}
          description="Manually disabled"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PassRateChart data={data?.passRateTimeline || []} />
        <HealthPieChart data={data?.overview?.healthDistribution || {}} />
      </div>

      {/* Lists Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Pipelines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Recent Runs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/pipelines">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data?.recentRuns?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent runs
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentRuns.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <div className="flex flex-col">
                        {run.branch && (
                          <span className="flex items-center gap-1 text-sm font-medium">
                            <GitBranch className="h-3 w-3" />
                            {run.branch}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {run.passRate}% pass rate
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(run.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Flaky Tests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Most Flaky</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/tests?health=flaky">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data?.flakyTests?.length ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-1">🎯</p>
                <p className="text-sm font-medium text-muted-foreground">
                  All tests are rock solid!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  No flaky tests detected. Your CI thanks you.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.flakyTests.slice(0, 5).map((test) => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <span className="text-sm font-medium truncate">
                        {test.testTitle}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {test.health.flakinessRate}% flaky
                      </span>
                    </div>
                    {getHealthBadge(test.health.healthScore)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Failing Tests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Most Failing</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/tests?health=failing">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data?.failingTests?.length ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-1">✨</p>
                <p className="text-sm font-medium text-muted-foreground">
                  Zero failures. Nice work!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All tests are passing like champs.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.failingTests.slice(0, 5).map((test) => (
                  <div
                    key={test.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <span className="text-sm font-medium truncate">
                        {test.testTitle}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Score: {test.health.healthScore}
                      </span>
                    </div>
                    {getHealthBadge(test.health.healthScore)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
