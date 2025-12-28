import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FlaskConical,
  Activity,
  ToggleRight,
  Shield,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto px-4 space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full opacity-75 bg-[#4ade80]"></span>
            <span className="relative inline-flex size-2 rounded-full bg-[#22c55e]"></span>
          </span>
          Self-Hosted Test Management
        </div>

        {/* Hero Heading */}
        <div className="flex items-center gap-3">
          <FlaskConical className="size-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Playwright Manager
          </h1>
        </div>

        {/* Subtitle */}
        <p className="text-lg text-muted-foreground max-w-xl">
          Track test health, manage flaky tests, and control test execution
          remotely. Your Playwright tests, your infrastructure.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="gap-2">
            <Link href="/dashboard">
              <LayoutDashboard className="size-4" />
              Open Dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/docs">View API Docs</Link>
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid w-full gap-6 pt-8 md:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <div className="rounded-full bg-muted p-3">
                <Activity className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">Health Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Monitor pass rates and flakiness across all your tests.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <div className="rounded-full bg-muted p-3">
                <ToggleRight className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">Remote Control</h3>
              <p className="text-sm text-muted-foreground">
                Enable or disable tests from the dashboard. Changes apply
                instantly.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
              <div className="rounded-full bg-muted p-3">
                <Shield className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold">Self-Hosted</h3>
              <p className="text-sm text-muted-foreground">
                Your data stays with you. Deploy anywhere with Docker.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
