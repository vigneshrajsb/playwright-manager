import { test as base } from "@playwright/test";
import type { TestManagerFixtureOptions, DisabledTestsResponse } from "./types";
import { disabledTestsCache } from "./cache";

/**
 * Fetch ALL disabled tests for a repository/project from the API
 * This fetches all disabled tests at once so we can cache them properly
 */
async function fetchDisabledTestsForProject(
  apiUrl: string,
  repository: string,
  projectName: string,
  timeout: number
): Promise<DisabledTestsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiUrl}/api/tests/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Don't send testIds - fetch ALL disabled tests for this repo/project
        repository,
        projectName,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return (await response.json()) as DisabledTestsResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get disabled tests with caching and request deduplication
 * Fetches ALL disabled tests for the repository/project and caches them
 */
async function getDisabledTests(
  apiUrl: string,
  repository: string,
  projectName: string,
  cacheTtl: number,
  timeout: number,
  debug: boolean = false
): Promise<DisabledTestsResponse> {
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log("[TestManagerFixture]", ...args);
    }
  };

  // Use repository:project as cache key to separate different repos
  const cacheKey = `${repository}:${projectName}`;

  // Check cache first
  const cached = disabledTestsCache.get(cacheKey, cacheTtl);
  if (cached) {
    log("Cache hit", { cacheKey, disabledCount: Object.keys(cached.disabledTests).length });
    return cached;
  }

  // Check for pending request (deduplication)
  const pending = disabledTestsCache.getPendingRequest(cacheKey);
  if (pending) {
    log("Waiting for pending request", { cacheKey });
    return pending;
  }

  // Create new request - fetch ALL disabled tests for this repo/project
  log("Fetching disabled tests from API", { cacheKey, apiUrl, timeout });
  const request = fetchDisabledTestsForProject(apiUrl, repository, projectName, timeout);
  disabledTestsCache.setPendingRequest(cacheKey, request);

  try {
    const result = await request;
    disabledTestsCache.set(cacheKey, result);
    log("Cached disabled tests", { cacheKey, disabledCount: Object.keys(result.disabledTests).length, ttl: cacheTtl });
    return result;
  } finally {
    disabledTestsCache.clearPendingRequest(cacheKey);
  }
}

/**
 * Extended test fixtures type
 */
type TestManagerFixtures = {
  testManager: TestManagerFixtureOptions;
  _testManagerAutoSkip: void;
};

/**
 * Extended test object with auto-skip functionality
 *
 * Tests imported from this package will automatically check
 * if they are disabled in the Test Manager Dashboard before running.
 */
export const test = base.extend<TestManagerFixtures>({
  // User-configurable testManager options
  testManager: [{ apiUrl: "", repository: "" }, { option: true }],

  // Auto fixture - runs before every test automatically
  _testManagerAutoSkip: [
    async ({ testManager: options }, use, testInfo) => {
      // Skip if disabled or not configured
      if (options?.disabled || !options?.apiUrl) {
        await use();
        return;
      }

      // Repository is required
      if (!options?.repository) {
        throw new Error(
          "[TestManagerFixture] repository option is required. Example: { repository: 'org/repo' }"
        );
      }

      const {
        apiUrl,
        repository,
        cacheTtl = 60000,
        failSilently = true,
        debug = false,
        timeout = 5000,
      } = options;

      const log = (...args: unknown[]) => {
        if (debug) {
          console.log("[TestManagerFixture]", ...args);
        }
      };

      let disabledInfo: { reason?: string } | undefined;

      // Fetch disabled tests - API errors are caught here
      try {
        log("Checking test status", {
          testId: testInfo.testId,
          title: testInfo.title,
          project: testInfo.project.name,
          repository,
          apiUrl,
        });

        const disabledTests = await getDisabledTests(
          apiUrl,
          repository,
          testInfo.project.name,
          cacheTtl,
          timeout,
          debug
        );

        disabledInfo = disabledTests.disabledTests[testInfo.testId];
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log("Error checking disabled status", {
          testId: testInfo.testId,
          error: errorMessage,
          apiUrl,
          failSilently,
        });

        if (!failSilently) {
          throw new Error(
            `[TestManagerFixture] Failed to check disabled status: ${errorMessage}`
          );
        }

        log("failSilently enabled, continuing with test despite error");
      }

      // Skip test if disabled - OUTSIDE try-catch so skip exception propagates
      if (disabledInfo) {
        const reason = disabledInfo.reason || "Disabled via dashboard";
        log("Skipping disabled test", {
          testId: testInfo.testId,
          title: testInfo.title,
          reason,
        });
        testInfo.skip(true, `[dashboard] ${reason}`);
        // Don't call use() - test is skipped
        return;
      }

      log("Test is enabled, proceeding", { testId: testInfo.testId });
      await use();
    },
    { auto: true },
  ],
});

// Re-export expect from Playwright
export { expect } from "@playwright/test";
