"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "./keys";
import type { SkipRule } from "@/types";

interface SkipRulesResponse {
  rules: SkipRule[];
}

/**
 * Fetch skip rules for a specific test
 */
export function useSkipRules(testId: string | null) {
  return useQuery({
    queryKey: queryKeys.skipRules.list(testId),
    queryFn: () =>
      apiFetch<SkipRulesResponse>(`/api/tests/${testId}/rules`),
    enabled: !!testId,
  });
}

interface DeleteSkipRuleParams {
  testId: string;
  ruleId: string;
}

/**
 * Delete a skip rule (soft-delete)
 */
export function useDeleteSkipRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, ruleId }: DeleteSkipRuleParams) =>
      apiFetch(`/api/tests/${testId}/rules/${ruleId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, { testId }) => {
      // Invalidate skip rules for this test
      queryClient.invalidateQueries({
        queryKey: queryKeys.skipRules.list(testId),
      });
      // Also invalidate tests list to update the skip rules badges
      queryClient.invalidateQueries({
        queryKey: queryKeys.tests.all,
      });
      toast.success("Skip rule deleted");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete skip rule"
      );
    },
  });
}
