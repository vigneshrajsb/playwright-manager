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
   * Get cached disabled tests by cache key
   * @param cacheKey - The cache key (e.g., "repo:project:branch:baseURL")
   * @param ttl - Cache TTL in milliseconds
   * @returns Cached data if valid, undefined if expired or not cached
   */
  get(cacheKey: string, ttl: number): DisabledTestsResponse | undefined {
    const cached = this.cache.get(cacheKey);
    if (!cached) return undefined;

    const age = Date.now() - cached.fetchedAt;
    if (age > ttl) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return cached.data;
  }

  /**
   * Set cached disabled tests by cache key
   */
  set(cacheKey: string, data: DisabledTestsResponse): void {
    this.cache.set(cacheKey, {
      data,
      fetchedAt: Date.now(),
    });
  }

  /**
   * Get a pending request for deduplication
   * Multiple tests might try to fetch at the same time
   */
  getPendingRequest(
    cacheKey: string
  ): Promise<DisabledTestsResponse> | undefined {
    return this.pendingRequests.get(cacheKey);
  }

  /**
   * Set a pending request
   */
  setPendingRequest(
    cacheKey: string,
    promise: Promise<DisabledTestsResponse>
  ): void {
    this.pendingRequests.set(cacheKey, promise);
  }

  /**
   * Clear a pending request
   */
  clearPendingRequest(cacheKey: string): void {
    this.pendingRequests.delete(cacheKey);
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
