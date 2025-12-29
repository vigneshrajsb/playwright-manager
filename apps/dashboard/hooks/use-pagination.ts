"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsePaginationOptions {
  /** Default items per page */
  defaultLimit?: number;
  /** Base path for URL updates (defaults to current pathname) */
  basePath?: string;
}

export interface UsePaginationReturn {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Go to a specific page */
  goToPage: (page: number) => void;
  /** Go to previous page */
  previousPage: () => void;
  /** Go to next page */
  nextPage: () => void;
  /** Check if there's a previous page */
  hasPreviousPage: boolean;
  /** Check if there's a next page (requires totalPages) */
  hasNextPage: (totalPages: number) => boolean;
  /** Calculate offset for database queries */
  offset: number;
  /** Get pagination display text */
  getPaginationText: (total: number) => string;
  /** Update any URL parameter (resets page to 1 unless updating page) */
  updateParams: (updates: Record<string, string>) => void;
}

/**
 * Hook for managing URL-based pagination state
 *
 * @example
 * ```tsx
 * const { page, limit, goToPage, previousPage, nextPage, offset } = usePagination();
 *
 * // In your fetch
 * const response = await fetch(`/api/items?page=${page}&limit=${limit}`);
 *
 * // In your UI
 * <Button onClick={previousPage} disabled={!hasPreviousPage}>Previous</Button>
 * <Button onClick={nextPage} disabled={!hasNextPage(totalPages)}>Next</Button>
 * ```
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { defaultLimit = 20 } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const basePath = options.basePath || pathname;

  // Parse current page from URL
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);

  // Calculate offset for database queries
  const offset = (page - 1) * limit;

  // Update URL with new parameters
  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      // Reset to page 1 when filters change (unless explicitly updating page)
      if (!("page" in updates)) {
        params.delete("page");
      }

      router.push(`${basePath}?${params.toString()}`);
    },
    [router, basePath, searchParams]
  );

  // Go to a specific page
  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage < 1) return;
      updateParams({ page: newPage.toString() });
    },
    [updateParams]
  );

  // Go to previous page
  const previousPage = useCallback(() => {
    if (page > 1) {
      goToPage(page - 1);
    }
  }, [page, goToPage]);

  // Go to next page
  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [page, goToPage]);

  // Check if there's a previous page
  const hasPreviousPage = page > 1;

  // Check if there's a next page
  const hasNextPage = useCallback(
    (totalPages: number) => page < totalPages,
    [page]
  );

  // Get pagination display text
  const getPaginationText = useCallback(
    (total: number) => {
      const start = (page - 1) * limit + 1;
      const end = Math.min(page * limit, total);
      return `Showing ${start} to ${end} of ${total}`;
    },
    [page, limit]
  );

  return {
    page,
    limit,
    goToPage,
    previousPage,
    nextPage,
    hasPreviousPage,
    hasNextPage,
    offset,
    getPaginationText,
    updateParams,
  };
}
