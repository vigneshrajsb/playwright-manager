# Flakiness Analysis Agent Design

## Overview

Add an agentic interface to the Playwright Manager dashboard that analyzes test failures and determines whether they are flaky or legitimate bugs. Surface this information to developers when they land on a pipeline page from CI, helping them decide whether to proceed or investigate.

## Goals

1. **Verdict-first UX**: Show clear "Flaky" or "Likely real failure" verdict with confidence percentage
2. **Investigation details on demand**: Expandable section with stats, timeline, and reasoning
3. **Exit code override**: Reporter can exit 0 if all failures are known flaky (stretch goal)
4. **Quality tracking**: Thumbs up/down feedback to measure analysis accuracy

## Approach: Hybrid Analysis

Use heuristics first for high-confidence cases (fast, no external dependencies), escalate to LLM for ambiguous cases.

### Heuristic Scoring

Signals combined into confidence score (0-100):

| Signal | Condition | Points |
|--------|-----------|--------|
| Flakiness rate | `recentFlakinessRate` > 20% | +30 |
| Pattern match | Test passed in last 3 runs on same branch | +25 |
| Error signature | Same error seen before, test later passed | +25 |
| Consecutive failures | `consecutiveFailures` < 3 with passing history | +15 |
| Health score | `healthScore` < 50 | +10 |

- Score >= 75: Return verdict without LLM
- Score < 75 + LLM configured: Escalate to LLM analysis
- Score < 75 + no LLM: Return heuristic verdict with lower confidence

### LLM Analysis

**When triggered**: Heuristic confidence < 75% and `OPENAI_API_KEY` is set

**Context sent**:
- Error message and stack trace
- Last 10 run outcomes for this test
- Similar errors from other tests (with pass-after counts)
- Current heuristic score

**Model**: `gpt-4o-mini` (fast, cost-effective)

**Cost**: ~$0.001 per analysis

**Future**: Multi-provider support (Anthropic, local models)

---

## Schema Changes

### New Table: `error_signatures`

Tracks normalized error messages to identify recurring patterns.

```typescript
export const errorSignatures = pgTable("error_signatures", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: uuid("test_id").references(() => tests.id, { onDelete: "cascade" }),
  signatureHash: varchar("signature_hash", { length: 64 }).notNull(),
  errorMessage: text("error_message").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
  occurrenceCount: integer("occurrence_count").default(1),
  passedAfterCount: integer("passed_after_count").default(0),
}, (table) => [
  index("idx_error_sig_test_id").on(table.testId),
  uniqueIndex("idx_error_sig_unique").on(table.testId, table.signatureHash),
]);
```

**Error normalization**: Strip line numbers, timestamps, UUIDs from error messages before hashing.

### New Table: `verdict_feedback`

Tracks user feedback on verdict accuracy.

```typescript
export const verdictFeedback = pgTable("verdict_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  testRunId: uuid("test_run_id").references(() => testRuns.id, { onDelete: "cascade" }),
  testId: uuid("test_id").references(() => tests.id, { onDelete: "cascade" }),
  verdict: varchar("verdict", { length: 20 }).notNull(),
  confidence: integer("confidence").notNull(),
  llmUsed: boolean("llm_used").default(false),
  feedback: varchar("feedback", { length: 10 }).notNull(), // "up" | "down"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

---

## API Changes

### New Endpoint: `POST /api/pipelines/[id]/verdict`

Returns flakiness analysis for a pipeline's failed tests.

**Response**:
```typescript
{
  verdict: "flaky" | "likely_real_failure",
  confidence: number,
  canAutoPass: boolean, // true if confidence >= 90 AND verdict is "flaky"
  failedTests: [
    {
      testId: string,
      testTitle: string,
      verdict: "flaky" | "likely_real_failure",
      confidence: number,
      reasoning: string,
      signals: {
        flakinessRate: number,
        recentOutcomes: ("pass" | "fail" | "flaky")[],
        errorSeenBefore: boolean,
        consecutiveFailures: number,
        healthScore: number,
      },
      llmUsed: boolean,
    }
  ],
  summary: string,
}
```

**Caching**: Verdict computed once per pipeline, cached until new results arrive.

### New Endpoint: `POST /api/verdicts/feedback`

Records user feedback on verdict accuracy.

**Request**:
```typescript
{ testRunId: string, testId: string, feedback: "up" | "down" }
```

---

## UI Changes

### Pipeline Sheet: Verdict Banner

Appears below quick actions when pipeline has failures.

**Safe to proceed**:
```
┌─────────────────────────────────────────────────────────┐
│ ✓ Safe to proceed                           87% conf   │
│   2 of 3 failures are known flaky tests                │
│                                          [View Details]│
└─────────────────────────────────────────────────────────┘
```

**Investigate**:
```
┌─────────────────────────────────────────────────────────┐
│ ⚠ Investigate failures                      72% conf   │
│   1 failure appears to be a real bug                   │
│                                          [View Details]│
└─────────────────────────────────────────────────────────┘
```

### Expanded Details Panel

For each failed test:

- **Header**: Test name + verdict badge + confidence + thumbs up/down buttons
- **Stats row**: Flakiness rate, health score, consecutive failures
- **Timeline**: Visual dots showing last 10 outcomes (green = pass, red = fail, yellow = flaky)
- **Reasoning**: Explanation of why this verdict was reached
- **Error preview**: Truncated error message with expand option

**Components**: Uses shadcn `Collapsible`, `Badge`, `Card`, `Tooltip`, `Button`

---

## Reporter Changes

### New Config Options

```typescript
interface TestManagerReporterOptions {
  // ... existing options
  autoPassFlaky?: boolean;    // default: false
  autoPassThreshold?: number; // default: 90
}
```

### Exit Code Override Flow

In `onEnd()`:

1. Send final results to dashboard (existing)
2. If `autoPassFlaky: true` AND run has failures:
   - Call `POST /api/pipelines/[id]/verdict`
   - If `canAutoPass: true`:
     - Print verdict summary to console
     - Call `process.exit(0)`
   - If `canAutoPass: false`:
     - Print verdict summary (informational)
     - Let Playwright's exit code flow through

### Console Output

```
[Playwright Manager] Flakiness Analysis
  ✓ 2 failures are known flaky (91% confidence)
    • "Login test" - 42% flakiness rate, same error seen 5 times
    • "Cart test" - passed 3 of last 5 runs on this branch

  Exiting with code 0 - all failures are known flaky
```

---

## Module Structure

```
apps/dashboard/lib/flakiness-analyzer/
├── index.ts              # Main analyzer entry point
├── heuristics.ts         # Scoring logic
├── llm-analyzer.ts       # OpenAI integration
├── prompts.ts            # LLM prompt template
├── error-normalizer.ts   # Error message normalization
└── types.ts              # Shared types
```

### Prompt Configuration

Prompt template lives in `prompts.ts`. Edit file directly to test variations.

```typescript
export const FLAKINESS_ANALYSIS_PROMPT = `
You are analyzing a test failure to determine if it's flaky or a real bug.

TEST: {{testTitle}}
FILE: {{filePath}}

ERROR:
{{errorMessage}}

STACK TRACE:
{{stackTrace}}

RECENT HISTORY (last 10 runs):
{{recentHistory}}

SIMILAR ERRORS ON OTHER TESTS:
{{similarErrors}}

CURRENT HEURISTIC CONFIDENCE: {{heuristicScore}}%

Based on this data, is this failure likely FLAKY or a REAL BUG?
Respond with JSON: { "verdict": "flaky" | "real_bug", "confidence_adjustment": number (-20 to +20), "reasoning": "one sentence explanation" }
`;
```

---

## Implementation Phases

### Phase 1: Foundation
1. Add `errorSignatures` table + migration
2. Create `lib/flakiness-analyzer/` module with heuristic scoring
3. Update `/api/reports` to populate error signatures on result ingestion

### Phase 2: Verdict API
4. Create `POST /api/pipelines/[id]/verdict` endpoint
5. Add LLM integration in `llm-analyzer.ts` with prompt in `prompts.ts`
6. Add caching layer for verdicts

### Phase 3: Dashboard UI
7. Add `verdictFeedback` table + migration
8. Add `POST /api/verdicts/feedback` endpoint
9. Add verdict banner to `pipeline-sheet.tsx`
10. Build expandable details panel with stats + timeline + reasoning + feedback buttons

### Phase 4: Reporter Integration
11. Add `autoPassFlaky` config option to reporter
12. Implement exit code override logic in `onEnd()`
13. Add console output formatting for verdicts

### Phase 5: Polish
14. Add loading states and error handling in UI
15. Add telemetry/logging for analysis quality tracking

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | Enables LLM analysis for ambiguous cases |

### Reporter Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoPassFlaky` | boolean | false | Exit 0 if all failures are flaky |
| `autoPassThreshold` | number | 90 | Minimum confidence to auto-pass |

---

## Quality Metrics

Track via `verdictFeedback` table:

- **Accuracy rate**: % of verdicts with thumbs up
- **Confidence calibration**: Are high-confidence verdicts more accurate?
- **LLM value**: Do LLM-assisted verdicts get better feedback than heuristics-only?
- **Per-repo trends**: Which repositories have harder-to-analyze failures?

---

## Future Enhancements

- Multi-provider LLM support (Anthropic, local models)
- Dashboard settings page for prompt editing
- Slack/PR comment notifications for verdicts
- Auto-quarantine suggestions for repeatedly flaky tests
- A/B testing framework for prompt variations
