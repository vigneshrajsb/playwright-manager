import { db } from "./index";
import { filterCache, tests } from "./schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface FilterOptions {
  repositories: string[];
  projects: string[];
  tags: string[];
}

/**
 * Get filter options with caching.
 * Caches filter dropdown values in the database with a 5-minute TTL.
 * Falls back to direct query if cache is stale or missing.
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  // Try to get from cache
  const cached = await db
    .select()
    .from(filterCache)
    .where(eq(filterCache.cacheKey, "filter_options"))
    .limit(1);

  const now = Date.now();
  if (cached[0] && now - cached[0].updatedAt.getTime() < CACHE_TTL_MS) {
    return cached[0].cacheValue as FilterOptions;
  }

  // Refresh cache - run queries in parallel
  const [repositoriesResult, projectsResult, tagsResult] = await Promise.all([
    db
      .selectDistinct({ value: tests.repository })
      .from(tests)
      .where(eq(tests.isDeleted, false)),
    db
      .selectDistinct({ value: tests.projectName })
      .from(tests)
      .where(eq(tests.isDeleted, false)),
    db
      .select({ tags: tests.tags })
      .from(tests)
      .where(
        and(
          eq(tests.isDeleted, false),
          isNotNull(tests.tags),
          sql`array_length(${tests.tags}, 1) > 0`
        )
      ),
  ]);

  const options: FilterOptions = {
    repositories: repositoriesResult
      .map((r) => r.value)
      .filter((v): v is string => Boolean(v))
      .sort(),
    projects: projectsResult
      .map((p) => p.value)
      .filter((v): v is string => Boolean(v))
      .sort(),
    tags: [...new Set(tagsResult.flatMap((t) => t.tags ?? []))].sort(),
  };

  // Upsert cache
  await db
    .insert(filterCache)
    .values({
      cacheKey: "filter_options",
      cacheValue: options,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: filterCache.cacheKey,
      set: { cacheValue: options, updatedAt: new Date() },
    });

  return options;
}

/**
 * Invalidate the filter cache.
 * Call this when tests are added/updated/deleted.
 */
export async function invalidateFilterCache(): Promise<void> {
  await db
    .update(filterCache)
    .set({ updatedAt: new Date(0) }) // Set to epoch to force refresh
    .where(eq(filterCache.cacheKey, "filter_options"));
}
