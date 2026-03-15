"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Settings,
  Terminal,
  Zap,
} from "lucide-react";

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
      <code className="overflow-x-auto">{children}</code>
      <CopyButton text={children} />
    </div>
  );
}

export function OnboardingWelcome() {
  const [healthStatus, setHealthStatus] = useState<{
    loading: boolean;
    result?: { status: string; db: string; s3: string };
    error?: string;
  }>({ loading: false });

  const checkConnection = async () => {
    setHealthStatus({ loading: true });
    try {
      const res = await fetch("/api/admin/health");
      const data = await res.json();
      setHealthStatus({ loading: false, result: data });
    } catch {
      setHealthStatus({ loading: false, error: "Could not reach the API" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Playwright Manager</h1>
        <p className="text-muted-foreground">
          Set up your Playwright project to start tracking test health, managing flaky tests, and
          controlling test execution.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Step 1 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="h-6 w-6 items-center justify-center rounded-full p-0">
                1
              </Badge>
              <Package className="h-4 w-4" />
              Install packages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CodeBlock>npm install -D @playwright-manager/reporter @playwright-manager/fixture</CodeBlock>
            <p className="text-xs text-muted-foreground">
              The reporter sends results to this dashboard. The fixture enables remote test quarantine.
            </p>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="h-6 w-6 items-center justify-center rounded-full p-0">
                2
              </Badge>
              <Settings className="h-4 w-4" />
              Configure your project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CodeBlock>npx playwright-manager init</CodeBlock>
            <p className="text-xs text-muted-foreground">
              Generates the config snippet for your playwright.config.ts.
            </p>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="h-6 w-6 items-center justify-center rounded-full p-0">
                3
              </Badge>
              <Terminal className="h-4 w-4" />
              Run your tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CodeBlock>npx playwright test</CodeBlock>
            <p className="text-xs text-muted-foreground">
              Results will appear here automatically after the run completes.
            </p>
          </CardContent>
        </Card>

        {/* Connection check */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Connection status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={checkConnection} disabled={healthStatus.loading} size="sm">
              {healthStatus.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check connection
            </Button>

            {healthStatus.result && (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3 w-3 ${healthStatus.result.status === "ok" ? "text-green-500" : "text-yellow-500"}`} />
                  <span>Dashboard: {healthStatus.result.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3 w-3 ${healthStatus.result.db === "connected" ? "text-green-500" : "text-red-500"}`} />
                  <span>Database: {healthStatus.result.db}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3 w-3 ${healthStatus.result.s3?.startsWith("error") ? "text-red-500" : "text-muted-foreground"}`} />
                  <span>Storage: {healthStatus.result.s3}</span>
                </div>
              </div>
            )}

            {healthStatus.error && (
              <p className="text-sm text-destructive">{healthStatus.error}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Org-wide shortcut */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Multi-repo shortcut</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            For org-wide rollout, set these CI environment variables instead of configuring each
            repo:
          </p>
          <CodeBlock>{`PLAYWRIGHT_MANAGER_URL=${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}`}</CodeBlock>
          <CodeBlock>PLAYWRIGHT_MANAGER_REPOSITORY=your-org/your-repo</CodeBlock>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <a href="/docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" />
                Full documentation
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
