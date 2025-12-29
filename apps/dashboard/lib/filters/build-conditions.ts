import { eq, ilike, and, or, sql, gte, lt, gt, lte, SQL } from "drizzle-orm";
import { tests, testHealth, testResults, testRuns } from "@/lib/db/schema";

/**
 * Build tag filter condition using PostgreSQL array overlap operator.
 * Uses parameterized queries to prevent SQL injection.
 */
export function buildTagCondition(tagList: string[]): SQL | undefined {
  if (!tagList.length) return undefined;

  // Use proper parameterization instead of sql.raw()
  // PostgreSQL ARRAY constructor with bound parameters
  const tagParams = tagList.map((tag) => sql`${tag}`);
  const tagArray = sql`ARRAY[${sql.join(tagParams, sql`, `)}]::text[]`;

  return sql`${tests.tags} && ${tagArray}`;
}

/**
 * Common filter conditions for tests table
 */
export interface TestFilterParams {
  search?: string | null;
  repository?: string | null;
  project?: string | null;
  tags?: string | null;
  status?: string | null; // enabled, disabled
  health?: string | null; // healthy, flaky, failing
  excludeDeleted?: boolean;
}

export function buildTestConditions(params: TestFilterParams): SQL[] {
  const conditions: SQL[] = [];

  // Always exclude deleted tests by default
  if (params.excludeDeleted !== false) {
    conditions.push(eq(tests.isDeleted, false));
  }

  if (params.search) {
    conditions.push(
      or(
        ilike(tests.testTitle, `%${params.search}%`),
        ilike(tests.filePath, `%${params.search}%`)
      )!
    );
  }

  if (params.repository) {
    conditions.push(eq(tests.repository, params.repository));
  }

  if (params.project) {
    conditions.push(eq(tests.projectName, params.project));
  }

  if (params.tags) {
    const tagList = params.tags.split(",").filter(Boolean);
    const tagCondition = buildTagCondition(tagList);
    if (tagCondition) {
      conditions.push(tagCondition);
    }
  }

  if (params.status === "enabled") {
    conditions.push(eq(tests.isEnabled, true));
  } else if (params.status === "disabled") {
    conditions.push(eq(tests.isEnabled, false));
  }

  return conditions;
}

/**
 * Build health-related filter conditions
 */
export function buildHealthConditions(health: string | null | undefined): SQL[] {
  const conditions: SQL[] = [];

  if (health === "healthy") {
    conditions.push(gte(testHealth.healthScore, 80));
  } else if (health === "flaky") {
    conditions.push(gt(sql`CAST(${testHealth.flakinessRate} AS numeric)`, 10));
  } else if (health === "failing") {
    conditions.push(lt(testHealth.healthScore, 50));
  }

  return conditions;
}

/**
 * Check if a health filter requires an inner join
 */
export function needsHealthInnerJoin(health: string | null | undefined): boolean {
  return health === "healthy" || health === "flaky" || health === "failing";
}

/**
 * Common filter conditions for test results
 */
export interface ResultFilterParams {
  search?: string | null;
  repository?: string | null;
  project?: string | null;
  tags?: string | null;
  status?: string | null;
  outcome?: string | null;
  testRunId?: string | null;
  testId?: string | null;
}

export function buildResultConditions(params: ResultFilterParams): SQL[] {
  const conditions: SQL[] = [];

  if (params.search) {
    conditions.push(
      or(
        ilike(tests.testTitle, `%${params.search}%`),
        ilike(tests.filePath, `%${params.search}%`),
        ilike(testResults.baseUrl, `%${params.search}%`)
      )!
    );
  }

  if (params.repository) {
    conditions.push(eq(tests.repository, params.repository));
  }

  if (params.project) {
    conditions.push(eq(tests.projectName, params.project));
  }

  if (params.tags) {
    const tagList = params.tags.split(",").filter(Boolean);
    const tagCondition = buildTagCondition(tagList);
    if (tagCondition) {
      conditions.push(tagCondition);
    }
  }

  if (params.status) {
    conditions.push(eq(testResults.status, params.status));
  }

  if (params.outcome) {
    conditions.push(eq(testResults.outcome, params.outcome));
  }

  if (params.testRunId) {
    conditions.push(eq(testResults.testRunId, params.testRunId));
  }

  if (params.testId) {
    conditions.push(eq(testResults.testId, params.testId));
  }

  return conditions;
}

/**
 * Common filter conditions for test runs (pipelines)
 */
export interface PipelineFilterParams {
  search?: string | null;
  branch?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export function buildPipelineConditions(params: PipelineFilterParams): SQL[] {
  const conditions: SQL[] = [];

  if (params.search) {
    conditions.push(
      or(
        ilike(testRuns.branch, `%${params.search}%`),
        ilike(testRuns.commitMessage, `%${params.search}%`),
        ilike(testRuns.baseUrl, `%${params.search}%`)
      )!
    );
  }

  if (params.branch) {
    conditions.push(eq(testRuns.branch, params.branch));
  }

  if (params.status) {
    conditions.push(eq(testRuns.status, params.status));
  }

  if (params.startDate) {
    conditions.push(gte(testRuns.startedAt, new Date(params.startDate)));
  }

  if (params.endDate) {
    conditions.push(lte(testRuns.startedAt, new Date(params.endDate)));
  }

  return conditions;
}

/**
 * Combine conditions array into a single where clause
 */
export function combineConditions(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}
