# Playwright Manager

Self-hosted test management for Playwright.

## What

**Quarantine flaky or broken tests without changing your code.** Playwright Manager lets you disable tests remotely via a dashboard—no PR required. When your CI runs, the fixture checks which tests are disabled and skips them automatically.

Beyond quarantine, you get:
- **Health metrics** — Track pass rates, flakiness, and health scores (0-100) per test
- **Reporting** — Aggregate test results across branches, commits, and CI runs
- **Skip rules** — Define patterns to skip tests on specific branches or environments

### How it Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Fixture      │     │    Reporter     │     │    Dashboard    │
│  (before test)  │────▶│  (after suite)  │────▶│    (web UI)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Fixture** runs before each test. It calls the dashboard API to check if the test is disabled, then skips it if needed. Results are cached per worker (60s TTL).

2. **Reporter** runs after the test suite. It batches results and sends them to the dashboard along with CI metadata (branch, commit, job URL).

3. **Dashboard** stores results, calculates health metrics, and provides a UI for managing skip rules.

## Usage

### Install

Deploy to Kubernetes with Helm:

```bash
helm install playwright-manager oci://ghcr.io/vigneshrajsb/charts/playwright-manager \
  --set postgresql.auth.postgresPassword=<your-password>
```

This deploys the dashboard with a PostgreSQL database. Access it via the service or configure an ingress.

### Use with Playwright

Install the packages:

```bash
npm install -D @playwright-manager/fixture @playwright-manager/reporter
```

Update `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    testManager: {
      apiUrl: 'https://your-dashboard-url',
      repository: 'your-org/your-repo',
    },
  },
  reporter: [
    ['@playwright-manager/reporter', {
      apiUrl: 'https://your-dashboard-url',
      repository: 'your-org/your-repo',
    }],
  ],
});
```

Update your test files to import from the fixture:

```typescript
import { test, expect } from '@playwright-manager/fixture';

test('my test', async ({ page }) => {
  // ...
});
```

### ESLint Plugin (Optional)

Prevent accidental imports from `@playwright/test` instead of `@playwright-manager/fixture`. IDE autocomplete often suggests the wrong import—this rule catches it.

```bash
npm install -D @playwright-manager/eslint-plugin
```

Add to your ESLint config:

```javascript
// eslint.config.mjs
import playwrightManager from '@playwright-manager/eslint-plugin';

export default [
  ...playwrightManager.configs.recommended,
];
```

The rule auto-fixes imports, so running `eslint --fix` will correct any mistakes.

## Development

Run locally with Tilt:

```bash
tilt up
```

Dashboard runs at http://localhost:3031.

Or run directly:

```bash
pnpm dev
```

### Contributing

Found a bug or have a feature request? Open an issue at https://github.com/vigneshrajsb/playwright-manager/issues.
