export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BaseFiltersData {
  repositories: string[];
  projects: string[];
  tags: string[];
}

export interface TestFiltersData extends BaseFiltersData {}

export interface ResultFiltersData extends BaseFiltersData {
  statuses: string[];
  outcomes: string[];
}

export interface PipelineFiltersData {
  branches: string[];
  repositories: string[];
  statuses: string[];
}

export interface TestHealth {
  healthScore: number;
  passRate: string;
  flakinessRate: string;
  recentPassRate?: string;
  recentFlakinessRate?: string;
  healthDivergence?: string;
  lastRunAt: string | null;
}

export interface TestHealthWithFailures extends TestHealth {
  consecutiveFailures: number;
}

export interface SkipRule {
  id: string;
  testId: string;
  branchPattern: string | null;
  envPattern: string | null;
  reason: string;
  createdAt: string;
}

export interface Test {
  id: string;
  testTitle: string;
  filePath: string;
  repository: string;
  projectName: string;
  tags: string[] | null;
  lastSeenAt: string;
  health: TestHealth | null;
  skipRules?: SkipRule[];
}

export interface TestWithHealth {
  id: string;
  testTitle: string;
  filePath: string;
  projectName: string;
  health: {
    healthScore: number;
    passRate: string;
    flakinessRate: string;
    recentPassRate?: string;
    recentFlakinessRate?: string;
    healthDivergence?: string;
    consecutiveFailures: number;
  };
}

export interface TestResultRun {
  id: string;
  runId: string;
  branch: string | null;
  commitSha: string | null;
  status: string;
  startedAt: string;
}

export interface TestResultTest {
  id: string;
  testTitle: string;
  filePath: string;
  projectName: string;
  repository: string;
  tags: string[] | null;
}

export interface TestResult {
  id: string;
  testId: string;
  testRunId: string;
  status: string;
  expectedStatus: string;
  outcome: string;
  durationMs: number;
  errorMessage: string | null;
  retryCount: number;
  startedAt: string;
  baseUrl: string | null;
  test: TestResultTest;
  run: TestResultRun;
}

export interface RunInfo {
  id: string;
  runId: string;
  branch: string | null;
  commitSha: string | null;
  status: string;
  startedAt: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
}

export interface TestInfo {
  id: string;
  testTitle: string;
  filePath: string;
  projectName: string;
}

export interface Pipeline {
  id: string;
  runId: string;
  repository: string | null;
  branch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  ciJobUrl: string | null;
  baseUrl: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  flakyCount: number;
}

export interface RecentRun {
  id: string;
  runId: string;
  branch: string | null;
  commitSha: string | null;
  status: string;
  startedAt: string;
  passRate: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
}

export interface Overview {
  totalTests: number;
  enabledTests: number;
  disabledTests: number;
  avgHealthScore: number;
  overallPassRate: number;
  flakyCount: number;
  healthDistribution: {
    healthy?: number;
    warning?: number;
    critical?: number;
  };
}

export interface PassRateTimeline {
  date: string;
  passRate: number;
  totalTests: number;
  totalRuns: number;
}

export interface DashboardData {
  overview: Overview;
  recentRuns: RecentRun[];
  passRateTimeline: PassRateTimeline[];
  flakyTests: TestWithHealth[];
  failingTests: TestWithHealth[];
  filters: BaseFiltersData;
}
