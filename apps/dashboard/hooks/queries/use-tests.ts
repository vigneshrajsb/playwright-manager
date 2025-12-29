"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type TestFilters } from "./keys";
import type { Test, Pagination, TestFiltersData } from "@/types";

interface TestsResponse {
  tests: Test[];
  pagination: Pagination;
  filters: TestFiltersData;
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

interface ToggleTestsParams {
  testIds: string[];
  enabled: boolean;
  reason?: string;
}

export function useToggleTests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ testIds, enabled, reason }: ToggleTestsParams) => {
      const promises = testIds.map((id) =>
        apiFetch(`/api/tests/${id}/toggle`, {
          method: "PATCH",
          body: JSON.stringify({ enabled, reason }),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: (_, { testIds, enabled }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      const count = testIds.length;
      toast.success(
        `${count} test${count > 1 ? "s" : ""} ${enabled ? "enabled" : "disabled"}`
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
