# @playwright-manager/fixture

Playwright fixture that automatically skips tests disabled in the Playwright Manager Dashboard. Enable remote test management without code changes.

## Features

- Automatic test skipping based on dashboard status
- Per-worker caching with request deduplication
- Fail-silently behavior to prevent dashboard outages from blocking CI

## Installation

```bash
npm install @playwright-manager/fixture
# or
pnpm add @playwright-manager/fixture
# or
yarn add @playwright-manager/fixture
```

## Quick Start

### 1. Configure in `playwright.config.ts`

```typescript
import { defineConfig } from "@playwright/test";
import type { TestManagerFixtureOptions } from "@playwright-manager/fixture";

export default defineConfig({
  use: {
    testManager: {
      apiUrl: "https://your-dashboard.example.com",
      repository: "your-org/your-repo",
    } as TestManagerFixtureOptions,
  },
});
```

### 2. Import from the fixture package in your tests

```typescript
// IMPORTANT: Import from @playwright-manager/fixture, NOT @playwright/test
import { test, expect } from "@playwright-manager/fixture";

test("my test", async ({ page }) => {
  // This test will be auto-skipped if disabled in the dashboard
  await page.goto("https://example.com");
  await expect(page).toHaveTitle(/Example/);
});
```

## Configuration Options

| Option       | Type      | Required | Default | Description                                |
| ------------ | --------- | -------- | ------- | ------------------------------------------ |
| `apiUrl`     | `string`  | Yes      | -       | URL of your Playwright Manager Dashboard   |
| `repository` | `string`  | Yes      | -       | Repository identifier in `org/repo` format |
| `disabled`   | `boolean` | No       | `false` | Disable the fixture                        |
| `cacheTtl`   | `number`  | No       | `60000` | Cache duration in milliseconds (1 minute)  |
| `failSilently` | `boolean` | No     | `true`  | Suppress errors if dashboard is unreachable |
| `timeout`    | `number`  | No       | `5000`  | API request timeout in milliseconds        |
| `debug`      | `boolean` | No       | `false` | Enable debug logging                       |

## Examples

### Basic Setup

```typescript
import { defineConfig } from "@playwright/test";
import type { TestManagerFixtureOptions } from "@playwright-manager/fixture";

export default defineConfig({
  use: {
    testManager: {
      apiUrl: "http://localhost:3031",
      repository: "my-org/my-app",
    } as TestManagerFixtureOptions,
  },
});
```

### CI Setup with Environment Variables

```typescript
export default defineConfig({
  use: {
    testManager: {
      apiUrl: process.env.DASHBOARD_URL || "http://localhost:3031",
      repository: process.env.GITHUB_REPOSITORY || "my-org/my-app",
      disabled: process.env.SKIP_DASHBOARD_CHECK === "true",
    } as TestManagerFixtureOptions,
  },
});
```

### Full Configuration

```typescript
export default defineConfig({
  use: {
    testManager: {
      apiUrl: "https://dashboard.example.com",
      repository: "my-org/my-app",

      // Caching
      cacheTtl: 30000, // Check every 30 seconds instead of 60

      // Error handling
      failSilently: true, // Don't fail tests if dashboard is down
      timeout: 10000,     // Wait up to 10 seconds for API response

      // Debugging
      debug: true, // Log all fixture operations
    } as TestManagerFixtureOptions,
  },
});
```

## Fail-Silently Behavior

By default (`failSilently: true`), if the dashboard is unreachable:

- Tests continue running normally
- Errors are logged (when `debug: true`)
- Dashboard outages don't block your CI pipeline

Set `failSilently: false` if you want tests to fail when the API is unreachable.
