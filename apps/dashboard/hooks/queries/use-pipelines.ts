"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type PipelineFilters } from "./keys";
import type { Pipeline, Pagination, PipelineFiltersData } from "@/types";

interface PipelinesResponse {
  pipelines: Pipeline[];
  pagination: Pagination;
  filters: PipelineFiltersData;
}

export function usePipelines(filters: PipelineFilters) {
  return useQuery({
    queryKey: queryKeys.pipelines.list(filters),
    queryFn: () =>
      apiFetch<PipelinesResponse>(
        buildUrl("/api/pipelines", {
          search: filters.search,
          repository: filters.repository,
          branch: filters.branch,
          status: filters.status,
          sortBy: filters.sortBy,
          page: filters.page,
          limit: 20,
        })
      ),
  });
}
