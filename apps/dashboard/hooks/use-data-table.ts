"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SortingState } from "@tanstack/react-table";

interface UseDataTableUrlStateOptions {
  basePath: string;
  defaultSortField?: string;
  defaultSortOrder?: "asc" | "desc";
}

export function useDataTableUrlState({
  basePath,
  defaultSortField = "createdAt",
  defaultSortOrder = "desc",
}: UseDataTableUrlStateOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse URL params
  const page = parseInt(searchParams.get("page") || "1");
  const pageIndex = page - 1; // TanStack uses 0-based index
  const sortBy = searchParams.get("sortBy") || defaultSortField;
  const sortOrder = searchParams.get("sortOrder") || defaultSortOrder;

  // Convert to TanStack sorting state
  const sorting: SortingState = useMemo(() => {
    if (!sortBy) return [];
    return [{ id: sortBy, desc: sortOrder === "desc" }];
  }, [sortBy, sortOrder]);

  // Update URL helper
  const updateUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      // Reset page when filters change (except when updating page itself)
      if (!("page" in updates)) {
        params.delete("page");
      }
      router.push(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath]
  );

  // Handle sorting change
  const onSortingChange = useCallback(
    (newSorting: SortingState) => {
      if (newSorting.length === 0) {
        updateUrl({ sortBy: undefined, sortOrder: undefined });
      } else {
        const { id, desc } = newSorting[0];
        updateUrl({ sortBy: id, sortOrder: desc ? "desc" : "asc" });
      }
    },
    [updateUrl]
  );

  // Handle page change
  const onPageChange = useCallback(
    (newPageIndex: number) => {
      updateUrl({ page: (newPageIndex + 1).toString() });
    },
    [updateUrl]
  );

  return {
    pageIndex,
    sorting,
    sortBy,
    sortOrder,
    updateUrl,
    onSortingChange,
    onPageChange,
    searchParams,
  };
}
