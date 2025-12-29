/**
 * Configuration options for the Test Manager Reporter
 */
export interface TestManagerReporterOptions {
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
   * Disable the reporter without removing config
   * @default false
   */
  disabled?: boolean;

  /**
   * Override the detected git branch
   * If not provided, auto-detects from CI environment
   */
  branch?: string;

  /**
   * Override the detected commit SHA
   * If not provided, auto-detects from CI environment
   */
  commitSha?: string;

  /**
   * Override the CI job URL
   * If not provided, auto-detects from CI environment
   * Use this for unrecognized CI systems
   */
  ciJobUrl?: string;

  /**
   * Number of test results to batch before sending to API
   * @default 50
   */
  batchSize?: number;

  /**
   * Time interval (ms) to flush results even if batch size not reached
   * @default 5000
   */
  flushInterval?: number;

  /**
   * If true, reporter won't throw errors if API is unreachable
   * @default true
   */
  failSilently?: boolean;

  /**
   * Custom run ID. If not provided, uses CI job ID or generates UUID
   */
  runId?: string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Test result data sent to the API
 */
export interface TestResultData {
  testId: string;
  filePath: string;
  title: string;
  titlePath: string[];
  projectName: string;
  tags: string[];
  location: {
    file: string;
    line: number;
    column: number;
  };
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  expectedStatus: "passed" | "failed" | "skipped" | "timedOut" | "interrupted";
  duration: number;
  retry: number;
  workerIndex: number;
  parallelIndex: number;
  outcome: "expected" | "unexpected" | "skipped" | "flaky";
  error?: {
    message: string;
    stack?: string;
  };
  attachments?: Array<{
    name: string;
    contentType: string;
    path?: string;
    body?: string;
  }>;
  annotations?: Array<{
    type: string;
    description?: string;
  }>;
  startTime: string;
  baseUrl?: string;
}

/**
 * Run metadata sent to the API
 */
export interface RunMetadata {
  repository: string;
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  ciJobUrl?: string;
  baseUrl?: string;
  playwrightVersion: string;
  workers: number;
  shardCurrent?: number;
  shardTotal?: number;
}

/**
 * Full report payload sent to the API
 */
export interface ReportPayload {
  runId: string;
  metadata: RunMetadata;
  startTime: string;
  endTime?: string;
  status: "running" | "passed" | "failed" | "interrupted";
  results: TestResultData[];
}

/**
 * CI environment detection result
 */
export interface CIEnvironment {
  isCI: boolean;
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  jobUrl?: string;
  runId?: string;
}
