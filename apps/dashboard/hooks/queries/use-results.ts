"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type ResultFilters } from "./keys";
import type { TestResult, Pagination, ResultFiltersData, RunInfo, TestInfo } from "@/types";
import {
  timeRangeToDateRange,
  isRelativeTimeRange,
  dateStringToStartOfDay,
  dateStringToEndOfDay,
} from "@/lib/utils/time-range";

const AUTO_REFRESH_INTERVAL = 15_000; // 15 seconds

interface ResultsResponse {
  results: TestResult[];
  pagination: Pagination;
  filters: ResultFiltersData;
  runInfo: RunInfo | null;
  testInfo: TestInfo | null;
}

export function useResults(filters: ResultFilters) {
  const isLive = isRelativeTimeRange(
    filters.timeRange,
    filters.startDate,
    filters.endDate
  );

  return useQuery({
    queryKey: queryKeys.results.list(filters),
    queryFn: () => {
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (filters.timeRange && !filters.startDate && !filters.endDate) {
        // Using relative time range preset
        const dateRange = timeRangeToDateRange(filters.timeRange);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      } else if (filters.startDate && filters.endDate) {
        // Using custom date range
        startDate = dateStringToStartOfDay(filters.startDate);
        endDate = dateStringToEndOfDay(filters.endDate);
      }

      return apiFetch<ResultsResponse>(
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
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        })
      );
    },
    refetchInterval: isLive ? AUTO_REFRESH_INTERVAL : false,
  });
}
