# Playwright Manager Dashboard

Next.js full-stack application providing the web UI and API for test management, health tracking, and skip rule configuration.

## Features

- Test health metrics with scoring algorithm (0-100 health score)
- Skip rule management with branch/environment patterns
- Test result aggregation and visualization
- CI pipeline tracking across GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure DevOps, and Codefresh
- Playwright HTML report hosting via S3-compatible storage

## Development

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database

### Environment Variables

Create a `.env` file:

```bash
DATABASE_URL=postgresql://user:password@host:port/database

# Optional: S3 configuration for report hosting
S3_BUCKET=playwright-reports
S3_REGION=us-east-1
S3_ENDPOINT=                    # Leave empty for AWS S3
S3_PUBLIC_ENDPOINT=             # For Docker: external URL
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

### Running Locally

```bash
# Using Tilt (recommended)
tilt up
# Dashboard runs at http://localhost:3031

# Or run directly
pnpm dev
```

### Database Commands

```bash
pnpm db:push      # Push schema changes (dev only)
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Run migrations
pnpm db:seed      # Populate seed data
pnpm db:studio    # Open Drizzle Studio GUI
```

## API Endpoints

### Fixture Integration

- `POST /api/tests/check` - Check which tests to skip based on skip rules

### Reporter Integration

- `POST /api/results` - Submit test results (batched)
- `POST /api/reports` - Submit run metadata

### Skip Rule Management

- `GET /api/tests/[id]/rules` - Get skip rules for a test
- `POST /api/tests/[id]/rules` - Create/update skip rules

## Deployment

### Docker

The dashboard is available as a Docker image:

```bash
docker pull vigneshrajsb/playwright-manager:latest
```

### Docker Compose

```yaml
services:
  dashboard:
    image: vigneshrajsb/playwright-manager:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/playwright_manager
```

## Releasing

To release a new version:

1. Update version in `package.json`
2. Commit and push to main
3. Create a git tag: `git tag X.Y.Z`
4. Push the tag: `git push origin X.Y.Z`
5. Create a GitHub release with tag `X.Y.Z` and title `vX.Y.Z`

The release triggers the Docker build workflow, which publishes the image to Docker Hub.
