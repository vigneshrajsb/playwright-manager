"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  FlaskConical,
  AlertTriangle,
  XCircle,
  Loader2,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  Play,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { PassRateChart } from "@/components/dashboard/pass-rate-chart";
import { HealthPieChart } from "@/components/dashboard/health-pie-chart";
import { HealthBadge } from "@/components/badges";
import { TagFilterPopover } from "@/components/filters";
import { formatRelativeTime } from "@/lib/utils/format";
import { useDashboard } from "@/hooks/queries";
import type { DashboardFilters } from "@/hooks/queries";

export default function DashboardOverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const repository = searchParams.get("repository") || "";
  const project = searchParams.get("project") || "";
  const tags = searchParams.get("tags") || "";
  const selectedTags = tags ? tags.split(",").filter(Boolean) : [];

  const filters: DashboardFilters = {
    repository: repository || undefined,
    project: project || undefined,
    tags: tags || undefined,
  };

  const { data, isLoading } = useDashboard(filters);

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

  if (isLoading && !data) {
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
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Select
            value={repository}
            onValueChange={(v) => updateUrl({ repository: v === "all" ? "" : v })}
          >
            <SelectTrigger className="w-[160px] shrink-0">
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
            <SelectTrigger className="w-[140px] shrink-0">
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

          <TagFilterPopover
            tags={data?.filters?.tags || []}
            selectedTags={selectedTags}
            onTagsChange={(newTags) => updateUrl({ tags: newTags.join(",") })}
            buttonClassName="w-[140px] shrink-0"
            align="end"
          />
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
          description="Health score 50-80"
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
              <div className="text-center py-6">
                <Play className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  No runs yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run your test suite to see activity.
                </p>
              </div>
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
                    <HealthBadge
                      score={test.health.healthScore}
                      recentPassRate={test.health.recentPassRate}
                      overallPassRate={test.health.passRate}
                    />
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
                    <HealthBadge
                      score={test.health.healthScore}
                      recentPassRate={test.health.recentPassRate}
                      overallPassRate={test.health.passRate}
                    />
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
