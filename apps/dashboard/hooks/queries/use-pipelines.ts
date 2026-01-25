"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type PipelineFilters } from "./keys";
import type { Pipeline, Pagination, PipelineFiltersData } from "@/types";
import {
  timeRangeToDateRange,
  isRelativeTimeRange,
  dateStringToStartOfDay,
  dateStringToEndOfDay,
} from "@/lib/utils/time-range";

const AUTO_REFRESH_INTERVAL = 15_000; // 15 seconds

interface PipelinesResponse {
  pipelines: Pipeline[];
  pagination: Pagination;
  filters: PipelineFiltersData;
}

export function usePipelines(filters: PipelineFilters) {
  const isLive = isRelativeTimeRange(
    filters.timeRange,
    filters.startDate,
    filters.endDate
  );

  return useQuery({
    queryKey: queryKeys.pipelines.list(filters),
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

      return apiFetch<PipelinesResponse>(
        buildUrl("/api/pipelines", {
          search: filters.search,
          repository: filters.repository,
          branch: filters.branch,
          status: filters.status,
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
