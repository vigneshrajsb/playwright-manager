"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type ResultFilters } from "./keys";
import type { TestResult, Pagination, ResultFiltersData, RunInfo, TestInfo } from "@/types";

interface ResultsResponse {
  results: TestResult[];
  pagination: Pagination;
  filters: ResultFiltersData;
  runInfo: RunInfo | null;
  testInfo: TestInfo | null;
}

export function useResults(filters: ResultFilters) {
  return useQuery({
    queryKey: queryKeys.results.list(filters),
    queryFn: () =>
      apiFetch<ResultsResponse>(
        buildUrl("/api/results", {
          search: filters.search,
          repository: filters.repository,
          project: filters.project,
          tags: filters.tags,
          status: filters.status,
          outcome: filters.outcome,
          testRunId: filters.testRunId,
          testId: filters.testId,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          page: filters.page,
          limit: 20,
        })
      ),
  });
}
