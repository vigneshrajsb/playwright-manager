import {
  pgTable,
  serial,
  integer,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================================
// Tests Table - Unique test definitions
// ============================================================================
export const tests = pgTable(
  "tests",
  {
    id: serial("id").primaryKey(),
    playwrightTestId: varchar("playwright_test_id", { length: 255 }).notNull(),
    repository: varchar("repository", { length: 255 }).notNull(), // e.g., "org/repo"
    filePath: varchar("file_path", { length: 1024 }).notNull(),
    testTitle: varchar("test_title", { length: 1024 }).notNull(),
    projectName: varchar("project_name", { length: 255 }).notNull(),
    tags: text("tags").array().default([]),
    locationLine: integer("location_line"),
    locationColumn: integer("location_column"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedReason: text("deleted_reason"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("unique_test").on(
      table.repository,
      table.filePath,
      table.testTitle,
      table.projectName
    ),
    index("idx_tests_playwright_id").on(table.playwrightTestId),
    index("idx_tests_deleted").on(table.isDeleted),
    index("idx_tests_project").on(table.projectName),
    index("idx_tests_repository").on(table.repository),
    // Composite index for common filter combination
    index("idx_tests_repo_project").on(table.repository, table.projectName),
    // GIN index for array containment on tags
    index("idx_tests_tags").using("gin", table.tags),
  ]
);

// ============================================================================
// Test Runs Table - Each CI/local test run
// ============================================================================
export const testRuns = pgTable(
  "test_runs",
  {
    id: serial("id").primaryKey(),
    runId: varchar("run_id", { length: 255 }).unique().notNull(),
    branch: varchar("branch", { length: 255 }),
    commitSha: varchar("commit_sha", { length: 40 }),
    commitMessage: text("commit_message"),
    ciJobUrl: varchar("ci_job_url", { length: 1024 }),
    baseUrl: varchar("base_url", { length: 1024 }),
    reportPath: varchar("report_path", { length: 1024 }), // S3 path to HTML report
    playwrightVersion: varchar("playwright_version", { length: 50 }),
    totalWorkers: integer("total_workers"),
    shardCurrent: integer("shard_current"),
    shardTotal: integer("shard_total"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    totalTests: integer("total_tests").default(0).notNull(),
    passedCount: integer("passed_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    flakyCount: integer("flaky_count").default(0).notNull(),
    status: varchar("status", { length: 50 }).default("running").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_test_runs_started_at").on(table.startedAt),
    index("idx_test_runs_status").on(table.status),
    index("idx_test_runs_branch").on(table.branch),
  ]
);

// ============================================================================
// Test Results Table - Individual test executions
// ============================================================================
export const testResults = pgTable(
  "test_results",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    testRunId: integer("test_run_id")
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 }).notNull(),
    expectedStatus: varchar("expected_status", { length: 50 }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    isFinalAttempt: boolean("is_final_attempt").default(true).notNull(),
    workerIndex: integer("worker_index"),
    parallelIndex: integer("parallel_index"),
    errorMessage: text("error_message"),
    errorStack: text("error_stack"),
    errorSnippet: text("error_snippet"),
    outcome: varchar("outcome", { length: 50 }).notNull(),
    attachments: jsonb("attachments").default([]).notNull(),
    annotations: jsonb("annotations").default([]).notNull(),
    skippedByDashboard: boolean("skipped_by_dashboard").default(false).notNull(),
    baseUrl: varchar("base_url", { length: 1024 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_test_results_test_id").on(table.testId),
    index("idx_test_results_test_run_id").on(table.testRunId),
    index("idx_test_results_status").on(table.status),
    index("idx_test_results_outcome").on(table.outcome),
    index("idx_test_results_started_at").on(table.startedAt),
    // Composite index for health calculation queries
    index("idx_test_results_health").on(
      table.testId,
      table.isFinalAttempt,
      table.startedAt
    ),
    // Composite index for run details page
    index("idx_test_results_run_details").on(table.testRunId, table.startedAt),
  ]
);

// ============================================================================
// Test Health Table - Aggregated health stats per test
// ============================================================================
export const testHealth = pgTable(
  "test_health",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" })
      .unique(),
    totalRuns: integer("total_runs").default(0).notNull(),
    passedCount: integer("passed_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    flakyCount: integer("flaky_count").default(0).notNull(),
    passRate: decimal("pass_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    flakinessRate: decimal("flakiness_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    recentPassRate: decimal("recent_pass_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    recentFlakinessRate: decimal("recent_flakiness_rate", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    healthDivergence: decimal("health_divergence", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    avgDurationMs: integer("avg_duration_ms").default(0).notNull(),
    healthScore: integer("health_score").default(100).notNull(),
    trend: varchar("trend", { length: 20 }).default("stable").notNull(),
    consecutivePasses: integer("consecutive_passes").default(0).notNull(),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    lastStatus: varchar("last_status", { length: 50 }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastPassedAt: timestamp("last_passed_at", { withTimezone: true }),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_test_health_health_score").on(table.healthScore),
    index("idx_test_health_pass_rate").on(table.passRate),
    // Partial index for flaky/failing tests (most common filter)
    index("idx_test_health_problematic")
      .on(table.healthScore)
      .where(sql`health_score < 80`),
  ]
);

// ============================================================================
// Skip Rules Table - Conditional skip rules per test
// ============================================================================
export const skipRules = pgTable(
  "skip_rules",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    branchPattern: varchar("branch_pattern", { length: 255 }), // null = all branches
    envPattern: varchar("env_pattern", { length: 1024 }), // null = all envs
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // null = active, set = soft deleted
  },
  (table) => [
    index("idx_skip_rules_test_id").on(table.testId),
    // Partial index for active rules only
    index("idx_skip_rules_active")
      .on(table.testId)
      .where(sql`deleted_at IS NULL`),
  ]
);

// ============================================================================
// Error Signatures Table - Track recurring error patterns
// ============================================================================
export const errorSignatures = pgTable(
  "error_signatures",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    signatureHash: varchar("signature_hash", { length: 64 }).notNull(),
    errorMessage: text("error_message").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    occurrenceCount: integer("occurrence_count").default(1).notNull(),
    passedAfterCount: integer("passed_after_count").default(0).notNull(),
  },
  (table) => [
    index("idx_error_sig_test_id").on(table.testId),
    uniqueIndex("idx_error_sig_unique").on(table.testId, table.signatureHash),
  ]
);

// ============================================================================
// Verdict Feedback Table - Track user feedback on flakiness verdicts
// ============================================================================
export const verdictFeedback = pgTable(
  "verdict_feedback",
  {
    id: serial("id").primaryKey(),
    testRunId: integer("test_run_id")
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" }),
    testId: integer("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    verdict: varchar("verdict", { length: 20 }).notNull(),
    confidence: integer("confidence").notNull(),
    llmUsed: boolean("llm_used").default(false).notNull(),
    feedback: varchar("feedback", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_verdict_feedback_test_run").on(table.testRunId),
    index("idx_verdict_feedback_test").on(table.testId),
  ]
);

// ============================================================================
// Prompt Settings Table - Versioned prompt templates
// ============================================================================
export const promptSettings = pgTable(
  "prompt_settings",
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    version: integer("version").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: text("created_by"), // "system" for default, or future user id
  },
  (table) => [
    index("idx_prompt_settings_is_active").on(table.isActive),
    index("idx_prompt_settings_version").on(table.version),
  ]
);

// ============================================================================
// Filter Cache Table - Cache for filter dropdown options
// ============================================================================
export const filterCache = pgTable("filter_cache", {
  id: serial("id").primaryKey(),
  cacheKey: varchar("cache_key", { length: 50 }).notNull().unique(),
  cacheValue: jsonb("cache_value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================================
// Relations
// ============================================================================
export const testsRelations = relations(tests, ({ many, one }) => ({
  results: many(testResults),
  health: one(testHealth, {
    fields: [tests.id],
    references: [testHealth.testId],
  }),
  skipRules: many(skipRules),
  errorSignatures: many(errorSignatures),
}));

export const testRunsRelations = relations(testRuns, ({ many }) => ({
  results: many(testResults),
}));

export const testResultsRelations = relations(testResults, ({ one }) => ({
  test: one(tests, {
    fields: [testResults.testId],
    references: [tests.id],
  }),
  testRun: one(testRuns, {
    fields: [testResults.testRunId],
    references: [testRuns.id],
  }),
}));

export const testHealthRelations = relations(testHealth, ({ one }) => ({
  test: one(tests, {
    fields: [testHealth.testId],
    references: [tests.id],
  }),
}));

export const skipRulesRelations = relations(skipRules, ({ one }) => ({
  test: one(tests, {
    fields: [skipRules.testId],
    references: [tests.id],
  }),
}));

export const errorSignaturesRelations = relations(errorSignatures, ({ one }) => ({
  test: one(tests, {
    fields: [errorSignatures.testId],
    references: [tests.id],
  }),
}));

export const verdictFeedbackRelations = relations(verdictFeedback, ({ one }) => ({
  testRun: one(testRuns, {
    fields: [verdictFeedback.testRunId],
    references: [testRuns.id],
  }),
  test: one(tests, {
    fields: [verdictFeedback.testId],
    references: [tests.id],
  }),
}));

// ============================================================================
// Types
// ============================================================================
export type Test = typeof tests.$inferSelect;
export type NewTest = typeof tests.$inferInsert;
export type TestRun = typeof testRuns.$inferSelect;
export type NewTestRun = typeof testRuns.$inferInsert;
export type TestResult = typeof testResults.$inferSelect;
export type NewTestResult = typeof testResults.$inferInsert;
export type TestHealth = typeof testHealth.$inferSelect;
export type NewTestHealth = typeof testHealth.$inferInsert;
export type SkipRule = typeof skipRules.$inferSelect;
export type NewSkipRule = typeof skipRules.$inferInsert;
export type ErrorSignature = typeof errorSignatures.$inferSelect;
export type NewErrorSignature = typeof errorSignatures.$inferInsert;
export type VerdictFeedback = typeof verdictFeedback.$inferSelect;
export type NewVerdictFeedback = typeof verdictFeedback.$inferInsert;
export type PromptSetting = typeof promptSettings.$inferSelect;
export type NewPromptSetting = typeof promptSettings.$inferInsert;
export type FilterCache = typeof filterCache.$inferSelect;
export type NewFilterCache = typeof filterCache.$inferInsert;
