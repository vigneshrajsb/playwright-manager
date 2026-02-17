# Fix: Skipped Tests Incorrectly Scored as Critical

## Context

When tests are skipped (via quarantine rules or `test.skip()` in code), the health algorithm treats them as having a 0% pass rate, marking them as **"critical" with health score 0**. This is wrong — skipped tests have no execution data and shouldn't be penalized.

**Observed**: Test IDs 154, 156 — 4 skipped runs each → health_score=0, trend="critical", pass_rate=0.00.

**Root cause**: In `updateTestHealth()`, when `overallExecuted === 0`, the pass rate defaults to `0` instead of being treated as "no data":
```ts
// reports/route.ts:441
const overallPassRate = overallExecuted > 0 ? (overallStats.passed / overallExecuted) * 100 : 0;
//                                                                                           ^^^
```

This cascades: weighted pass rate → 0, health score → 0, trend → "critical".

**Three affected scenarios**:
1. All results are skipped → score=0, trend="critical" (should be "no data")
2. Recent window all skipped, overall has data → recent=0% drags weighted score down (e.g., 100% healthy → 40% critical)
3. Avg duration divides by total count (including skips with 0ms), diluting the average

## Approach

### Principle: Skips are transparent

A skip means "we did not run this test" — it carries no pass/fail signal regardless of cause (dashboard quarantine or code-level `test.skip()`). Health metrics should be computed only from executed results.

### Change 1: Null-aware pass rate calculation

**File**: `apps/dashboard/app/api/reports/route.ts` (lines 440-449)

Replace the `: 0` defaults with `null`:

```ts
// BEFORE
const overallPassRate = overallExecuted > 0 ? (overallStats.passed / overallExecuted) * 100 : 0;
const overallFlakinessRate = overallExecuted > 0 ? (overallStats.flaky / overallExecuted) * 100 : 0;
// ... same for recent ...

// AFTER
const overallPassRate = overallExecuted > 0 ? (overallStats.passed / overallExecuted) * 100 : null;
const overallFlakinessRate = overallExecuted > 0 ? (overallStats.flaky / overallExecuted) * 100 : null;
const recentPassRate = recentExecuted > 0 ? (recentStats.passed / recentExecuted) * 100 : null;
const recentFlakinessRate = recentExecuted > 0 ? (recentStats.flaky / recentExecuted) * 100 : null;
```

### Change 2: Weighted average with fallback

**File**: `apps/dashboard/app/api/reports/route.ts` (line 452)

When one window has no execution data, fall back to the other instead of poisoning the weighted average:

```ts
// BEFORE
const weightedPassRate = (recentPassRate * HEALTH_RECENT_WEIGHT) + (overallPassRate * HEALTH_OVERALL_WEIGHT);

// AFTER
let weightedPassRate: number | null;
if (recentPassRate !== null && overallPassRate !== null) {
  // Both windows have data — weighted average (normal case)
  weightedPassRate = (recentPassRate * HEALTH_RECENT_WEIGHT) + (overallPassRate * HEALTH_OVERALL_WEIGHT);
} else if (overallPassRate !== null) {
  // Recent is all skips — fall back to overall
  weightedPassRate = overallPassRate;
} else if (recentPassRate !== null) {
  // Only recent has data (unusual but possible)
  weightedPassRate = recentPassRate;
} else {
  // No execution data at all
  weightedPassRate = null;
}
```

Same fallback pattern for flakiness rate.

### Change 3: Early return when no execution data

**File**: `apps/dashboard/app/api/reports/route.ts` (after weighted average calculation)

When `weightedPassRate === null` (all results are skips), update only metadata and return:

```ts
if (weightedPassRate === null) {
  // No execution data — update metadata only, don't touch health metrics
  const totalStats = calculateStats(allResults);
  const existingHealth = await tx.query.testHealth.findFirst({
    where: eq(testHealth.testId, testId),
  });

  const metadataUpdate = {
    totalRuns: totalStats.total,
    skippedCount: totalStats.skipped,
    lastStatus: allResults[0].status,
    lastRunAt: allResults[0].startedAt,
    updatedAt: new Date(),
  };

  if (existingHealth) {
    // Preserve existing health score/rates, null out the score to signal "no recent data"
    await tx.update(testHealth).set({
      ...metadataUpdate,
      healthScore: null,
    }).where(eq(testHealth.testId, testId));
  } else {
    // New test with only skips — create record with null health
    await tx.insert(testHealth).values({
      testId,
      ...metadataUpdate,
      healthScore: null,
      passRate: "0.00",
      flakinessRate: "0.00",
      recentPassRate: "0.00",
      recentFlakinessRate: "0.00",
      healthDivergence: "0.00",
      avgDurationMs: 0,
      trend: "stable",
      consecutivePasses: 0,
      consecutiveFailures: 0,
    });
  }
  return;
}
```

### Change 4: Fix average duration denominator

**File**: `apps/dashboard/app/api/reports/route.ts` (line 497)

```ts
// BEFORE — divides by total including skips (duration=0), diluting average
avgDurationMs: Math.round(overallStats.totalDuration / overallStats.total),

// AFTER — divide by executed count only
avgDurationMs: overallExecuted > 0
  ? Math.round(overallStats.totalDuration / overallExecuted)
  : 0,
```

### Change 5: Make healthScore nullable in schema

**File**: `apps/dashboard/lib/db/schema.ts` (line ~170)

```ts
// BEFORE
healthScore: integer("health_score").default(100).notNull(),

// AFTER
healthScore: integer("health_score").default(100),
```

Then run `pnpm db:generate` to create migration.

**Why nullable works**: All consumers already handle null scores:
- `getHealthLevel(null)` → `"unknown"` (`lib/utils/badges.ts:14`)
- `getHealthLabel(null)` → `"No data"` (`lib/utils/badges.ts:46`)
- `getHealthVariant(null)` → `""` (outline badge) (`lib/utils/badges.ts:30`)
- `HealthBadge` renders outline "No data" badge for null (`components/badges/health-badge.tsx:78-83`)
- SQL `avg(health_score)` ignores nulls
- SQL `health_score >= 80` / `< 50` excludes nulls (won't miscategorize)

### Change 6: Dashboard API — exclude null scores from health distribution

**File**: `apps/dashboard/app/api/dashboard/route.ts` (lines 189-203)

Exclude null health scores from the distribution query rather than adding a new bucket. This avoids frontend changes to the pie chart and keeps the chart showing "health of tests we have data for":

```ts
// Add a WHERE clause to exclude null healthScores from the distribution
.from(testHealth)
.innerJoin(tests, eq(testHealth.testId, tests.id))
.where(and(testWhereClause, sql`${testHealth.healthScore} IS NOT NULL`))
```

The CASE statement stays the same (healthy/warning/critical). Tests with null healthScore simply aren't counted in the distribution, which is correct — they have no health data to categorize.

### Change 7: Fix `skippedByDashboard` pipeline (bonus)

The `skippedByDashboard` field exists in the schema but is never populated in production — the reporter doesn't send it.

**File**: `packages/reporter/src/types.ts` — add `skippedByDashboard?: boolean` to `TestResultData`

**File**: `packages/reporter/src/reporter.ts` — in `onTestEnd`, detect dashboard skips from annotations:
```ts
const isDashboardSkip = test.annotations.some(
  (a) => a.type === "skip" && a.description?.startsWith("[dashboard]")
);
if (isDashboardSkip) resultData.skippedByDashboard = true;
```

**File**: `apps/dashboard/app/api/reports/route.ts` (line 304) — add server-side fallback detection:
```ts
const isDashboardSkip = testResult.skippedByDashboard ||
  testResult.annotations?.some(
    (a) => a.type === "skip" && a.description?.startsWith("[dashboard]")
  ) || false;
```

This doesn't affect the health algorithm (all skips are treated equally) but enables future UI features like showing "Skipped by dashboard" vs "Skipped in code".

### Change 8: Fix orphaned non-final attempts (server-side)

When Playwright skips retries (e.g., `toHaveScreenshot` with a missing snapshot fails once and Playwright doesn't retry despite `retries: 2`), the reporter marks attempt 0 as `is_final_attempt: false` expecting retries that never arrive. These tests become invisible to the dashboard — no health record, not counted in run totals.

**Root cause**: The reporter's `isFinalAttempt()` computes `retry >= maxRetries` (0 >= 2 = false), but can't know whether Playwright will actually retry.

**Fix**: Server-side correction on the final batch. When the API receives a batch with `status !== "running"`, all `onTestEnd` calls are complete. Find tests in the run that have no `is_final_attempt = true` result and promote the highest retry_count result.

**File**: `apps/dashboard/app/api/reports/route.ts` — after run stats update, when `isFinalBatch`:

```ts
const orphaned = await tx.execute(sql`
  SELECT DISTINCT ON (tr.test_id) tr.id, tr.test_id, tr.outcome
  FROM test_results tr
  WHERE tr.test_run_id = ${testRun.id}
    AND tr.test_id NOT IN (
      SELECT tr2.test_id FROM test_results tr2
      WHERE tr2.test_run_id = ${testRun.id} AND tr2.is_final_attempt = true
    )
  ORDER BY tr.test_id, tr.retry_count DESC
`);

for (const row of orphaned) {
  await tx.update(testResults).set({ isFinalAttempt: true }).where(eq(testResults.id, row.id));
  // Increment run counts and recompute health
  await updateTestHealth(tx, row.test_id);
}
```

### Change 9: Exclude skipped from totalTests

Playwright's "All" count excludes skipped tests (All = passed + failed + flaky). The dashboard's `totalTests` should match this convention — skipped tests didn't execute.

**File**: `apps/dashboard/app/api/reports/route.ts` — `finalAttemptCount` calculation:

```ts
// BEFORE — counts skipped as final attempts
const finalAttemptCount = body.results.filter(r => r.isFinalAttempt ?? true).length;

// AFTER — exclude skipped from total
const finalAttemptCount = body.results.filter(r => (r.isFinalAttempt ?? true) && r.outcome !== "skipped").length;
```

Same exclusion in the orphan fix: only count executed orphans toward `totalTests`.

## Edge Case Analysis

| Scenario | Before | After |
|----------|--------|-------|
| Test with 0 runs | No health record | No health record (unchanged) |
| All results skipped (IDs 154, 156) | score=0, trend="critical" | score=null → "No data" badge |
| 8 passes then 12 skips (recent window all skips) | weighted=40%, "critical" | Falls back to overall=100%, "healthy" |
| 8 passes then 4 skips (mixed recent window) | Pass rate 100% (6 executed / 6 passed in recent) | Same — correctly computed already |
| Was failing (score=20), now quarantined, all results skipped | score=0, "critical" | score=null → "No data" (stale score cleared) |
| Quarantined, un-quarantined, starts passing | Dashboard skips drag down rates | Skips excluded, new passes compute clean rates |
| 1 execution + 9 skips in recent window | recent=100% (1/1), weighted correctly | Same — 1 executed result is sufficient |
| All results are "flaky" outcome | score=0 (0 passed, 100% flaky penalty) | Same — not part of this fix (future consideration) |
| Playwright skips retries (e.g., snapshot-writing failure) | Test invisible — no final attempt, not in totals, no health | Orphan fix promotes to final, counted in totals, health computed |
| totalTests vs Playwright "All" count | Includes skipped → inflated total | Excludes skipped → matches Playwright's count |

## Consecutive Streaks

Current behavior: skipped results don't break or increment streaks (lines 464-474). They're simply skipped in the loop.

**No change needed** — this is correct. A streak of passes isn't broken by an intervening skip; the skip just didn't run.

## Files to Modify

| File | Change |
|------|--------|
| `apps/dashboard/app/api/reports/route.ts` | Core algorithm: null-aware rates, weighted fallback, early return for all-skips, avgDuration fix, server-side dashboard skip detection, orphan fix, totalTests fix |
| `apps/dashboard/lib/db/schema.ts` | Make healthScore nullable |
| `apps/dashboard/app/api/dashboard/route.ts` | Exclude null healthScores from distribution query |
| `apps/dashboard/types/index.ts` | Update `TestHealth.healthScore` and `TestWithHealth.health.healthScore` to `number \| null` |
| `apps/dashboard/components/results/result-sheet.tsx` | Update healthScore type to `number \| null` |
| `packages/reporter/src/types.ts` | Add `skippedByDashboard` to TestResultData |
| `packages/reporter/src/reporter.ts` | Detect and send skippedByDashboard flag |

## Files Verified Safe (no changes needed)

- `lib/utils/badges.ts` — already handles null scores (`getHealthLevel(null)` → `"unknown"`)
- `components/badges/health-badge.tsx` — already handles null scores (renders "No data" outline badge)
- `lib/filters/build-conditions.ts` — SQL comparisons naturally exclude nulls
- `lib/flakiness-analyzer/heuristics.ts` — uses `|| 50` fallback for null health
- `lib/flakiness-analyzer/analyzer.ts` — uses `|| 50` fallback (note: also falls back for `0`, pre-existing issue)
- `app/api/tests/route.ts` — uses filter builders, no direct health logic
- `components/dashboard/health-pie-chart.tsx` — no changes needed since we exclude nulls from the distribution query

## Design Note: Quarantined Tests

When a previously-failing test (score=20) gets quarantined and all results in the window become skips, its healthScore is set to `null` ("No data"). This erases the historical signal that the test was failing. This is a deliberate tradeoff: "no recent data" is more accurate than a stale score that may no longer reflect reality. When the test is un-quarantined, fresh execution data will rebuild the health score.

## Verification

1. Run `pnpm db:generate` after schema change — verify migration is created
2. Run `pnpm test` — verify all existing package tests pass
3. Fresh DB seed, then check that all-skipped tests show "No data" instead of "Critical"
4. Verify dashboard health pie chart doesn't count null-score tests in the distribution
5. Verify a test with mixed passes + recent skips retains its healthy score
6. Verify flakiness analyzer still works correctly for tests with null healthScore
7. Run `pnpm build` — verify no TypeScript compile errors from nullable healthScore
