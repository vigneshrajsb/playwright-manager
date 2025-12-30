"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, buildUrl } from "@/lib/api";
import { queryKeys, type QuarantinedFilters } from "./keys";
import type { Pagination, SkipRule } from "@/types";

export interface QuarantinedRule extends SkipRule {
  test: {
    id: string;
    testTitle: string;
    filePath: string;
    projectName: string;
    repository: string;
  };
}

interface QuarantinedResponse {
  rules: QuarantinedRule[];
  pagination: Pagination;
  filters: {
    repositories: string[];
    projects: string[];
  };
}

export function useQuarantinedRules(filters: QuarantinedFilters) {
  return useQuery({
    queryKey: queryKeys.quarantined.list(filters),
    queryFn: () =>
      apiFetch<QuarantinedResponse>(
        buildUrl("/api/quarantined", {
          search: filters.search,
          repository: filters.repository,
          project: filters.project,
          ruleType: filters.ruleType,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          page: filters.page,
          limit: 20,
        })
      ),
  });
}

interface UpdateSkipRuleParams {
  id: string;
  reason?: string;
  branchPattern?: string | null;
  envPattern?: string | null;
}

export function useUpdateSkipRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reason,
      branchPattern,
      envPattern,
    }: UpdateSkipRuleParams) => {
      return apiFetch(`/api/quarantined/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          reason,
          branchPattern,
          envPattern,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quarantined.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.skipRules.all });
      toast.success("Rule updated successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update rule"
      );
    },
  });
}

export function useDeleteQuarantinedRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/api/quarantined/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quarantined.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.skipRules.all });
      toast.success("Rule deleted successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete rule"
      );
    },
  });
}

interface BulkDeleteParams {
  ruleIds: string[];
}

export function useBulkDeleteQuarantined() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleIds }: BulkDeleteParams) => {
      return apiFetch("/api/quarantined/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ruleIds }),
      });
    },
    onSuccess: (_, { ruleIds }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quarantined.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.skipRules.all });
      const count = ruleIds.length;
      toast.success(`${count} rule${count > 1 ? "s" : ""} deleted`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete rules"
      );
    },
  });
}
