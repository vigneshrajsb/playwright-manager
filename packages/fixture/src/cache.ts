import type { CachedDisabledTests, DisabledTestsResponse } from "./types";

/**
 * Worker-level cache for disabled tests
 * Each Playwright worker has its own process, so this cache is per-worker
 */
class DisabledTestsCache {
  private cache: Map<string, CachedDisabledTests> = new Map();
  private pendingRequests: Map<string, Promise<DisabledTestsResponse>> =
    new Map();

  /**
   * Get cached disabled tests for a project
   * @param projectName - The Playwright project name
   * @param ttl - Cache TTL in milliseconds
   * @returns Cached data if valid, undefined if expired or not cached
   */
  get(projectName: string, ttl: number): DisabledTestsResponse | undefined {
    const cached = this.cache.get(projectName);
    if (!cached) return undefined;

    const age = Date.now() - cached.fetchedAt;
    if (age > ttl) {
      this.cache.delete(projectName);
      return undefined;
    }

    return cached.data;
  }

  /**
   * Set cached disabled tests for a project
   */
  set(projectName: string, data: DisabledTestsResponse): void {
    this.cache.set(projectName, {
      data,
      fetchedAt: Date.now(),
    });
  }

  /**
   * Get or create a pending request for deduplication
   * Multiple tests might try to fetch at the same time
   */
  getPendingRequest(
    projectName: string
  ): Promise<DisabledTestsResponse> | undefined {
    return this.pendingRequests.get(projectName);
  }

  /**
   * Set a pending request
   */
  setPendingRequest(
    projectName: string,
    promise: Promise<DisabledTestsResponse>
  ): void {
    this.pendingRequests.set(projectName, promise);
  }

  /**
   * Clear a pending request
   */
  clearPendingRequest(projectName: string): void {
    this.pendingRequests.delete(projectName);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Singleton cache instance per worker
export const disabledTestsCache = new DisabledTestsCache();
