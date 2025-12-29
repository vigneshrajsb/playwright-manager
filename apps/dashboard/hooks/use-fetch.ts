"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseFetchState<T> {
  /** The fetched data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

export interface UseFetchOptions {
  /** Skip the initial fetch */
  skip?: boolean;
  /** Custom error message prefix */
  errorPrefix?: string;
}

export interface UseFetchReturn<T> extends UseFetchState<T> {
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Clear the error state */
  clearError: () => void;
  /** Set data manually (useful for optimistic updates) */
  setData: (data: T | null | ((prev: T | null) => T | null)) => void;
}

/**
 * Hook for fetching data with loading and error states
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useFetch<TestsResponse>(
 *   `/api/tests?page=${page}`,
 *   [page] // refetch when page changes
 * );
 *
 * if (loading) return <Loader />;
 * if (error) return <ErrorMessage message={error} onRetry={refetch} />;
 * return <TestsList tests={data.tests} />;
 * ```
 */
export function useFetch<T>(
  url: string | null,
  dependencies: unknown[] = [],
  options: UseFetchOptions = {}
): UseFetchReturn<T> {
  const { skip = false, errorPrefix = "Failed to fetch" } = options;

  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: !skip,
    error: null,
  });

  // Use ref to track if component is mounted
  const isMounted = useRef(true);
  // Use ref to store abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Don't fetch if URL is null or skip is true
    if (!url || skip) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    // Abort previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Only update state if component is still mounted and request wasn't aborted
      if (isMounted.current && !abortController.signal.aborted) {
        setState({ data, loading: false, error: null });
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      // Only update state if component is still mounted
      if (isMounted.current) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: `${errorPrefix}: ${message}`,
        }));
        console.error(`${errorPrefix}:`, err);
      }
    }
  }, [url, skip, errorPrefix]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Clear error state
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Set data manually (for optimistic updates)
  const setData = useCallback(
    (dataOrUpdater: T | null | ((prev: T | null) => T | null)) => {
      setState((prev) => ({
        ...prev,
        data:
          typeof dataOrUpdater === "function"
            ? (dataOrUpdater as (prev: T | null) => T | null)(prev.data)
            : dataOrUpdater,
      }));
    },
    []
  );

  return {
    ...state,
    refetch,
    clearError,
    setData,
  };
}

/**
 * Hook for making mutations (POST, PATCH, DELETE) with loading and error states
 *
 * @example
 * ```tsx
 * const { mutate, loading, error } = useMutation<Test>();
 *
 * const handleDelete = async (id: string) => {
 *   const result = await mutate(`/api/tests/${id}`, { method: 'DELETE' });
 *   if (result) refetchTests();
 * };
 * ```
 */
export function useMutation<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (
      url: string,
      options: RequestInit = {}
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          ...options,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Handle empty responses (204 No Content)
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        setLoading(false);
        return data as T;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setLoading(false);
        console.error("Mutation failed:", err);
        return null;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    clearError,
  };
}
