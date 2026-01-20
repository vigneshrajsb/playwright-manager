# @playwright-manager/reporter

Playwright reporter that sends test results to the Playwright Manager Dashboard for tracking, flaky test detection, and remote test management.

## Features

- Real-time test result reporting to your dashboard
- **HTML report hosting** - Upload Playwright reports to S3-compatible storage (AWS S3, MinIO, R2, etc.)
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

## HTML Report Hosting

The reporter can automatically upload Playwright HTML reports to S3-compatible storage, allowing you to view detailed test reports directly from the dashboard.

### Prerequisites

1. **Enable the Playwright HTML reporter** - The HTML report must be generated for upload to work
2. **AWS SDK** - The `@aws-sdk/client-s3` package is included as an optional dependency and will be installed automatically with the reporter. If you encounter import errors, install it explicitly:

```bash
npm install @aws-sdk/client-s3
```

### S3 Configuration Options

| Option            | Type     | Required | Default             | Description                                    |
| ----------------- | -------- | -------- | ------------------- | ---------------------------------------------- |
| `s3.bucket`       | `string` | Yes      | -                   | S3 bucket name                                 |
| `s3.region`       | `string` | Yes      | -                   | AWS region or S3-compatible region             |
| `s3.endpoint`     | `string` | No       | AWS S3              | Custom endpoint for S3-compatible storage      |
| `s3.accessKeyId`  | `string` | No       | from env/IAM        | Access key (or use `AWS_ACCESS_KEY_ID` env)    |
| `s3.secretAccessKey` | `string` | No    | from env/IAM        | Secret key (or use `AWS_SECRET_ACCESS_KEY` env)|
| `s3.pathPrefix`   | `string` | No       | `"reports"`         | Path prefix in bucket                          |
| `s3.reportDir`    | `string` | No       | `"playwright-report"` | Local report directory path                  |

### Storage Path Structure

Reports are uploaded with the following path structure:
```
{bucket}/{pathPrefix}/{repository}/{runId}/
  ├── index.html
  ├── data/
  │   ├── *.zip (trace files)
  │   ├── *.png (screenshots)
  │   └── *.webm (videos)
  └── trace/
      └── ... (trace viewer assets)
```

Example: `s3://playwright-reports/reports/my-org/my-app/github-12345-1/index.html`

---

### AWS S3

For AWS S3, you only need bucket and region. Credentials are loaded from the AWS credential chain (environment variables, IAM role, etc.).

```typescript
export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://dashboard.example.com",
        repository: "my-org/my-app",
        s3: {
          bucket: "my-playwright-reports",
          region: "us-east-1",
          // Credentials loaded from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
          // or IAM role when running in AWS
        },
      },
    ],
  ],
});
```

**With explicit credentials:**

```typescript
s3: {
  bucket: "my-playwright-reports",
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}
```

**IAM Policy (minimum permissions):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::my-playwright-reports/reports/*"
    }
  ]
}
```

---

### MinIO (Self-Hosted)

MinIO is an S3-compatible object storage you can run locally or on your own infrastructure.

```typescript
export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "http://localhost:3031",
        repository: "my-org/my-app",
        s3: {
          bucket: "playwright-reports",
          region: "us-east-1", // Required but not used by MinIO
          endpoint: "http://localhost:9000",
          accessKeyId: "minioadmin",
          secretAccessKey: "minioadmin",
        },
      },
    ],
  ],
});
```

**Docker Compose setup:**

```yaml
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"  # S3 API
      - "9001:9001"  # Console UI
    volumes:
      - minio_data:/data

  # Create bucket on startup
  minio-init:
    image: minio/mc:latest
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://minio:9000 minioadmin minioadmin;
      mc mb myminio/playwright-reports --ignore-existing;
      "

volumes:
  minio_data:
```

---

### Cloudflare R2

Cloudflare R2 is S3-compatible with no egress fees.

```typescript
export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://dashboard.example.com",
        repository: "my-org/my-app",
        s3: {
          bucket: "playwright-reports",
          region: "auto",
          endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      },
    ],
  ],
});
```

**Getting R2 credentials:**
1. Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create a token with "Object Read & Write" permissions
3. Copy the Access Key ID and Secret Access Key

---

### DigitalOcean Spaces

```typescript
export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://dashboard.example.com",
        repository: "my-org/my-app",
        s3: {
          bucket: "playwright-reports",
          region: "nyc3", // Your Space's region
          endpoint: "https://nyc3.digitaloceanspaces.com",
          accessKeyId: process.env.SPACES_ACCESS_KEY,
          secretAccessKey: process.env.SPACES_SECRET_KEY,
        },
      },
    ],
  ],
});
```

---

### Google Cloud Storage (S3-Compatible)

GCS provides an S3-compatible API through interoperability mode.

```typescript
export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://dashboard.example.com",
        repository: "my-org/my-app",
        s3: {
          bucket: "playwright-reports",
          region: "auto",
          endpoint: "https://storage.googleapis.com",
          accessKeyId: process.env.GCS_ACCESS_KEY,
          secretAccessKey: process.env.GCS_SECRET_KEY,
        },
      },
    ],
  ],
});
```

**Getting GCS HMAC credentials:**
1. Go to Google Cloud Console → Cloud Storage → Settings → Interoperability
2. Create a service account HMAC key
3. Use the Access Key and Secret as `accessKeyId` and `secretAccessKey`

---

### Backblaze B2

```typescript
export default defineConfig({
  reporter: [
    ["html"],
    [
      "@playwright-manager/reporter",
      {
        apiUrl: "https://dashboard.example.com",
        repository: "my-org/my-app",
        s3: {
          bucket: "playwright-reports",
          region: "us-west-004", // Your bucket's region
          endpoint: "https://s3.us-west-004.backblazeb2.com",
          accessKeyId: process.env.B2_KEY_ID,
          secretAccessKey: process.env.B2_APPLICATION_KEY,
        },
      },
    ],
  ],
});
```

---

### Dashboard Configuration

The dashboard also needs S3 configuration to generate presigned URLs for viewing reports:

```bash
# Dashboard environment variables
S3_BUCKET=playwright-reports
S3_REGION=us-east-1
S3_ENDPOINT=                    # Leave empty for AWS S3
S3_PUBLIC_ENDPOINT=             # For Docker: external URL (e.g., http://localhost:9000)
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

**Docker setup note:** When running in Docker, the dashboard may use an internal endpoint (e.g., `http://minio:9000`) but needs to generate URLs accessible from browsers. Use `S3_PUBLIC_ENDPOINT` for the external URL:

```yaml
environment:
  - S3_ENDPOINT=http://minio:9000           # Internal (container-to-container)
  - S3_PUBLIC_ENDPOINT=http://localhost:9000 # External (browser access)
```

---

### CI Configuration Examples

**GitHub Actions:**

```yaml
- name: Run Playwright tests
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  run: npx playwright test
```

**GitLab CI:**

```yaml
test:
  script:
    - npx playwright test
  variables:
    AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
```

---

### Troubleshooting

**Report not uploading:**
- Ensure `@aws-sdk/client-s3` is installed
- Check that the HTML reporter is enabled: `reporter: [['html'], ['@playwright-manager/reporter', {...}]]`
- Enable debug logging: `debug: true`
- Verify the `playwright-report/` directory exists after test run

**Access denied errors:**
- Verify bucket name and region are correct
- Check credentials have `s3:PutObject` permission
- For custom endpoints, ensure `endpoint` URL is correct

**Presigned URLs not working:**
- Dashboard needs matching S3 configuration
- For Docker setups, configure `S3_PUBLIC_ENDPOINT`
- Check bucket CORS settings allow browser access

**Debug logging:**

```typescript
s3: {
  bucket: "playwright-reports",
  region: "us-east-1",
  // ...
},
debug: true, // Logs upload progress
```

---

## Releasing

To release a new version:

1. Update version in `package.json`
2. Commit and push to main
3. Create a git tag: `git tag reporter-vX.Y.Z`
4. Push the tag: `git push origin reporter-vX.Y.Z`
5. Create a GitHub release with tag `reporter-vX.Y.Z` and title `Reporter vX.Y.Z`

The release triggers the npm publish workflow automatically.

## Playwright Version Compatibility

| Package Version | Playwright Version |
| --------------- | ------------------ |
| 0.2.x           | >= 1.25.0          |
| 0.1.x           | >= 1.25.0          |

**Minimum supported version: 1.25.0** (required for `TestCase.id` API)

Features like `test.tags` (introduced in Playwright 1.42) are detected at runtime and work automatically when available.
