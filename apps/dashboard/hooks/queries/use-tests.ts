"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type TestFilters } from "./keys";
import type { Test, Pagination, TestFiltersData } from "@/types";

interface TestsResponse {
  tests: Test[];
  pagination: Pagination;
}

interface TestFiltersResponse {
  repositories: string[];
  projects: string[];
  tags: string[];
}

export function useTests(filters: TestFilters) {
  return useQuery({
    queryKey: queryKeys.tests.list(filters),
    queryFn: () =>
      apiFetch<TestsResponse>(
        buildUrl("/api/tests", {
          search: filters.search,
          repository: filters.repository,
          project: filters.project,
          tags: filters.tags,
          status: filters.status,
          health: filters.health,
          sortBy: filters.sortBy,
          page: filters.page,
          limit: 20,
        })
      ),
  });
}

/**
 * Fetch filter options (repositories, projects, tags) for tests
 * Uses longer staleTime since these rarely change
 */
export function useTestFilters() {
  return useQuery({
    queryKey: ["tests", "filters"],
    queryFn: () => apiFetch<TestFiltersResponse>("/api/tests/filters"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

interface ToggleTestsParams {
  testIds: string[];
  enabled: boolean;
  reason?: string;
  branchPattern?: string;
  envPattern?: string;
}

export function useToggleTests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      testIds,
      enabled,
      reason,
      branchPattern,
      envPattern,
    }: ToggleTestsParams) => {
      return apiFetch("/api/tests/toggle", {
        method: "POST",
        body: JSON.stringify({
          testIds,
          enabled,
          reason,
          branchPattern,
          envPattern,
        }),
      });
    },
    onSuccess: (_, { testIds, enabled, branchPattern, envPattern }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      const count = testIds.length;
      const isConditional = branchPattern || envPattern;
      toast.success(
        `${count} test${count > 1 ? "s" : ""} ${enabled ? "enabled" : isConditional ? "conditionally disabled" : "disabled"}`
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to toggle tests"
      );
    },
  });
}

interface DeleteTestsParams {
  testIds: string[];
  reason: string;
}

export function useDeleteTests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ testIds, reason }: DeleteTestsParams) => {
      const promises = testIds.map((id) =>
        apiFetch(`/api/tests/${id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: (_, { testIds }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      const count = testIds.length;
      toast.success(`${count} test${count > 1 ? "s" : ""} deleted`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete tests"
      );
    },
  });
}
