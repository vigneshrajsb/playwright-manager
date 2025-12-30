export interface DashboardFilters {
  repository?: string;
  project?: string;
  tags?: string;
}

export interface TestFilters {
  search?: string;
  repository?: string;
  project?: string;
  tags?: string;
  status?: string;
  health?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
}

export interface PipelineFilters {
  search?: string;
  repository?: string;
  branch?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
}

export interface ResultFilters {
  search?: string;
  repository?: string;
  project?: string;
  tags?: string;
  status?: string;
  outcome?: string;
  testRunId?: string;
  testId?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
}

export interface QuarantinedFilters {
  search?: string;
  repository?: string;
  project?: string;
  ruleType?: string; // global, branch, env, branch+env
  sortBy?: string;
  sortOrder?: string;
  page?: number;
}

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    overview: (filters: DashboardFilters) =>
      ["dashboard", "overview", filters] as const,
  },
  tests: {
    all: ["tests"] as const,
    list: (filters: TestFilters) => ["tests", "list", filters] as const,
  },
  pipelines: {
    all: ["pipelines"] as const,
    list: (filters: PipelineFilters) => ["pipelines", "list", filters] as const,
  },
  results: {
    all: ["results"] as const,
    list: (filters: ResultFilters) => ["results", "list", filters] as const,
  },
  skipRules: {
    all: ["skipRules"] as const,
    list: (testId: string | null) => ["skipRules", "list", testId] as const,
  },
  quarantined: {
    all: ["quarantined"] as const,
    list: (filters: QuarantinedFilters) =>
      ["quarantined", "list", filters] as const,
  },
} as const;
