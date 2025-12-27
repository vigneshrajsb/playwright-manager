# @playwright-manager/reporter

Playwright reporter that sends test results to the Test Manager Dashboard.

## Installation

```bash
pnpm add @playwright-manager/reporter
```

## Usage

Add the reporter to your `playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "http://localhost:3000",
        batchSize: 50,
        flushInterval: 5000,
        failSilently: true,
        debug: false,
      },
    ],
  ],
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | **required** | URL of the Test Manager Dashboard |
| `batchSize` | `number` | `50` | Number of results to batch before sending |
| `flushInterval` | `number` | `5000` | Interval (ms) to flush results |
| `failSilently` | `boolean` | `true` | Don't throw if API is unreachable |
| `runId` | `string` | auto | Custom run ID (auto-generated if not provided) |
| `debug` | `boolean` | `false` | Enable debug logging |

## CI Environment Detection

The reporter automatically detects CI environment variables for:

- **GitHub Actions**: branch, commit SHA, job URL
- **GitLab CI**: branch, commit SHA, commit message, job URL
- **CircleCI**: branch, commit SHA, build URL
- **Jenkins**: branch, commit SHA, build URL
- **Azure DevOps**: branch, commit SHA, commit message, build URL

## How It Works

1. **onBegin**: Starts a new test run with metadata
2. **onTestEnd**: Collects test results and batches them
3. **Flush**: Sends batched results to `/api/reports` when:
   - Batch size is reached
   - Flush interval expires
4. **onEnd**: Sends final report with remaining results

## Fail-Silent Mode

By default, the reporter will not break your CI pipeline if the dashboard is unreachable. Set `failSilently: false` to throw errors on API failures.
