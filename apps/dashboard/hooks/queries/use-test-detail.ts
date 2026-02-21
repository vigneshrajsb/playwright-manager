"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "./keys";
import type { SkipRule } from "@/types";

export interface TestDetailResult {
  id: string;
  testId: string;
  testRunId: string;
  status: string;
  outcome: string;
  durationMs: number;
  errorMessage: string | null;
  retryCount: number;
  isFinalAttempt: boolean;
  startedAt: string;
  run: {
    id: string;
    runId: string;
    branch: string | null;
    commitSha: string | null;
    status: string;
    ciJobUrl: string | null;
    reportPath: string | null;
  };
}

export interface TestDetailResponse {
  test: {
    id: string;
    playwrightTestId: string;
    testTitle: string;
    filePath: string;
    projectName: string;
    repository: string;
    tags: string[] | null;
    health: {
      healthScore: number | null;
      passRate: string;
      flakinessRate: string;
      recentPassRate: string;
      totalRuns: number;
      avgDurationMs: number;
      trend: string;
      lastRunAt: string | null;
    } | null;
  };
  results: TestDetailResult[];
  skipRules: SkipRule[];
}

export function useTestDetail(testId: string | null) {
  return useQuery({
    queryKey: queryKeys.tests.detail(testId),
    queryFn: () => apiFetch<TestDetailResponse>(`/api/tests/${testId}`),
    enabled: !!testId,
  });
}
