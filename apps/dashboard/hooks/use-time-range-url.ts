"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook to build URLs that preserve time range context across navigation.
 * Propagates either `timeRange` (relative like "24h") OR `startDate`/`endDate` (custom range).
 */
export function useTimeRangeUrl() {
  const searchParams = useSearchParams();

  const buildUrl = useCallback(
    (
      path: string,
      additionalParams?: Record<string, string | undefined>
    ): string => {
      const params = new URLSearchParams();

      // Propagate time range params from current URL
      const timeRange = searchParams.get("timeRange");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      // Custom date range takes precedence over relative time range
      if (startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      } else if (timeRange) {
        params.set("timeRange", timeRange);
      }

      // Merge additional params (may override time range if needed)
      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          if (value !== undefined) {
            params.set(key, value);
          }
        });
      }

      const queryString = params.toString();
      return queryString ? `${path}?${queryString}` : path;
    },
    [searchParams]
  );

  return { buildUrl };
}
