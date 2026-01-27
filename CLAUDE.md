# CLAUDE.md

## Project Overview

Self-hosted test management for Playwright - track health, manage flaky tests, and control test execution remotely via quarantine rules.

## Project Structure

- `apps/dashboard` - Next.js 16 full-stack app (UI + API routes)
- `packages/reporter` - Playwright reporter that sends results to dashboard
- `packages/fixture` - Playwright fixture that auto-skips disabled tests
- `packages/eslint-plugin` - ESLint plugin enforcing fixture imports over @playwright/test

## Development Commands

```bash
# Start local development (recommended)
tilt up
# Dashboard runs at http://localhost:3031

# Or run directly
pnpm dev                    # Start Next.js dev server

# Build packages (required after package changes)
pnpm --filter @playwright-manager/reporter build
pnpm --filter @playwright-manager/fixture build
pnpm --filter @playwright-manager/eslint-plugin build

# Lint
pnpm lint

# Database
pnpm db:push                # Push schema changes (dev only)
pnpm db:generate            # Generate migration files
pnpm db:migrate             # Run migrations
pnpm db:seed                # Populate seed data
pnpm db:studio              # Open Drizzle Studio GUI
```

## Architecture

### Four-Package Integration

1. **Fixture** (`packages/fixture`) - Runs before each test

   - Calls `POST /api/tests/check` with branch/baseURL context
   - Caches disabled tests per worker (60s TTL)
   - Silently fails if dashboard unavailable (won't block CI)

2. **Reporter** (`packages/reporter`) - Runs after test suite

   - Auto-detects CI environment (GitHub Actions, GitLab, CircleCI, Jenkins, Azure DevOps, Codefresh)
   - Batches results (50 per request) to `POST /api/results` and `POST /api/reports`
   - Extracts branch, commit SHA, job URL from CI environment

3. **ESLint Plugin** (`packages/eslint-plugin`) - Linting for test files

   - Enforces importing `test`/`expect` from `@playwright-manager/fixture`
   - Prevents accidental imports from `@playwright/test` (e.g., via IDE autocomplete)
   - Auto-fix support: rewrites imports or splits mixed imports

4. **Dashboard** (`apps/dashboard`) - Web UI + API
   - Test health metrics with scoring algorithm
   - Skip rule management (branch/env patterns)
   - Test result aggregation and visualization

### Database Schema

Core tables in `apps/dashboard/lib/db/schema.ts`:

- `tests` - Unique test definitions (playwright ID, file path, title)
- `testRuns` - CI/local test executions (branch, commit, duration, counts)
- `testResults` - Individual outcomes (status, errors, attachments)
- `testHealth` - Aggregated metrics (pass rate, flakiness, health score 0-100)
- `skipRules` - Conditional skip rules (branch/env patterns)

### Schema Changes

**IMPORTANT**: When modifying `apps/dashboard/lib/db/schema.ts`, always run:

```bash
pnpm db:generate
```

This generates migration files in `apps/dashboard/drizzle/`. Commit these with your schema changes. CI will fail if migrations are missing.

### Key API Endpoints

- `POST /api/tests/check` - Fixture checks which tests to skip
- `POST /api/results` - Reporter submits test results
- `POST /api/reports` - Reporter submits run metadata
- `GET/POST /api/tests/[id]/rules` - Skip rule management

## Styling Guidelines

- **Always use shadcn/ui components** - No custom styling or one-off CSS classes
- **Use `container` class** for page content layout consistency
- **Stick to Tailwind utility classes** that map to shadcn design tokens (e.g., `text-muted-foreground`, `bg-card`, `border`)
- **No inline custom colors or arbitrary values** - Use theme variables
- **Follow patterns in `apps/dashboard/app/(home)`** for layout reference

## Key Files

- `apps/dashboard/lib/db/schema.ts` - Database schema (source of truth)
- `apps/dashboard/app/api/tests/check/route.ts` - Fixture integration
- `apps/dashboard/app/api/results/route.ts` - Reporter integration
- `packages/fixture/src/fixture.ts` - Skip logic implementation
- `packages/reporter/src/reporter.ts` - Result batching + CI detection
- `packages/eslint-plugin/src/rules/require-fixture-imports.ts` - ESLint rule implementation

## Environment

Required in `.env`:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

Ports: Dev server runs on 3031, production on 3000.
