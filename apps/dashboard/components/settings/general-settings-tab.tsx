"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { CheckCircle2, Loader2, Minus, XCircle } from "lucide-react";

const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "http://localhost:3000";

function StatusIndicator({ label, value }: { label: string; value: string }) {
  const isOk = value === "connected" || value === "ok" || value === "configured";
  const isNeutral = value === "not_configured";
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {isOk ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : isNeutral ? (
          <Minus className="h-4 w-4 text-muted-foreground" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm">{value}</span>
      </div>
    </div>
  );
}

export function GeneralSettingsTab() {
  const appUrl = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/health");
      return res.json() as Promise<{ status: string; db: string; s3: string }>;
    },
  });

  const { data: status } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/status");
      return res.json() as Promise<{ hasData: boolean; testCount: number; runCount: number }>;
    },
    staleTime: 60_000,
  });

  const configSnippet = `reporter: [
  ["@playwright-manager/reporter", {
    apiUrl: "${appUrl}",
    repository: "your-org/your-repo",
  }],
],
use: {
  testManager: {
    apiUrl: "${appUrl}",
    repository: "your-org/your-repo",
  },
},`;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : health ? (
            <div className="divide-y">
              <StatusIndicator label="Dashboard" value={health.status} />
              <StatusIndicator label="Database" value={health.db} />
              <StatusIndicator label="Storage" value={health.s3} />
            </div>
          ) : (
            <p className="text-sm text-destructive">Could not fetch health status</p>
          )}
        </CardContent>
      </Card>

      {/* Instance Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instance Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Dashboard URL</span>
            <div className="flex items-center gap-1">
              <code className="text-sm">{appUrl}</code>
              <CopyButton text={appUrl} />
            </div>
          </div>
          {status && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tests tracked</span>
                <Badge variant="secondary">{status.testCount}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total runs</span>
                <Badge variant="secondary">{status.runCount}</Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Config Snippet */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Configuration Snippet</CardTitle>
            <CopyButton text={configSnippet} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Add this to your <code className="text-xs bg-muted px-1 py-0.5 rounded">playwright.config.ts</code> to connect to this dashboard:
          </p>
          <pre className="rounded-md bg-muted p-3 text-sm font-mono overflow-x-auto">
            {configSnippet}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
