# Release Process

All releases are cut from `main`. There are three release categories: npm packages, the dashboard Docker image, and the Helm chart.

## Tag Formats

| Component | Tag Format | Example | Triggered By |
|---|---|---|---|
| Dashboard | `dashboard-vX.Y.Z` | `dashboard-v0.5.0` | GitHub Release (manual) → `release-docker.yaml` |
| Helm Chart | `playwright-manager-X.Y.Z` | `playwright-manager-0.5.0` | Auto-created by `release-chart.yaml` via `chart-releaser` |
| Reporter | `reporter-vX.Y.Z` | `reporter-v0.5.0` | GitHub Release (manual) → `release-npm.yaml` |
| Fixture | `fixture-vX.Y.Z` | `fixture-v0.1.0` | GitHub Release (manual) → `release-npm.yaml` |
| ESLint Plugin | `eslint-plugin-vX.Y.Z` | `eslint-plugin-v0.1.0` | GitHub Release (manual) → `release-npm.yaml` |

## Release Procedures

### Dashboard + Docker

1. Bump `apps/dashboard/package.json` version
2. Bump `charts/playwright-manager/Chart.yaml` `version` and `appVersion`
3. Merge to `main`
4. `release-chart.yaml` auto-triggers on chart file changes, lints and packages the chart, and pushes to GHCR OCI registry
5. Create a GitHub Release with tag `dashboard-vX.Y.Z` → triggers `release-docker.yaml` to build and push a multi-platform image to Docker Hub

### npm Packages (reporter / fixture / eslint-plugin)

1. Bump `packages/{name}/package.json` version
2. Merge to `main`
3. Create a GitHub Release with tag `{package}-vX.Y.Z` → triggers `release-npm.yaml`, which runs the package's tests and build before publishing to npm

### Helm Chart (standalone)

When making chart-only changes with no dashboard release:

1. Bump `charts/playwright-manager/Chart.yaml` `version`
2. Merge to `main`
3. `release-chart.yaml` auto-triggers on `charts/**` changes

## CI Workflows Reference

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/release-npm.yaml` | GitHub Release published with `reporter-v*`, `fixture-v*`, or `eslint-plugin-v*` tag | Runs package tests, builds the package, publishes to npm |
| `.github/workflows/release-docker.yaml` | GitHub Release published with `dashboard-v*` tag | Builds multi-platform (`linux/amd64`, `linux/arm64`) Docker image and pushes to Docker Hub |
| `.github/workflows/release-chart.yaml` | Push to `main` with changes under `charts/**`, or manual dispatch | Lints chart, runs `chart-releaser` (creates `playwright-manager-X.Y.Z` tag + GitHub Release), pushes OCI chart to GHCR |

## Version Locations

| Component | File |
|---|---|
| Dashboard | `apps/dashboard/package.json` → `version` |
| Helm chart version | `charts/playwright-manager/Chart.yaml` → `version` |
| Helm chart app version | `charts/playwright-manager/Chart.yaml` → `appVersion` |
| Reporter | `packages/reporter/package.json` → `version` |
| Fixture | `packages/fixture/package.json` → `version` |
| ESLint Plugin | `packages/eslint-plugin/package.json` → `version` |
