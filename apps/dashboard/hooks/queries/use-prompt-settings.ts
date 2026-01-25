"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "./keys";

export interface PromptVersion {
  id: string;
  version: number;
  createdAt: string;
  isActive: boolean;
}

export interface ActivePrompt {
  id: string;
  content: string;
  version: number;
  createdAt: string;
}

interface PromptSettingsResponse {
  active: ActivePrompt | null;
  history: PromptVersion[];
  default: string;
}

interface SavePromptResponse {
  success: boolean;
  prompt: ActivePrompt;
}

interface TestPromptResponse {
  success: boolean;
  sampleTest: {
    title: string;
    filePath: string;
    failedAt: string;
  };
  renderedPrompt: string;
  llmResponse: string | null;
  llmConfigured: boolean;
}

interface RestorePromptResponse {
  success: boolean;
  prompt: ActivePrompt;
  restoredFrom: number;
}

/**
 * Fetch prompt settings (active prompt + version history)
 */
export function usePromptSettings() {
  return useQuery({
    queryKey: queryKeys.promptSettings.detail(),
    queryFn: () => apiFetch<PromptSettingsResponse>("/api/settings/prompt"),
  });
}

/**
 * Save a new prompt version
 */
export function useSavePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<SavePromptResponse>("/api/settings/prompt", {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.promptSettings.all,
      });
      toast.success("Prompt saved successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save prompt"
      );
    },
  });
}

/**
 * Test a prompt against the latest failed test
 */
export function useTestPrompt() {
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<TestPromptResponse>("/api/settings/prompt/test", {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to test prompt"
      );
    },
  });
}

/**
 * Restore a previous prompt version
 */
export function useRestorePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) =>
      apiFetch<RestorePromptResponse>("/api/settings/prompt/restore", {
        method: "POST",
        body: JSON.stringify({ versionId }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.promptSettings.all,
      });
      toast.success(`Restored from version ${data.restoredFrom}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to restore prompt"
      );
    },
  });
}
