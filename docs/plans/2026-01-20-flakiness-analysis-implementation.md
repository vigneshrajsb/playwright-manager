# Flakiness Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a hybrid heuristic+LLM flakiness analyzer that tells developers if failures are flaky or real bugs.

**Architecture:** New `lib/flakiness-analyzer/` module with scoring engine, LLM integration, and verdict API. Dashboard UI gets a verdict banner with expandable details. Reporter gets optional exit code override.

**Tech Stack:** Next.js API routes, Drizzle ORM, OpenAI API (gpt-4o-mini), shadcn/ui components

---

## Phase 1: Foundation

### Task 1.1: Add errorSignatures table

**Files:**
- Modify: `apps/dashboard/lib/db/schema.ts`

**Step 1: Add errorSignatures table schema**

Add after the `skipRules` table definition (around line 244):

```typescript
// ============================================================================
// Error Signatures Table - Track recurring error patterns
// ============================================================================
export const errorSignatures = pgTable(
  "error_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    signatureHash: varchar("signature_hash", { length: 64 }).notNull(),
    errorMessage: text("error_message").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    occurrenceCount: integer("occurrence_count").default(1).notNull(),
    passedAfterCount: integer("passed_after_count").default(0).notNull(),
  },
  (table) => [
    index("idx_error_sig_test_id").on(table.testId),
    uniqueIndex("idx_error_sig_unique").on(table.testId, table.signatureHash),
  ]
);

export const errorSignaturesRelations = relations(errorSignatures, ({ one }) => ({
  test: one(tests, {
    fields: [errorSignatures.testId],
    references: [tests.id],
  }),
}));
```

**Step 2: Add types export**

Add at the end of the types section:

```typescript
export type ErrorSignature = typeof errorSignatures.$inferSelect;
export type NewErrorSignature = typeof errorSignatures.$inferInsert;
```

**Step 3: Run migration**

```bash
cd apps/dashboard && pnpm db:push
```

Expected: Migration applies successfully, new table created.

**Step 4: Commit**

```bash
git add apps/dashboard/lib/db/schema.ts
git commit -m "feat: add errorSignatures table for flakiness tracking"
```

---

### Task 1.2: Add verdictFeedback table

**Files:**
- Modify: `apps/dashboard/lib/db/schema.ts`

**Step 1: Add verdictFeedback table schema**

Add after the `errorSignatures` table:

```typescript
// ============================================================================
// Verdict Feedback Table - Track user feedback on flakiness verdicts
// ============================================================================
export const verdictFeedback = pgTable(
  "verdict_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    testRunId: uuid("test_run_id")
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" }),
    testId: uuid("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    verdict: varchar("verdict", { length: 20 }).notNull(),
    confidence: integer("confidence").notNull(),
    llmUsed: boolean("llm_used").default(false).notNull(),
    feedback: varchar("feedback", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_verdict_feedback_test_run").on(table.testRunId),
    index("idx_verdict_feedback_test").on(table.testId),
  ]
);

export const verdictFeedbackRelations = relations(verdictFeedback, ({ one }) => ({
  testRun: one(testRuns, {
    fields: [verdictFeedback.testRunId],
    references: [testRuns.id],
  }),
  test: one(tests, {
    fields: [verdictFeedback.testId],
    references: [tests.id],
  }),
}));
```

**Step 2: Add types export**

```typescript
export type VerdictFeedback = typeof verdictFeedback.$inferSelect;
export type NewVerdictFeedback = typeof verdictFeedback.$inferInsert;
```

**Step 3: Run migration**

```bash
cd apps/dashboard && pnpm db:push
```

**Step 4: Commit**

```bash
git add apps/dashboard/lib/db/schema.ts
git commit -m "feat: add verdictFeedback table for tracking analysis quality"
```

---

### Task 1.3: Create flakiness-analyzer module structure

**Files:**
- Create: `apps/dashboard/lib/flakiness-analyzer/types.ts`
- Create: `apps/dashboard/lib/flakiness-analyzer/index.ts`

**Step 1: Create types.ts**

```typescript
export interface FlakinessSignals {
  flakinessRate: number;
  recentFlakinessRate: number;
  recentOutcomes: Array<"pass" | "fail" | "flaky" | "skip">;
  errorSeenBefore: boolean;
  errorPassedAfterCount: number;
  consecutiveFailures: number;
  consecutivePasses: number;
  healthScore: number;
  healthDivergence: number;
}

export interface TestVerdict {
  testId: string;
  testTitle: string;
  filePath: string;
  verdict: "flaky" | "likely_real_failure";
  confidence: number;
  reasoning: string;
  signals: FlakinessSignals;
  llmUsed: boolean;
  errorMessage?: string;
  errorStack?: string;
}

export interface PipelineVerdict {
  verdict: "flaky" | "likely_real_failure";
  confidence: number;
  canAutoPass: boolean;
  failedTests: TestVerdict[];
  summary: string;
}

export interface HeuristicResult {
  score: number;
  reasoning: string[];
  signals: FlakinessSignals;
}

export interface LLMAnalysisResult {
  verdict: "flaky" | "real_bug";
  confidenceAdjustment: number;
  reasoning: string;
}
```

**Step 2: Create index.ts**

```typescript
export * from "./types";
export { analyzeFlakiness } from "./analyzer";
export { calculateHeuristicScore } from "./heuristics";
```

**Step 3: Commit**

```bash
git add apps/dashboard/lib/flakiness-analyzer/
git commit -m "feat: add flakiness-analyzer module structure"
```

---

### Task 1.4: Implement error normalizer

**Files:**
- Create: `apps/dashboard/lib/flakiness-analyzer/error-normalizer.ts`

**Step 1: Create error-normalizer.ts**

```typescript
import { createHash } from "crypto";

/**
 * Normalize error message by removing dynamic parts:
 * - Line numbers (file.ts:123:45)
 * - Timestamps (2024-01-20T12:34:56.789Z)
 * - UUIDs (550e8400-e29b-41d4-a716-446655440000)
 * - Memory addresses (0x7fff5fbff8c0)
 * - Port numbers in URLs (localhost:3456)
 * - Temporary file paths (/tmp/xxx, /var/folders/xxx)
 */
export function normalizeErrorMessage(errorMessage: string): string {
  if (!errorMessage) return "";

  let normalized = errorMessage
    // Remove line:column numbers (file.ts:123:45 -> file.ts)
    .replace(/:\d+:\d+/g, "")
    // Remove standalone line numbers (:123)
    .replace(/:\d+(?=\s|$|\))/g, "")
    // Remove ISO timestamps
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "<TIMESTAMP>")
    // Remove Unix timestamps (13 digits)
    .replace(/\b\d{13}\b/g, "<TIMESTAMP>")
    // Remove UUIDs
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<UUID>"
    )
    // Remove memory addresses
    .replace(/0x[0-9a-f]+/gi, "<ADDR>")
    // Remove port numbers in localhost URLs
    .replace(/localhost:\d+/g, "localhost:<PORT>")
    // Remove temp paths
    .replace(/\/tmp\/[^\s]+/g, "/tmp/<TEMP>")
    .replace(/\/var\/folders\/[^\s]+/g, "/var/folders/<TEMP>")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

/**
 * Generate SHA256 hash of normalized error message
 */
export function hashErrorSignature(errorMessage: string): string {
  const normalized = normalizeErrorMessage(errorMessage);
  return createHash("sha256").update(normalized).digest("hex");
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/lib/flakiness-analyzer/error-normalizer.ts
git commit -m "feat: add error message normalizer for signature matching"
```

---

### Task 1.5: Implement heuristic scoring

**Files:**
- Create: `apps/dashboard/lib/flakiness-analyzer/heuristics.ts`

**Step 1: Create heuristics.ts**

```typescript
import type { FlakinessSignals, HeuristicResult } from "./types";

// Scoring weights
const WEIGHTS = {
  HIGH_FLAKINESS_RATE: 30, // recentFlakinessRate > 20%
  PATTERN_MATCH: 25, // passed in recent runs
  ERROR_SEEN_BEFORE: 25, // same error, test later passed
  LOW_CONSECUTIVE_FAILURES: 15, // < 3 consecutive failures with passing history
  LOW_HEALTH_SCORE: 10, // healthScore < 50
};

const THRESHOLDS = {
  HIGH_FLAKINESS_RATE: 20,
  CONSECUTIVE_FAILURES_LOW: 3,
  HEALTH_SCORE_LOW: 50,
  MIN_PASSES_FOR_HISTORY: 2,
};

export function calculateHeuristicScore(signals: FlakinessSignals): HeuristicResult {
  let score = 0;
  const reasoning: string[] = [];

  // Signal 1: High flakiness rate
  if (signals.recentFlakinessRate > THRESHOLDS.HIGH_FLAKINESS_RATE) {
    score += WEIGHTS.HIGH_FLAKINESS_RATE;
    reasoning.push(
      `High flakiness rate (${signals.recentFlakinessRate.toFixed(1)}%)`
    );
  }

  // Signal 2: Pattern match - recent passes exist
  const recentPasses = signals.recentOutcomes.filter((o) => o === "pass").length;
  const recentTotal = signals.recentOutcomes.filter((o) => o !== "skip").length;
  if (recentPasses >= THRESHOLDS.MIN_PASSES_FOR_HISTORY && recentTotal > 0) {
    const passRatio = recentPasses / recentTotal;
    if (passRatio >= 0.3) {
      score += WEIGHTS.PATTERN_MATCH;
      reasoning.push(
        `Passed ${recentPasses} of last ${recentTotal} runs (${(passRatio * 100).toFixed(0)}%)`
      );
    }
  }

  // Signal 3: Error seen before and test passed after
  if (signals.errorSeenBefore && signals.errorPassedAfterCount > 0) {
    score += WEIGHTS.ERROR_SEEN_BEFORE;
    reasoning.push(
      `Same error seen ${signals.errorPassedAfterCount}x before, test later passed`
    );
  }

  // Signal 4: Low consecutive failures with passing history
  if (
    signals.consecutiveFailures < THRESHOLDS.CONSECUTIVE_FAILURES_LOW &&
    signals.consecutivePasses > 0
  ) {
    score += WEIGHTS.LOW_CONSECUTIVE_FAILURES;
    reasoning.push(
      `Only ${signals.consecutiveFailures} consecutive failures, had ${signals.consecutivePasses} consecutive passes before`
    );
  }

  // Signal 5: Already known as problematic test
  if (signals.healthScore < THRESHOLDS.HEALTH_SCORE_LOW) {
    score += WEIGHTS.LOW_HEALTH_SCORE;
    reasoning.push(`Low health score (${signals.healthScore}/100)`);
  }

  // Cap at 100
  score = Math.min(100, score);

  return {
    score,
    reasoning,
    signals,
  };
}

/**
 * Determine if heuristic confidence is high enough to skip LLM
 */
export function isHighConfidence(score: number): boolean {
  return score >= 75;
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/lib/flakiness-analyzer/heuristics.ts
git commit -m "feat: implement heuristic scoring for flakiness detection"
```

---

### Task 1.6: Create LLM prompt template

**Files:**
- Create: `apps/dashboard/lib/flakiness-analyzer/prompts.ts`

**Step 1: Create prompts.ts**

```typescript
export const FLAKINESS_ANALYSIS_PROMPT = `You are analyzing a test failure to determine if it's flaky (intermittent) or a real bug.

TEST: {{testTitle}}
FILE: {{filePath}}

ERROR MESSAGE:
{{errorMessage}}

STACK TRACE (truncated):
{{stackTrace}}

RECENT TEST HISTORY (last 10 runs, newest first):
{{recentHistory}}

SIMILAR ERRORS SEEN ON OTHER TESTS:
{{similarErrors}}

CURRENT HEURISTIC CONFIDENCE: {{heuristicScore}}%
HEURISTIC REASONING: {{heuristicReasoning}}

Analyze this failure and determine:
1. Is this likely a FLAKY test (intermittent failure due to timing, race conditions, external dependencies) or a REAL BUG (consistent failure due to code defect)?
2. How should the heuristic confidence be adjusted based on the error pattern and history?

Respond with ONLY valid JSON (no markdown, no explanation outside JSON):
{"verdict": "flaky" or "real_bug", "confidence_adjustment": number from -20 to +20, "reasoning": "one sentence explanation"}`;

export interface PromptVariables {
  testTitle: string;
  filePath: string;
  errorMessage: string;
  stackTrace: string;
  recentHistory: string;
  similarErrors: string;
  heuristicScore: number;
  heuristicReasoning: string;
}

export function renderPrompt(variables: PromptVariables): string {
  let prompt = FLAKINESS_ANALYSIS_PROMPT;

  prompt = prompt.replace("{{testTitle}}", variables.testTitle);
  prompt = prompt.replace("{{filePath}}", variables.filePath);
  prompt = prompt.replace("{{errorMessage}}", variables.errorMessage || "No error message");
  prompt = prompt.replace("{{stackTrace}}", truncateStackTrace(variables.stackTrace));
  prompt = prompt.replace("{{recentHistory}}", variables.recentHistory || "No history available");
  prompt = prompt.replace("{{similarErrors}}", variables.similarErrors || "No similar errors found");
  prompt = prompt.replace("{{heuristicScore}}", String(variables.heuristicScore));
  prompt = prompt.replace("{{heuristicReasoning}}", variables.heuristicReasoning);

  return prompt;
}

function truncateStackTrace(stack: string | undefined, maxLines: number = 15): string {
  if (!stack) return "No stack trace";
  const lines = stack.split("\n");
  if (lines.length <= maxLines) return stack;
  return lines.slice(0, maxLines).join("\n") + `\n... (${lines.length - maxLines} more lines)`;
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/lib/flakiness-analyzer/prompts.ts
git commit -m "feat: add configurable LLM prompt for flakiness analysis"
```

---

### Task 1.7: Implement LLM analyzer

**Files:**
- Create: `apps/dashboard/lib/flakiness-analyzer/llm-analyzer.ts`

**Step 1: Create llm-analyzer.ts**

```typescript
import { renderPrompt, type PromptVariables } from "./prompts";
import type { LLMAnalysisResult } from "./types";
import { logger } from "@/lib/logger";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

export function isLLMConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function analyzewithLLM(
  variables: PromptVariables
): Promise<LLMAnalysisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.debug("OpenAI API key not configured, skipping LLM analysis");
    return null;
  }

  const prompt = renderPrompt(variables);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a test flakiness analyzer. Respond only with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        "OpenAI API error"
      );
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.error("Empty response from OpenAI");
      return null;
    }

    // Parse JSON response
    const parsed = JSON.parse(content);

    return {
      verdict: parsed.verdict === "flaky" ? "flaky" : "real_bug",
      confidenceAdjustment: Math.max(
        -20,
        Math.min(20, parsed.confidence_adjustment || 0)
      ),
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to analyze with LLM");
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/lib/flakiness-analyzer/llm-analyzer.ts
git commit -m "feat: implement OpenAI LLM integration for flakiness analysis"
```

---

### Task 1.8: Implement main analyzer

**Files:**
- Create: `apps/dashboard/lib/flakiness-analyzer/analyzer.ts`

**Step 1: Create analyzer.ts**

```typescript
import { db } from "@/lib/db";
import { testResults, testHealth, tests, errorSignatures } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateHeuristicScore, isHighConfidence } from "./heuristics";
import { analyzewithLLM, isLLMConfigured } from "./llm-analyzer";
import { hashErrorSignature } from "./error-normalizer";
import type {
  PipelineVerdict,
  TestVerdict,
  FlakinessSignals,
} from "./types";
import { logger } from "@/lib/logger";

const AUTO_PASS_THRESHOLD = 90;

export async function analyzeFlakiness(
  pipelineId: string
): Promise<PipelineVerdict> {
  // Get failed test results for this pipeline
  const failedResults = await db
    .select({
      resultId: testResults.id,
      testId: testResults.testId,
      errorMessage: testResults.errorMessage,
      errorStack: testResults.errorStack,
      outcome: testResults.outcome,
    })
    .from(testResults)
    .where(
      and(
        eq(testResults.testRunId, pipelineId),
        eq(testResults.outcome, "unexpected"),
        eq(testResults.isFinalAttempt, true)
      )
    );

  if (failedResults.length === 0) {
    return {
      verdict: "flaky",
      confidence: 100,
      canAutoPass: true,
      failedTests: [],
      summary: "No failures to analyze",
    };
  }

  const testVerdicts: TestVerdict[] = [];

  for (const result of failedResults) {
    const verdict = await analyzeTestFailure(
      result.testId,
      result.errorMessage,
      result.errorStack
    );
    testVerdicts.push(verdict);
  }

  // Calculate overall verdict
  const flakyCount = testVerdicts.filter((v) => v.verdict === "flaky").length;
  const realFailureCount = testVerdicts.filter(
    (v) => v.verdict === "likely_real_failure"
  ).length;

  const avgConfidence =
    testVerdicts.reduce((sum, v) => sum + v.confidence, 0) / testVerdicts.length;

  const overallVerdict: "flaky" | "likely_real_failure" =
    realFailureCount === 0 ? "flaky" : "likely_real_failure";

  const canAutoPass =
    overallVerdict === "flaky" && avgConfidence >= AUTO_PASS_THRESHOLD;

  let summary: string;
  if (realFailureCount === 0) {
    summary = `All ${flakyCount} failure${flakyCount > 1 ? "s are" : " is"} known flaky (${avgConfidence.toFixed(0)}% avg confidence)`;
  } else if (flakyCount === 0) {
    summary = `${realFailureCount} failure${realFailureCount > 1 ? "s need" : " needs"} investigation`;
  } else {
    summary = `${flakyCount} of ${testVerdicts.length} failures are flaky. ${realFailureCount} need${realFailureCount > 1 ? "" : "s"} investigation.`;
  }

  return {
    verdict: overallVerdict,
    confidence: Math.round(avgConfidence),
    canAutoPass,
    failedTests: testVerdicts,
    summary,
  };
}

async function analyzeTestFailure(
  testId: string,
  errorMessage: string | null,
  errorStack: string | null
): Promise<TestVerdict> {
  // Get test info
  const test = await db.query.tests.findFirst({
    where: eq(tests.id, testId),
  });

  if (!test) {
    return createUnknownVerdict(testId);
  }

  // Get test health
  const health = await db.query.testHealth.findFirst({
    where: eq(testHealth.testId, testId),
  });

  // Get recent outcomes (last 10 final results)
  const recentResults = await db
    .select({
      outcome: testResults.outcome,
      startedAt: testResults.startedAt,
    })
    .from(testResults)
    .where(
      and(eq(testResults.testId, testId), eq(testResults.isFinalAttempt, true))
    )
    .orderBy(desc(testResults.startedAt))
    .limit(10);

  const recentOutcomes = recentResults.map((r) => {
    switch (r.outcome) {
      case "expected":
        return "pass" as const;
      case "unexpected":
        return "fail" as const;
      case "flaky":
        return "flaky" as const;
      default:
        return "skip" as const;
    }
  });

  // Check error signature
  let errorSeenBefore = false;
  let errorPassedAfterCount = 0;

  if (errorMessage) {
    const signatureHash = hashErrorSignature(errorMessage);
    const existingSignature = await db.query.errorSignatures.findFirst({
      where: and(
        eq(errorSignatures.testId, testId),
        eq(errorSignatures.signatureHash, signatureHash)
      ),
    });

    if (existingSignature) {
      errorSeenBefore = true;
      errorPassedAfterCount = existingSignature.passedAfterCount;
    }
  }

  // Build signals
  const signals: FlakinessSignals = {
    flakinessRate: parseFloat(health?.flakinessRate?.toString() || "0"),
    recentFlakinessRate: parseFloat(
      health?.recentFlakinessRate?.toString() || "0"
    ),
    recentOutcomes,
    errorSeenBefore,
    errorPassedAfterCount,
    consecutiveFailures: health?.consecutiveFailures || 0,
    consecutivePasses: health?.consecutivePasses || 0,
    healthScore: health?.healthScore || 50,
    healthDivergence: parseFloat(health?.healthDivergence?.toString() || "0"),
  };

  // Calculate heuristic score
  const heuristicResult = calculateHeuristicScore(signals);

  let finalScore = heuristicResult.score;
  let llmUsed = false;
  let reasoning = heuristicResult.reasoning.join("; ");

  // If not high confidence and LLM is configured, use LLM
  if (!isHighConfidence(heuristicResult.score) && isLLMConfigured()) {
    const llmResult = await analyzewithLLM({
      testTitle: test.testTitle,
      filePath: test.filePath,
      errorMessage: errorMessage || "",
      stackTrace: errorStack || "",
      recentHistory: formatRecentHistory(recentResults),
      similarErrors: await getSimilarErrors(testId, errorMessage),
      heuristicScore: heuristicResult.score,
      heuristicReasoning: reasoning,
    });

    if (llmResult) {
      llmUsed = true;
      finalScore = Math.max(
        0,
        Math.min(100, heuristicResult.score + llmResult.confidenceAdjustment)
      );
      reasoning = llmResult.reasoning;

      // Override verdict if LLM strongly disagrees
      if (
        llmResult.verdict === "real_bug" &&
        llmResult.confidenceAdjustment < -10
      ) {
        finalScore = Math.min(finalScore, 50);
      }
    }
  }

  const verdict: "flaky" | "likely_real_failure" =
    finalScore >= 60 ? "flaky" : "likely_real_failure";

  return {
    testId,
    testTitle: test.testTitle,
    filePath: test.filePath,
    verdict,
    confidence: finalScore,
    reasoning,
    signals,
    llmUsed,
    errorMessage: errorMessage || undefined,
    errorStack: errorStack || undefined,
  };
}

function createUnknownVerdict(testId: string): TestVerdict {
  return {
    testId,
    testTitle: "Unknown test",
    filePath: "unknown",
    verdict: "likely_real_failure",
    confidence: 0,
    reasoning: "Test not found in database",
    signals: {
      flakinessRate: 0,
      recentFlakinessRate: 0,
      recentOutcomes: [],
      errorSeenBefore: false,
      errorPassedAfterCount: 0,
      consecutiveFailures: 0,
      consecutivePasses: 0,
      healthScore: 0,
      healthDivergence: 0,
    },
    llmUsed: false,
  };
}

function formatRecentHistory(
  results: Array<{ outcome: string; startedAt: Date }>
): string {
  if (results.length === 0) return "No history";

  return results
    .map((r) => {
      const date = r.startedAt.toISOString().split("T")[0];
      const status =
        r.outcome === "expected"
          ? "PASS"
          : r.outcome === "unexpected"
            ? "FAIL"
            : r.outcome.toUpperCase();
      return `- ${date}: ${status}`;
    })
    .join("\n");
}

async function getSimilarErrors(
  testId: string,
  errorMessage: string | null
): Promise<string> {
  if (!errorMessage) return "No error to compare";

  const signatureHash = hashErrorSignature(errorMessage);

  // Find same error on other tests
  const similarSignatures = await db
    .select({
      testTitle: tests.testTitle,
      occurrenceCount: errorSignatures.occurrenceCount,
      passedAfterCount: errorSignatures.passedAfterCount,
    })
    .from(errorSignatures)
    .innerJoin(tests, eq(errorSignatures.testId, tests.id))
    .where(eq(errorSignatures.signatureHash, signatureHash))
    .limit(5);

  if (similarSignatures.length === 0) {
    return "No similar errors found on other tests";
  }

  return similarSignatures
    .map(
      (s) =>
        `- "${s.testTitle}": seen ${s.occurrenceCount}x, passed after ${s.passedAfterCount}x`
    )
    .join("\n");
}
```

**Step 2: Update index.ts exports**

```typescript
export * from "./types";
export { analyzeFlakiness } from "./analyzer";
export { calculateHeuristicScore } from "./heuristics";
export { hashErrorSignature, normalizeErrorMessage } from "./error-normalizer";
```

**Step 3: Commit**

```bash
git add apps/dashboard/lib/flakiness-analyzer/
git commit -m "feat: implement main flakiness analyzer with heuristics and LLM"
```

---

### Task 1.9: Update reports API to track error signatures

**Files:**
- Modify: `apps/dashboard/app/api/reports/route.ts`

**Step 1: Add import**

Add at top of file:

```typescript
import { errorSignatures } from "@/lib/db/schema";
import { hashErrorSignature } from "@/lib/flakiness-analyzer";
```

**Step 2: Add error signature tracking**

After the test result insert (around line 308), add:

```typescript
        // Track error signature for flakiness analysis
        if (testResult.error?.message && testResult.outcome === "unexpected") {
          const signatureHash = hashErrorSignature(testResult.error.message);

          const existingSig = await tx.query.errorSignatures.findFirst({
            where: and(
              eq(errorSignatures.testId, test.id),
              eq(errorSignatures.signatureHash, signatureHash)
            ),
          });

          if (existingSig) {
            await tx
              .update(errorSignatures)
              .set({
                lastSeenAt: new Date(),
                occurrenceCount: existingSig.occurrenceCount + 1,
              })
              .where(eq(errorSignatures.id, existingSig.id));
          } else {
            await tx.insert(errorSignatures).values({
              testId: test.id,
              signatureHash,
              errorMessage: testResult.error.message,
            });
          }
        }

        // Update passedAfterCount for previous error signatures when test passes
        if (testResult.outcome === "expected") {
          await tx
            .update(errorSignatures)
            .set({
              passedAfterCount: sql`${errorSignatures.passedAfterCount} + 1`,
            })
            .where(eq(errorSignatures.testId, test.id));
        }
```

**Step 3: Add sql import**

Update the drizzle-orm import:

```typescript
import { eq, and, sql } from "drizzle-orm";
```

**Step 4: Commit**

```bash
git add apps/dashboard/app/api/reports/route.ts
git commit -m "feat: track error signatures in reports API for flakiness analysis"
```

---

## Phase 2: Verdict API

### Task 2.1: Create verdict API endpoint

**Files:**
- Create: `apps/dashboard/app/api/pipelines/[id]/verdict/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { analyzeFlakiness } from "@/lib/flakiness-analyzer";
import { logger } from "@/lib/logger";

// Simple in-memory cache for verdicts (per pipeline)
const verdictCache = new Map<string, { verdict: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @swagger
 * /api/pipelines/{id}/verdict:
 *   get:
 *     tags:
 *       - Pipelines
 *     summary: Get flakiness analysis verdict
 *     description: Returns analysis of whether failures in this pipeline are flaky or real bugs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pipeline ID (UUID)
 *     responses:
 *       200:
 *         description: Verdict retrieved successfully
 *       500:
 *         description: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Check cache
    const cached = verdictCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.verdict);
    }

    // Analyze flakiness
    const verdict = await analyzeFlakiness(id);

    // Cache result
    verdictCache.set(id, { verdict, timestamp: Date.now() });

    return NextResponse.json(verdict);
  } catch (error) {
    logger.error({ err: error, pipelineId: id }, "Failed to analyze flakiness");
    return NextResponse.json(
      { error: "Failed to analyze flakiness" },
      { status: 500 }
    );
  }
}

// Clear cache when new results come in (called from reports API)
export function invalidateVerdictCache(pipelineId: string) {
  verdictCache.delete(pipelineId);
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/app/api/pipelines/[id]/verdict/
git commit -m "feat: add verdict API endpoint for flakiness analysis"
```

---

### Task 2.2: Create feedback API endpoint

**Files:**
- Create: `apps/dashboard/app/api/verdicts/feedback/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verdictFeedback } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

interface FeedbackPayload {
  testRunId: string;
  testId: string;
  verdict: string;
  confidence: number;
  llmUsed: boolean;
  feedback: "up" | "down";
}

/**
 * @swagger
 * /api/verdicts/feedback:
 *   post:
 *     tags:
 *       - Verdicts
 *     summary: Submit feedback on verdict accuracy
 *     description: Records whether a flakiness verdict was helpful
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testRunId
 *               - testId
 *               - verdict
 *               - confidence
 *               - feedback
 *             properties:
 *               testRunId:
 *                 type: string
 *               testId:
 *                 type: string
 *               verdict:
 *                 type: string
 *               confidence:
 *                 type: integer
 *               llmUsed:
 *                 type: boolean
 *               feedback:
 *                 type: string
 *                 enum: [up, down]
 *     responses:
 *       200:
 *         description: Feedback recorded successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export async function POST(request: NextRequest) {
  try {
    const body: FeedbackPayload = await request.json();

    if (!body.testRunId || !body.testId || !body.feedback) {
      return NextResponse.json(
        { error: "testRunId, testId, and feedback are required" },
        { status: 400 }
      );
    }

    if (body.feedback !== "up" && body.feedback !== "down") {
      return NextResponse.json(
        { error: "feedback must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    await db.insert(verdictFeedback).values({
      testRunId: body.testRunId,
      testId: body.testId,
      verdict: body.verdict,
      confidence: body.confidence,
      llmUsed: body.llmUsed || false,
      feedback: body.feedback,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to record verdict feedback");
    return NextResponse.json(
      { error: "Failed to record feedback" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/app/api/verdicts/
git commit -m "feat: add verdict feedback API endpoint"
```

---

## Phase 3: Dashboard UI

### Task 3.1: Add verdict hook

**Files:**
- Create: `apps/dashboard/hooks/queries/use-verdict.ts`
- Modify: `apps/dashboard/hooks/queries/index.ts`

**Step 1: Create use-verdict.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PipelineVerdict, TestVerdict } from "@/lib/flakiness-analyzer/types";

async function fetchVerdict(pipelineId: string): Promise<PipelineVerdict> {
  const response = await fetch(`/api/pipelines/${pipelineId}/verdict`);
  if (!response.ok) {
    throw new Error("Failed to fetch verdict");
  }
  return response.json();
}

export function useVerdict(pipelineId: string | null) {
  return useQuery({
    queryKey: ["verdict", pipelineId],
    queryFn: () => fetchVerdict(pipelineId!),
    enabled: !!pipelineId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

interface FeedbackPayload {
  testRunId: string;
  testId: string;
  verdict: string;
  confidence: number;
  llmUsed: boolean;
  feedback: "up" | "down";
}

async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const response = await fetch("/api/verdicts/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to submit feedback");
  }
}

export function useVerdictFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      // Optionally invalidate queries or show toast
    },
  });
}
```

**Step 2: Update hooks/queries/index.ts**

Add export:

```typescript
export * from "./use-verdict";
```

**Step 3: Commit**

```bash
git add apps/dashboard/hooks/queries/
git commit -m "feat: add useVerdict and useVerdictFeedback hooks"
```

---

### Task 3.2: Create VerdictBanner component

**Files:**
- Create: `apps/dashboard/components/pipelines/verdict-banner.tsx`

**Step 1: Create verdict-banner.tsx**

```typescript
"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VerdictDetails } from "./verdict-details";
import type { PipelineVerdict } from "@/lib/flakiness-analyzer/types";

interface VerdictBannerProps {
  verdict: PipelineVerdict;
  pipelineId: string;
}

export function VerdictBanner({ verdict, pipelineId }: VerdictBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isFlaky = verdict.verdict === "flaky";
  const Icon = isFlaky ? CheckCircle2 : AlertTriangle;
  const bgClass = isFlaky
    ? "bg-green-500/10 border-green-500/20"
    : "bg-yellow-500/10 border-yellow-500/20";
  const iconClass = isFlaky ? "text-green-600" : "text-yellow-600";
  const title = isFlaky ? "Safe to proceed" : "Investigate failures";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`rounded-lg border p-4 ${bgClass}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`h-5 w-5 ${iconClass}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{title}</span>
                <Badge variant="outline" className="text-xs">
                  {verdict.confidence}% confidence
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {verdict.summary}
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="ml-1">Details</span>
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t">
            <VerdictDetails
              failedTests={verdict.failedTests}
              pipelineId={pipelineId}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/components/pipelines/verdict-banner.tsx
git commit -m "feat: add VerdictBanner component"
```

---

### Task 3.3: Create VerdictDetails component

**Files:**
- Create: `apps/dashboard/components/pipelines/verdict-details.tsx`

**Step 1: Create verdict-details.tsx**

```typescript
"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Bot, Calculator, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVerdictFeedback } from "@/hooks/queries";
import type { TestVerdict } from "@/lib/flakiness-analyzer/types";

interface VerdictDetailsProps {
  failedTests: TestVerdict[];
  pipelineId: string;
}

export function VerdictDetails({ failedTests, pipelineId }: VerdictDetailsProps) {
  if (failedTests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No failed tests to analyze.</p>
    );
  }

  return (
    <div className="space-y-3">
      {failedTests.map((test) => (
        <TestVerdictCard
          key={test.testId}
          test={test}
          pipelineId={pipelineId}
        />
      ))}
    </div>
  );
}

interface TestVerdictCardProps {
  test: TestVerdict;
  pipelineId: string;
}

function TestVerdictCard({ test, pipelineId }: TestVerdictCardProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const feedbackMutation = useVerdictFeedback();

  const isFlaky = test.verdict === "flaky";
  const verdictBadge = isFlaky ? (
    <Badge className="bg-green-500/10 text-green-600">Flaky</Badge>
  ) : (
    <Badge className="bg-red-500/10 text-red-600">Likely Real</Badge>
  );

  const handleFeedback = (feedback: "up" | "down") => {
    if (feedbackGiven) return;

    feedbackMutation.mutate({
      testRunId: pipelineId,
      testId: test.testId,
      verdict: test.verdict,
      confidence: test.confidence,
      llmUsed: test.llmUsed,
      feedback,
    });
    setFeedbackGiven(feedback);
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{test.testTitle}</span>
            {verdictBadge}
            <Badge variant="outline" className="text-xs">
              {test.confidence}%
            </Badge>
            {test.llmUsed && (
              <Tooltip>
                <TooltipTrigger>
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Analyzed with AI</TooltipContent>
              </Tooltip>
            )}
            {!test.llmUsed && (
              <Tooltip>
                <TooltipTrigger>
                  <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Heuristics only</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {test.filePath}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 w-7 p-0 ${feedbackGiven === "up" ? "bg-green-100 text-green-600" : ""}`}
                onClick={() => handleFeedback("up")}
                disabled={!!feedbackGiven}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Helpful</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 w-7 p-0 ${feedbackGiven === "down" ? "bg-red-100 text-red-600" : ""}`}
                onClick={() => handleFeedback("down")}
                disabled={!!feedbackGiven}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Not helpful</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-sm text-muted-foreground mt-2">{test.reasoning}</p>

      {/* Expandable details */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-2 h-6 px-2 text-xs">
            <ChevronDown
              className={`h-3 w-3 mr-1 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide" : "Show"} stats
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 pt-2 border-t">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Flakiness:</span>{" "}
                <span className="font-medium">
                  {test.signals.recentFlakinessRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Health:</span>{" "}
                <span className="font-medium">{test.signals.healthScore}/100</span>
              </div>
              <div>
                <span className="text-muted-foreground">Consec. fails:</span>{" "}
                <span className="font-medium">
                  {test.signals.consecutiveFailures}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                Recent outcomes:
              </span>
              <div className="flex gap-1 mt-1">
                {test.signals.recentOutcomes.map((outcome, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger>
                      <div
                        className={`h-3 w-3 rounded-full ${
                          outcome === "pass"
                            ? "bg-green-500"
                            : outcome === "fail"
                              ? "bg-red-500"
                              : outcome === "flaky"
                                ? "bg-yellow-500"
                                : "bg-gray-300"
                        }`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{outcome}</TooltipContent>
                  </Tooltip>
                ))}
                {test.signals.recentOutcomes.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    No history
                  </span>
                )}
              </div>
            </div>

            {/* Error preview */}
            {test.errorMessage && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">Error:</span>
                <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-20">
                  {test.errorMessage.slice(0, 200)}
                  {test.errorMessage.length > 200 && "..."}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/components/pipelines/verdict-details.tsx
git commit -m "feat: add VerdictDetails component with feedback buttons"
```

---

### Task 3.4: Integrate verdict into pipeline-sheet

**Files:**
- Modify: `apps/dashboard/components/pipelines/pipeline-sheet.tsx`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { useVerdict } from "@/hooks/queries";
import { VerdictBanner } from "./verdict-banner";
```

**Step 2: Add verdict query**

Inside the `PipelineSheet` component, after the existing state declarations, add:

```typescript
  const { data: verdict, isLoading: verdictLoading } = useVerdict(
    pipeline?.status === "failed" ? pipelineId : null
  );
```

**Step 3: Add VerdictBanner to JSX**

After the Quick Actions section (around line 222, after the closing `</div>` of flex flex-wrap gap-3), add:

```tsx
              {/* Verdict Banner - show for failed pipelines */}
              {pipeline.status === "failed" && (
                <>
                  <Separator />
                  {verdictLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Analyzing failures...
                      </span>
                    </div>
                  ) : verdict ? (
                    <VerdictBanner verdict={verdict} pipelineId={pipeline.id} />
                  ) : null}
                </>
              )}
```

**Step 4: Commit**

```bash
git add apps/dashboard/components/pipelines/pipeline-sheet.tsx
git commit -m "feat: integrate verdict banner into pipeline sheet"
```

---

## Phase 4: Reporter Integration

### Task 4.1: Add autoPassFlaky option to reporter types

**Files:**
- Modify: `packages/reporter/src/types.ts`

**Step 1: Update TestManagerReporterOptions**

Add new options:

```typescript
export interface TestManagerReporterOptions {
  // ... existing options

  /**
   * If true, exit with code 0 when all failures are detected as flaky
   * @default false
   */
  autoPassFlaky?: boolean;

  /**
   * Minimum confidence threshold to auto-pass flaky failures
   * @default 90
   */
  autoPassThreshold?: number;
}
```

**Step 2: Commit**

```bash
git add packages/reporter/src/types.ts
git commit -m "feat: add autoPassFlaky options to reporter types"
```

---

### Task 4.2: Implement exit code override in reporter

**Files:**
- Modify: `packages/reporter/src/reporter.ts`

**Step 1: Update ResolvedOptions type**

Add new fields:

```typescript
type ResolvedOptions = Required<Omit<TestManagerReporterOptions, 'branch' | 'commitSha' | 'ciJobUrl' | 's3'>> & {
  branch?: string;
  commitSha?: string;
  ciJobUrl?: string;
  s3?: S3ReportConfig;
  autoPassFlaky: boolean;
  autoPassThreshold: number;
};
```

**Step 2: Update constructor**

Add default values:

```typescript
    this.options = {
      // ... existing options
      autoPassFlaky: options.autoPassFlaky ?? false,
      autoPassThreshold: options.autoPassThreshold ?? 90,
    };
```

**Step 3: Add verdict check in onEnd**

After the existing `printSummary` call, add:

```typescript
      // Check for auto-pass if enabled and run failed
      if (this.options.autoPassFlaky && result.status === "failed") {
        await this.checkAutoPass(pipelineId);
      }
```

**Step 4: Add checkAutoPass method**

```typescript
  private async checkAutoPass(pipelineId: string): Promise<void> {
    try {
      this.log("Checking flakiness verdict for auto-pass...");

      const response = await fetch(
        `${this.options.apiUrl}/api/pipelines/${pipelineId}/verdict`
      );

      if (!response.ok) {
        this.log("Failed to fetch verdict, not auto-passing");
        return;
      }

      const verdict = await response.json();

      if (verdict.canAutoPass) {
        this.printVerdictSummary(verdict);
        console.log("");
        console.log("[Playwright Manager] Exiting with code 0 - all failures are known flaky");
        console.log("");
        process.exit(0);
      } else {
        this.log("Verdict does not allow auto-pass", {
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          threshold: this.options.autoPassThreshold,
        });

        // Still print the verdict for information
        if (verdict.failedTests?.length > 0) {
          this.printVerdictSummary(verdict);
        }
      }
    } catch (error) {
      this.log("Error checking auto-pass verdict", error);
    }
  }

  private printVerdictSummary(verdict: any): void {
    console.log("");
    console.log("[Playwright Manager] Flakiness Analysis");

    const flakyTests = verdict.failedTests?.filter((t: any) => t.verdict === "flaky") || [];
    const realTests = verdict.failedTests?.filter((t: any) => t.verdict === "likely_real_failure") || [];

    if (flakyTests.length > 0) {
      console.log(`  ✓ ${flakyTests.length} failure${flakyTests.length > 1 ? "s are" : " is"} known flaky:`);
      for (const test of flakyTests) {
        console.log(`    • "${test.testTitle}" - ${test.reasoning}`);
      }
    }

    if (realTests.length > 0) {
      console.log(`  ✗ ${realTests.length} failure${realTests.length > 1 ? "s need" : " needs"} investigation:`);
      for (const test of realTests) {
        console.log(`    • "${test.testTitle}" - ${test.reasoning}`);
      }
    }
  }
```

**Step 5: Rebuild reporter**

```bash
pnpm --filter @playwright-manager/reporter build
```

**Step 6: Commit**

```bash
git add packages/reporter/
git commit -m "feat: implement auto-pass for flaky failures in reporter"
```

---

## Phase 5: Polish

### Task 5.1: Add loading and error states

**Files:**
- Modify: `apps/dashboard/components/pipelines/verdict-banner.tsx`

**Step 1: Add error handling**

Update the component to handle error state passed from parent:

```typescript
interface VerdictBannerProps {
  verdict: PipelineVerdict | null;
  pipelineId: string;
  isLoading?: boolean;
  error?: Error | null;
}

export function VerdictBanner({ verdict, pipelineId, isLoading, error }: VerdictBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border p-4 bg-muted/50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Analyzing failures...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-4 bg-red-500/10 border-red-500/20">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-600">
            Failed to analyze failures. Please try again.
          </span>
        </div>
      </div>
    );
  }

  if (!verdict) return null;

  // ... rest of component
}
```

**Step 2: Add Loader2 import**

```typescript
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
```

**Step 3: Commit**

```bash
git add apps/dashboard/components/pipelines/verdict-banner.tsx
git commit -m "feat: add loading and error states to verdict banner"
```

---

### Task 5.2: Final integration test

**Step 1: Start development server**

```bash
tilt up
```

**Step 2: Verify database tables**

```bash
cd apps/dashboard && pnpm db:studio
```

Check that `error_signatures` and `verdict_feedback` tables exist.

**Step 3: Test the flow**

1. Run a Playwright test suite that has some failures
2. Open the dashboard at http://localhost:3031/dashboard/pipelines
3. Click on a failed pipeline
4. Verify the verdict banner appears with analysis
5. Click thumbs up/down and verify feedback is recorded
6. Check the console output includes flakiness analysis

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete flakiness analysis implementation"
```

---

## Summary

This plan implements:

1. **Database schema** for error signatures and verdict feedback
2. **Flakiness analyzer module** with heuristic scoring and LLM integration
3. **Verdict API** endpoint for fetching flakiness analysis
4. **Feedback API** for tracking verdict quality
5. **UI components** (VerdictBanner, VerdictDetails) with expandable details
6. **Reporter integration** for optional auto-pass on flaky failures

The system uses a hybrid approach: heuristics first (fast, no external deps), then LLM for ambiguous cases when `OPENAI_API_KEY` is configured.
