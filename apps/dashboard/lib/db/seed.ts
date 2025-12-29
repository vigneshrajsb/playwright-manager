import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  tests,
  testRuns,
  testResults,
  testHealth,
  type NewTest,
  type NewTestRun,
  type NewTestResult,
  type NewTestHealth,
} from "./schema";

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

// Sample test data
const sampleTests: NewTest[] = [
  {
    playwrightTestId: "test-1-chromium",
    repository: "org/sample-app",
    filePath: "tests/auth/login.spec.ts",
    testTitle: "should login with valid credentials",
    projectName: "chromium",
    tags: ["@auth", "@smoke"],
    locationLine: 10,
    locationColumn: 5,
    isEnabled: true,
  },
  {
    playwrightTestId: "test-1-firefox",
    repository: "org/sample-app",
    filePath: "tests/auth/login.spec.ts",
    testTitle: "should login with valid credentials",
    projectName: "firefox",
    tags: ["@auth", "@smoke"],
    locationLine: 10,
    locationColumn: 5,
    isEnabled: true,
  },
  {
    playwrightTestId: "test-2-chromium",
    repository: "org/sample-app",
    filePath: "tests/auth/login.spec.ts",
    testTitle: "should show error for invalid password",
    projectName: "chromium",
    tags: ["@auth", "@negative"],
    locationLine: 25,
    locationColumn: 5,
    isEnabled: true,
  },
  {
    playwrightTestId: "test-3-chromium",
    repository: "org/sample-app",
    filePath: "tests/dashboard/overview.spec.ts",
    testTitle: "should display user stats",
    projectName: "chromium",
    tags: ["@dashboard"],
    locationLine: 8,
    locationColumn: 5,
    isEnabled: false,
    disabledReason: "Flaky test - needs investigation",
  },
  {
    playwrightTestId: "test-4-chromium",
    repository: "org/sample-app",
    filePath: "tests/dashboard/overview.spec.ts",
    testTitle: "should navigate to settings",
    projectName: "chromium",
    tags: ["@dashboard", "@navigation"],
    locationLine: 20,
    locationColumn: 5,
    isEnabled: true,
  },
  {
    playwrightTestId: "test-5-chromium",
    repository: "org/sample-app",
    filePath: "tests/api/users.spec.ts",
    testTitle: "should create new user",
    projectName: "chromium",
    tags: ["@api", "@users"],
    locationLine: 15,
    locationColumn: 5,
    isEnabled: true,
  },
  {
    playwrightTestId: "test-6-chromium",
    repository: "org/sample-app",
    filePath: "tests/api/users.spec.ts",
    testTitle: "should delete user",
    projectName: "chromium",
    tags: ["@api", "@users"],
    locationLine: 30,
    locationColumn: 5,
    isEnabled: true,
  },
  {
    playwrightTestId: "test-7-webkit",
    repository: "org/sample-app",
    filePath: "tests/mobile/responsive.spec.ts",
    testTitle: "should display mobile menu",
    projectName: "webkit",
    tags: ["@mobile", "@responsive"],
    locationLine: 12,
    locationColumn: 5,
    isEnabled: true,
  },
];

async function seed() {
  console.log("🌱 Seeding database...\n");

  // Clear existing data
  console.log("Clearing existing data...");
  await db.delete(testHealth);
  await db.delete(testResults);
  await db.delete(testRuns);
  await db.delete(tests);
  console.log("✓ Cleared existing data\n");

  // Insert tests
  console.log("Inserting tests...");
  const insertedTests = await db.insert(tests).values(sampleTests).returning();
  console.log(`✓ Inserted ${insertedTests.length} tests\n`);

  // Create sample test runs
  const now = new Date();
  const runs: NewTestRun[] = [
    {
      runId: "run-001",
      branch: "main",
      commitSha: "abc123def456",
      commitMessage: "feat: add user authentication",
      playwrightVersion: "1.40.0",
      totalWorkers: 4,
      startedAt: new Date(now.getTime() - 3600000), // 1 hour ago
      finishedAt: new Date(now.getTime() - 3300000), // 55 min ago
      durationMs: 300000,
      totalTests: 8,
      passedCount: 6,
      failedCount: 1,
      skippedCount: 1,
      flakyCount: 0,
      status: "failed",
    },
    {
      runId: "run-002",
      branch: "main",
      commitSha: "def789ghi012",
      commitMessage: "fix: resolve login issue",
      playwrightVersion: "1.40.0",
      totalWorkers: 4,
      startedAt: new Date(now.getTime() - 7200000), // 2 hours ago
      finishedAt: new Date(now.getTime() - 6900000),
      durationMs: 300000,
      totalTests: 8,
      passedCount: 7,
      failedCount: 0,
      skippedCount: 1,
      flakyCount: 0,
      status: "passed",
    },
    {
      runId: "run-003",
      branch: "feature/dashboard",
      commitSha: "ghi345jkl678",
      commitMessage: "feat: add dashboard charts",
      playwrightVersion: "1.40.0",
      totalWorkers: 4,
      startedAt: new Date(now.getTime() - 86400000), // 1 day ago
      finishedAt: new Date(now.getTime() - 86100000),
      durationMs: 300000,
      totalTests: 8,
      passedCount: 5,
      failedCount: 2,
      skippedCount: 1,
      flakyCount: 1,
      status: "failed",
    },
  ];

  console.log("Inserting test runs...");
  const insertedRuns = await db.insert(testRuns).values(runs).returning();
  console.log(`✓ Inserted ${insertedRuns.length} test runs\n`);

  // Create sample test results
  const outcomes = ["expected", "unexpected", "skipped", "flaky"] as const;
  const statuses = ["passed", "failed", "skipped"] as const;

  console.log("Inserting test results...");
  let resultCount = 0;
  for (const run of insertedRuns) {
    for (const test of insertedTests) {
      // Skip some tests randomly to simulate real data
      if (Math.random() > 0.8 && test.isEnabled) continue;

      const isSkipped = !test.isEnabled;
      const status = isSkipped
        ? "skipped"
        : statuses[Math.floor(Math.random() * 2)]; // passed or failed
      const outcome = isSkipped
        ? "skipped"
        : status === "passed"
          ? "expected"
          : Math.random() > 0.7
            ? "flaky"
            : "unexpected";

      const result: NewTestResult = {
        testId: test.id,
        testRunId: run.id,
        status,
        expectedStatus: "passed",
        durationMs: Math.floor(Math.random() * 5000) + 1000,
        retryCount: outcome === "flaky" ? 1 : 0,
        workerIndex: Math.floor(Math.random() * 4),
        parallelIndex: Math.floor(Math.random() * 4),
        outcome,
        errorMessage:
          status === "failed" ? "Expected element to be visible" : null,
        errorStack:
          status === "failed"
            ? "Error: Expected element to be visible\n    at tests/example.spec.ts:15:10"
            : null,
        skippedByDashboard: isSkipped,
        startedAt: run.startedAt,
        attachments: [],
        annotations: isSkipped
          ? [{ type: "skip", description: "[dashboard] Disabled via Test Manager" }]
          : [],
      };

      await db.insert(testResults).values(result);
      resultCount++;
    }
  }
  console.log(`✓ Inserted ${resultCount} test results\n`);

  // Create test health records
  console.log("Inserting test health records...");
  for (const test of insertedTests) {
    const passRate = Math.floor(Math.random() * 40) + 60; // 60-100%
    const flakinessRate = Math.floor(Math.random() * 20); // 0-20%
    const healthScore = Math.max(0, passRate - flakinessRate * 2);

    const health: NewTestHealth = {
      testId: test.id,
      totalRuns: Math.floor(Math.random() * 50) + 10,
      passedCount: Math.floor(Math.random() * 40) + 5,
      failedCount: Math.floor(Math.random() * 10),
      skippedCount: test.isEnabled ? 0 : Math.floor(Math.random() * 5),
      flakyCount: Math.floor(Math.random() * 5),
      passRate: passRate.toString(),
      flakinessRate: flakinessRate.toString(),
      avgDurationMs: Math.floor(Math.random() * 3000) + 500,
      healthScore,
      trend: healthScore > 80 ? "stable" : healthScore > 50 ? "degrading" : "critical",
      consecutivePasses: healthScore > 80 ? Math.floor(Math.random() * 10) + 1 : 0,
      consecutiveFailures: healthScore < 50 ? Math.floor(Math.random() * 5) + 1 : 0,
      lastStatus: test.isEnabled ? (Math.random() > 0.3 ? "passed" : "failed") : "skipped",
      lastRunAt: now,
    };

    await db.insert(testHealth).values(health);
  }
  console.log(`✓ Inserted ${insertedTests.length} test health records\n`);

  console.log("✅ Seeding complete!\n");
  console.log("Summary:");
  console.log(`  - ${insertedTests.length} tests`);
  console.log(`  - ${insertedRuns.length} test runs`);
  console.log(`  - ${resultCount} test results`);
  console.log(`  - ${insertedTests.length} test health records`);

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
