"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "./keys";
import type { PipelineVerdict } from "@/lib/flakiness-analyzer/types";

/**
 * Fetch flakiness verdict for a pipeline
 */
export function useVerdict(pipelineId: string | null) {
  return useQuery({
    queryKey: queryKeys.verdict.detail(pipelineId),
    queryFn: () =>
      apiFetch<PipelineVerdict>(`/api/pipelines/${pipelineId}/verdict`),
    enabled: !!pipelineId,
    staleTime: 5 * 60 * 1000, // 5 minutes (matches API cache)
  });
}

interface VerdictFeedbackParams {
  testRunId: string;
  testId: string;
  verdict: string;
  confidence: number;
  llmUsed: boolean;
  feedback: "up" | "down";
}

/**
 * Submit feedback on a verdict
 */
export function useVerdictFeedback() {
  return useMutation({
    mutationFn: (params: VerdictFeedbackParams) =>
      apiFetch("/api/verdicts/feedback", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      toast.success("Feedback recorded");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to record feedback"
      );
    },
  });
}
