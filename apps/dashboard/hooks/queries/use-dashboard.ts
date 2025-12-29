"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type DashboardFilters } from "./keys";
import type { DashboardData } from "@/types";

export function useDashboard(filters: DashboardFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.overview(filters),
    queryFn: () =>
      apiFetch<DashboardData>(
        buildUrl("/api/dashboard", {
          repository: filters.repository,
          project: filters.project,
          tags: filters.tags,
          days: 7,
        })
      ),
  });
}
