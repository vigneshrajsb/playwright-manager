import { db } from "@/lib/db";
import { promptSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

// In-memory cache for the active prompt
let cachedPrompt: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Fetches the active prompt from the database with caching.
 * Falls back to the default prompt if no custom prompt is configured.
 */
async function getActivePrompt(): Promise<string> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedPrompt !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPrompt;
  }

  try {
    const [activePrompt] = await db
      .select({ content: promptSettings.content })
      .from(promptSettings)
      .where(eq(promptSettings.isActive, true))
      .limit(1);

    if (activePrompt?.content) {
      cachedPrompt = activePrompt.content;
      cacheTimestamp = now;
      return cachedPrompt;
    }
  } catch {
    // Database error - fall back to default
  }

  // No custom prompt or error - use default
  cachedPrompt = FLAKINESS_ANALYSIS_PROMPT;
  cacheTimestamp = now;
  return cachedPrompt;
}

/**
 * Invalidates the cached prompt. Call this when a new prompt is saved.
 */
export function invalidatePromptCache(): void {
  cachedPrompt = null;
  cacheTimestamp = 0;
}

export async function renderPrompt(variables: PromptVariables): Promise<string> {
  const template = await getActivePrompt();

  let prompt = template;

  prompt = prompt.replace(/\{\{testTitle\}\}/g, variables.testTitle);
  prompt = prompt.replace(/\{\{filePath\}\}/g, variables.filePath);
  prompt = prompt.replace(/\{\{errorMessage\}\}/g, variables.errorMessage || "No error message");
  prompt = prompt.replace(/\{\{stackTrace\}\}/g, truncateStackTrace(variables.stackTrace));
  prompt = prompt.replace(/\{\{recentHistory\}\}/g, variables.recentHistory || "No history available");
  prompt = prompt.replace(/\{\{similarErrors\}\}/g, variables.similarErrors || "No similar errors found");
  prompt = prompt.replace(/\{\{heuristicScore\}\}/g, String(variables.heuristicScore));
  prompt = prompt.replace(/\{\{heuristicReasoning\}\}/g, variables.heuristicReasoning);

  return prompt;
}

function truncateStackTrace(stack: string | undefined, maxLines: number = 15): string {
  if (!stack) return "No stack trace";
  const lines = stack.split("\n");
  if (lines.length <= maxLines) return stack;
  return lines.slice(0, maxLines).join("\n") + `\n... (${lines.length - maxLines} more lines)`;
}
