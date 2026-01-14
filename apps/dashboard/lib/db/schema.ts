import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  text,
  jsonb,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Tests Table - Unique test definitions
// ============================================================================
export const tests = pgTable(
  "tests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
  ]
);

// ============================================================================
// Test Runs Table - Each CI/local test run
// ============================================================================
export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: varchar("run_id", { length: 255 }).unique().notNull(),
    branch: varchar("branch", { length: 255 }),
    commitSha: varchar("commit_sha", { length: 40 }),
    commitMessage: text("commit_message"),
    ciJobUrl: varchar("ci_job_url", { length: 1024 }),
    baseUrl: varchar("base_url", { length: 1024 }),
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
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    testRunId: uuid("test_run_id")
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
  ]
);

// ============================================================================
// Test Health Table - Aggregated health stats per test
// ============================================================================
export const testHealth = pgTable(
  "test_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
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
  ]
);

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

// ============================================================================
// Skip Rules Table - Conditional skip rules per test
// ============================================================================
export const skipRules = pgTable(
  "skip_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
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
  (table) => [index("idx_skip_rules_test_id").on(table.testId)]
);

export const skipRulesRelations = relations(skipRules, ({ one }) => ({
  test: one(tests, {
    fields: [skipRules.testId],
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
