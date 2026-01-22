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
