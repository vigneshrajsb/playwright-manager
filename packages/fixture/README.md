# @playwright-manager/fixture

Playwright fixture that automatically skips tests disabled in the Test Manager Dashboard.

## Installation

```bash
pnpm add @playwright-manager/fixture
```

## Usage

### 1. Configure the fixture in `playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";
import type { TestManagerFixtureOptions } from "@playwright-manager/fixture";

export default defineConfig({
  use: {
    testManager: {
      apiUrl: "http://localhost:3000",
      cacheTtl: 60000, // 1 minute
      failOpen: true,
      debug: false,
    } as TestManagerFixtureOptions,
  },
});
```

### 2. Import the extended test in your test files:

```typescript
// tests/example.spec.ts
import { test, expect } from "@playwright-manager/fixture";

test("my test", async ({ page }) => {
  // This test will be auto-skipped if disabled in the dashboard
  await page.goto("https://example.com");
  await expect(page).toHaveTitle(/Example/);
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | **required** | URL of the Test Manager Dashboard |
| `cacheTtl` | `number` | `60000` | Cache TTL in milliseconds |
| `failOpen` | `boolean` | `true` | Continue test if API unreachable |
| `debug` | `boolean` | `false` | Enable debug logging |
| `timeout` | `number` | `5000` | API request timeout in ms |

## How It Works

1. Before each test runs, the fixture checks if the test is disabled
2. Makes a POST request to `/api/tests/check` with the test ID and project
3. If disabled, calls `testInfo.skip()` with the reason from the dashboard
4. Results are cached per worker for the configured TTL

## Fail-Open Behavior

By default (`failOpen: true`), if the dashboard is unreachable:
- The test will continue running normally
- An error is logged but not thrown
- This prevents dashboard outages from blocking your CI

Set `failOpen: false` to fail tests when the API is unreachable.

## Caching

The fixture uses a per-worker cache to minimize API calls:
- Each Playwright worker has its own cache
- Cache TTL is configurable (default: 1 minute)
- Concurrent requests for the same project are deduplicated

## Skipped Test Annotation

When a test is skipped by the dashboard, the skip reason includes:
```
[dashboard] <reason from dashboard>
```

This makes it easy to identify dashboard-skipped tests in reports.
