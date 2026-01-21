"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VerdictDetails } from "./verdict-details";
import { useRefreshVerdict } from "@/hooks/queries";
import type { PipelineVerdict } from "@/lib/flakiness-analyzer/types";

interface VerdictBannerProps {
  verdict: PipelineVerdict | null;
  pipelineId: string;
  isLoading?: boolean;
  error?: Error | null;
}

export function VerdictBanner({ verdict, pipelineId, isLoading, error }: VerdictBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const refreshMutation = useRefreshVerdict();

  if (isLoading) {
    return (
      <div className="rounded-lg border p-4 bg-muted/50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Analyzing failures...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 bg-red-500/10 border-red-500/20">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-600">
            Failed to analyze failures. Please try again.
          </span>
        </div>
      </div>
    );
  }

  if (!verdict) return null;

  const isFlaky = verdict.verdict === "flaky";
  const Icon = isFlaky ? CheckCircle2 : AlertTriangle;
  const bgClass = isFlaky
    ? "bg-green-500/10 border-green-500/20"
    : "bg-yellow-500/10 border-yellow-500/20";
  const iconClass = isFlaky ? "text-green-600" : "text-yellow-600";
  const title = isFlaky ? "Safe to proceed" : "Investigate failures";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`rounded-lg border p-4 ${bgClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`h-5 w-5 ${iconClass}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{title}</span>
                <Badge variant="outline" className="text-xs">
                  {verdict.confidence}% confidence
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {verdict.summary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => refreshMutation.mutate(pipelineId)}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Re-analyze</TooltipContent>
            </Tooltip>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="ml-1">Details</span>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t">
            <VerdictDetails
              failedTests={verdict.failedTests}
              pipelineId={pipelineId}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
