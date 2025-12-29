# @playwright-manager/reporter

Playwright reporter that sends test results to the Playwright Manager Dashboard for tracking, flaky test detection, and remote test management.

## Features

- Real-time test result reporting to your dashboard
- Automatic CI environment detection (GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure DevOps, Codefresh)
- Flaky test identification based on retry behavior
- Tag and annotation support
- Sharded test run tracking

## Installation

```bash
npm install @playwright-manager/reporter
# or
pnpm add @playwright-manager/reporter
# or
yarn add @playwright-manager/reporter
```

## Quick Start

Add the reporter to your `playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://your-dashboard.example.com",
        repository: "your-org/your-repo",
      },
    ],
  ],
});
```

## Configuration Options

| Option          | Type      | Required | Default       | Description                                  |
| --------------- | --------- | -------- | ------------- | -------------------------------------------- |
| `apiUrl`        | `string`  | Yes      | -             | URL of your Playwright Manager Dashboard     |
| `repository`    | `string`  | Yes      | -             | Repository identifier in `org/repo` format   |
| `disabled`      | `boolean` | No       | `false`       | Disable the reporter without removing config |
| `branch`        | `string`  | No       | auto-detect   | Override the git branch name                 |
| `commitSha`     | `string`  | No       | auto-detect   | Override the commit SHA                      |
| `ciJobUrl`      | `string`  | No       | auto-detect   | Override the CI job URL                      |
| `batchSize`     | `number`  | No       | `50`          | Number of results to batch before sending    |
| `flushInterval` | `number`  | No       | `5000`        | Interval (ms) to flush results               |
| `failSilently`  | `boolean` | No       | `true`        | Suppress errors if dashboard is unreachable  |
| `runId`         | `string`  | No       | auto-generate | Custom identifier for the test run           |
| `debug`         | `boolean` | No       | `false`       | Enable debug logging                         |

## Examples

### Basic Local Setup

```typescript
export default defineConfig({
  reporter: [
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "http://localhost:3000",
        repository: "my-org/my-app",
      },
    ],
  ],
});
```

### CI Setup with Environment Variables

```typescript
export default defineConfig({
  reporter: [
    [
      "@playwright-manager/reporter",
      {
        apiUrl: process.env.DASHBOARD_URL,
        repository: process.env.GITHUB_REPOSITORY || "my-org/my-app",
        disabled: process.env.DISABLE_REPORTER === "true",
      },
    ],
  ],
});
```

### Full Configuration

```typescript
export default defineConfig({
  reporter: [
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://dashboard.example.com",
        repository: "my-org/my-app",

        // Override CI detection (useful for unsupported CI systems)
        branch: process.env.CUSTOM_BRANCH,
        commitSha: process.env.CUSTOM_COMMIT,
        ciJobUrl: process.env.CUSTOM_BUILD_URL,

        // Performance tuning
        batchSize: 100, // Send results in larger batches
        flushInterval: 10000, // Flush every 10 seconds

        // Behavior
        failSilently: true, // Don't fail CI if dashboard is down
        debug: false, // Enable for troubleshooting
      },
    ],
  ],
});
```

### Sharded Tests

The reporter automatically detects and tracks sharded test runs. No additional configuration needed:

```typescript
export default defineConfig({
  reporter: [
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://dashboard.example.com",
        repository: "my-org/my-app",
      },
    ],
  ],
});
```

```bash
# Run sharded tests - each shard reports independently
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

The dashboard aggregates results from all shards into a single test run.

## CI Environment Detection

The reporter automatically detects CI environment variables for popular providers:

| Provider       | Branch               | Commit SHA            | Job URL                   |
| -------------- | -------------------- | --------------------- | ------------------------- |
| GitHub Actions | `GITHUB_REF_NAME`    | `GITHUB_SHA`          | Constructed from env vars |
| GitLab CI      | `CI_COMMIT_REF_NAME` | `CI_COMMIT_SHA`       | `CI_JOB_URL`              |
| CircleCI       | `CIRCLE_BRANCH`      | `CIRCLE_SHA1`         | `CIRCLE_BUILD_URL`        |
| Jenkins        | `GIT_BRANCH`         | `GIT_COMMIT`          | `BUILD_URL`               |
| Azure DevOps   | `BUILD_SOURCEBRANCH` | `BUILD_SOURCEVERSION` | Constructed from env vars |
| Codefresh      | `CF_BRANCH`          | `CF_REVISION`         | `CF_BUILD_URL`            |

For unsupported CI systems, use the `branch`, `commitSha`, and `ciJobUrl` options to manually provide these values.

## Flaky Test Detection

Tests are automatically marked as **flaky** when they fail on initial attempts but pass after retries. Configure retries in your Playwright config:

```typescript
export default defineConfig({
  retries: 2, // Retry failed tests up to 2 times
  reporter: [
    [
      "@playwright-manager/reporter",
      {
        /* ... */
      },
    ],
  ],
});
```

## Tag Support

The reporter captures tags from multiple sources:

```typescript
// Using @tag syntax in test titles
test("user login @smoke @critical", async ({ page }) => {
  // ...
});

// Using test.describe with tags
test.describe("checkout flow @e2e", () => {
  test("complete purchase", async ({ page }) => {
    // ...
  });
});
```

Tags are extracted and sent to the dashboard for filtering and categorization.

## Playwright Version Compatibility

| Package Version | Playwright Version |
| --------------- | ------------------ |
| 0.1.x           | >= 1.25.0          |

**Minimum supported version: 1.25.0** (required for `TestCase.id` API)

Features like `test.tags` (introduced in Playwright 1.42) are detected at runtime and work automatically when available.
