# @playwright-manager/fixture

Playwright fixture that automatically skips tests disabled in the Playwright Manager Dashboard. Enable remote test management without code changes.

## Features

- Automatic test skipping based on dashboard status
- Per-worker caching with request deduplication
- Fail-silently behavior to prevent dashboard outages from blocking CI
- **Environment variable fallbacks** — configure via `PLAYWRIGHT_MANAGER_URL` and `PLAYWRIGHT_MANAGER_REPOSITORY` for org-wide CI setup
- **Startup warnings** — logs when not configured and confirms when quarantine rules are active

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

| Option         | Type      | Required | Default | Description                                 |
| -------------- | --------- | -------- | ------- | ------------------------------------------- |
| `apiUrl`       | `string`  | No       | `PLAYWRIGHT_MANAGER_URL` env var | URL of your Playwright Manager Dashboard |
| `repository`   | `string`  | No       | `PLAYWRIGHT_MANAGER_REPOSITORY` env var | Repository identifier in `org/repo` format |
| `branch`       | `string`  | No       | auto-detect | Override branch name for skip rule matching |
| `disabled`     | `boolean` | No       | `false` | Disable the fixture                         |
| `cacheTtl`     | `number`  | No       | `60000` | Cache duration in milliseconds (1 minute)   |
| `failSilently` | `boolean` | No       | `true`  | Suppress errors if dashboard is unreachable |
| `timeout`      | `number`  | No       | `5000`  | API request timeout in milliseconds         |
| `debug`        | `boolean` | No       | `false` | Enable debug logging                        |

Both `apiUrl` and `repository` can be set via environment variables as fallback:
- `PLAYWRIGHT_MANAGER_URL` — fallback for `apiUrl`
- `PLAYWRIGHT_MANAGER_REPOSITORY` — fallback for `repository`

Precedence: explicit config > environment variable. If neither is set, the fixture logs a one-time warning and runs tests normally.

## Startup Behavior

The fixture logs status messages once per worker:

- **Not configured:** `[Playwright Manager] Fixture not configured — set testManager.apiUrl in playwright.config.ts or PLAYWRIGHT_MANAGER_URL env var to enable quarantine rules`
- **Connected:** `[Playwright Manager] Quarantine rules active` (logged on first successful API call)

These messages are always logged (not gated by `debug`) to help catch misconfiguration early.

## Examples

### Org-Wide CI Setup (Environment Variables)

Set these in your CI provider — no per-repo config changes needed:

```bash
PLAYWRIGHT_MANAGER_URL=https://your-dashboard.example.com
PLAYWRIGHT_MANAGER_REPOSITORY=your-org/your-repo
```

```typescript
export default defineConfig({
  use: {
    testManager: {} as TestManagerFixtureOptions,
  },
});
```

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

### Full Configuration

```typescript
export default defineConfig({
  use: {
    testManager: {
      apiUrl: "https://dashboard.example.com",
      repository: "my-org/my-app",

      // Override branch detection
      branch: "main",

      // Caching
      cacheTtl: 30000, // Check every 30 seconds instead of 60

      // Error handling
      failSilently: true, // Don't fail tests if dashboard is down
      timeout: 10000, // Wait up to 10 seconds for API response

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

## Releasing

To release a new version:

1. Update version in `package.json`
2. Commit and push to main
3. Create a git tag: `git tag fixture-vX.Y.Z`
4. Push the tag: `git push origin fixture-vX.Y.Z`
5. Create a GitHub release with tag `fixture-vX.Y.Z` and title `Fixture vX.Y.Z`

The release triggers the npm publish workflow automatically.

## Playwright Version Compatibility

| Package Version | Playwright Version |
| --------------- | ------------------ |
| 0.2.x           | >= 1.25.0          |
| 0.1.x           | >= 1.25.0          |

**Minimum supported version: 1.25.0**
