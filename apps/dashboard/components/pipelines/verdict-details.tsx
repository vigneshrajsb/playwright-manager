"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Bot, Calculator, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useVerdictFeedback } from "@/hooks/queries";
import type { TestVerdict } from "@/lib/flakiness-analyzer/types";

interface VerdictDetailsProps {
  failedTests: TestVerdict[];
  pipelineId: string;
}

export function VerdictDetails({ failedTests, pipelineId }: VerdictDetailsProps) {
  if (failedTests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No failed tests to analyze.</p>
    );
  }

  return (
    <div className="space-y-3">
      {failedTests.map((test) => (
        <TestVerdictCard
          key={test.testId}
          test={test}
          pipelineId={pipelineId}
        />
      ))}
    </div>
  );
}

interface TestVerdictCardProps {
  test: TestVerdict;
  pipelineId: string;
}

function TestVerdictCard({ test, pipelineId }: TestVerdictCardProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const feedbackMutation = useVerdictFeedback();

  const isFlaky = test.verdict === "flaky";
  const verdictBadge = isFlaky ? (
    <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Flaky</Badge>
  ) : (
    <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Likely Real</Badge>
  );

  const handleFeedback = (feedback: "up" | "down") => {
    if (feedbackGiven) return;

    feedbackMutation.mutate({
      testRunId: pipelineId,
      testId: test.testId,
      verdict: test.verdict,
      confidence: test.confidence,
      llmUsed: test.llmUsed,
      feedback,
    });
    setFeedbackGiven(feedback);
  };

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-0.5">
        <div className="font-medium text-sm">{test.testTitle}</div>
        <div className="text-xs text-muted-foreground truncate">{test.filePath}</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {verdictBadge}
            <Badge variant="outline" className="text-xs">
              {isFlaky ? `${test.confidence}% flaky` : `${100 - test.confidence}% real failure`}
            </Badge>
            {test.llmUsed ? (
              <Tooltip>
                <TooltipTrigger>
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Analyzed with AI</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger>
                  <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Heuristics only</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 w-7 p-0 ${feedbackGiven === "up" ? "bg-green-100 text-green-600" : ""}`}
                  onClick={() => handleFeedback("up")}
                  disabled={!!feedbackGiven}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Helpful</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 w-7 p-0 ${feedbackGiven === "down" ? "bg-red-100 text-red-600" : ""}`}
                  onClick={() => handleFeedback("down")}
                  disabled={!!feedbackGiven}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Not helpful</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      {test.reasoning && (
        <p className="text-sm text-muted-foreground mt-2">{test.reasoning}</p>
      )}

      {/* Expandable details */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-2 h-6 px-2 text-xs">
            <ChevronDown
              className={`h-3 w-3 mr-1 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide" : "Show"} stats
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 pt-2 border-t">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Flakiness:</span>{" "}
                <span className="font-medium">
                  {test.signals.recentFlakinessRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Health:</span>{" "}
                <span className="font-medium">{test.signals.healthScore}/100</span>
              </div>
              <div>
                <span className="text-muted-foreground">Consec. fails:</span>{" "}
                <span className="font-medium">
                  {test.signals.consecutiveFailures}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                Recent outcomes:
              </span>
              <div className="flex gap-1 mt-1">
                {test.signals.recentOutcomes.map((outcome, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger>
                      <div
                        className={`h-3 w-3 rounded-full ${
                          outcome === "pass"
                            ? "bg-green-500"
                            : outcome === "fail"
                              ? "bg-red-500"
                              : outcome === "flaky"
                                ? "bg-yellow-500"
                                : "bg-gray-300"
                        }`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{outcome}</TooltipContent>
                  </Tooltip>
                ))}
                {test.signals.recentOutcomes.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No history
                  </span>
                )}
              </div>
            </div>

            {/* Error preview */}
            {test.errorMessage && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">Error:</span>
                <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-20">
                  {test.errorMessage.slice(0, 200)}
                  {test.errorMessage.length > 200 && "..."}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
