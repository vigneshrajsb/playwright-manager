/**
 * Configuration options for the Test Manager Fixture
 */
export interface TestManagerFixtureOptions {
  /**
   * URL of the Test Manager Dashboard API
   * @example "http://localhost:3000"
   */
  apiUrl: string;

  /**
   * GitHub repository in org/repo format
   * @example "vigneshrajsb/devtools"
   */
  repository: string;

  /**
   * Disable the fixture without removing config
   * When true, skips the disabled tests check entirely
   * @default false
   */
  disabled?: boolean;

  /**
   * Cache TTL in milliseconds
   * Disabled tests are cached per worker to reduce API calls
   * @default 60000 (1 minute)
   */
  cacheTtl?: number;

  /**
   * If true, API errors are suppressed and tests continue
   * If false, test fails on API errors
   * @default true
   */
  failSilently?: boolean;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Request timeout in milliseconds
   * @default 5000
   */
  timeout?: number;
}

/**
 * Response from the disabled tests check API
 */
export interface DisabledTestsResponse {
  disabledTests: Record<
    string,
    {
      reason?: string;
    }
  >;
  timestamp: number;
}

/**
 * Cached disabled tests data
 */
export interface CachedDisabledTests {
  data: DisabledTestsResponse;
  fetchedAt: number;
}
