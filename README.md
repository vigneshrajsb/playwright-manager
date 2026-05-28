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

## Quick Start

### Deploy the Dashboard

**Docker Compose (fastest):**

```bash
curl -O https://raw.githubusercontent.com/vigneshrajsb/playwright-manager/main/docker-compose.yml
docker compose up -d
```

Dashboard runs at http://localhost:3000.

**Kubernetes with Helm:**

```bash
helm install playwright-manager oci://ghcr.io/vigneshrajsb/charts/playwright-manager \
  --set postgresql.auth.postgresPassword=<your-password>
```

### Set Up Your Playwright Project

Install the packages:

```bash
npm install -D @playwright-manager/fixture @playwright-manager/reporter
```

Run the interactive setup wizard:

```bash
npx playwright-manager init
```

This auto-detects your repository, checks the dashboard connection, and prints the config snippet for your `playwright.config.ts`.

### Org-Wide Setup (Multi-Repo)

For org-wide rollout, set two CI environment variables instead of configuring each repo:

```bash
PLAYWRIGHT_MANAGER_URL=https://your-dashboard-url
PLAYWRIGHT_MANAGER_REPOSITORY=your-org/your-repo
```

The reporter and fixture automatically pick these up as fallbacks when `apiUrl` and `repository` are not set in `playwright.config.ts`. Install the packages, set the env vars in CI, done.

### Manual Configuration

If you prefer to configure manually, update `playwright.config.ts`:

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

### Verify Connection

```bash
npx playwright-manager check-connection
```

Checks that the dashboard is reachable and DB/S3 are healthy. Exits non-zero on failure (useful in CI setup scripts).

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

## CLI

The reporter package includes a CLI tool:

```bash
npx playwright-manager init               # Interactive setup wizard
npx playwright-manager check-connection   # Verify dashboard connectivity
npx playwright-manager upload-report      # Upload HTML report to S3
```

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
