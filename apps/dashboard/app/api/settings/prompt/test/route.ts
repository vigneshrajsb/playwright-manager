import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testResults, tests, testRuns } from "@/lib/db/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { type PromptVariables } from "@/lib/flakiness-analyzer/prompts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

/**
 * POST /api/settings/prompt/test
 * Tests a prompt against the latest failed test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    // Find the latest failed test result with error info
    const [latestFailure] = await db
      .select({
        testTitle: tests.testTitle,
        filePath: tests.filePath,
        errorMessage: testResults.errorMessage,
        errorStack: testResults.errorStack,
        startedAt: testResults.startedAt,
      })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(
        and(
          eq(testResults.status, "failed"),
          isNotNull(testResults.errorMessage)
        )
      )
      .orderBy(desc(testResults.startedAt))
      .limit(1);

    if (!latestFailure) {
      return NextResponse.json(
        { error: "No failed tests found to use as sample data" },
        { status: 404 }
      );
    }

    // Build sample variables
    const variables: PromptVariables = {
      testTitle: latestFailure.testTitle,
      filePath: latestFailure.filePath,
      errorMessage: latestFailure.errorMessage || "No error message",
      stackTrace: truncateStackTrace(latestFailure.errorStack || undefined),
      recentHistory: "PASS → PASS → FAIL → PASS → FAIL (sample data)",
      similarErrors: "No similar errors found",
      heuristicScore: 65,
      heuristicReasoning: "Mixed pass/fail pattern suggests intermittent issue",
    };

    // Render the prompt with variables
    const renderedPrompt = renderPromptWithContent(content, variables);

    // Check if OpenAI is configured
    const apiKey = process.env.OPENAI_API_KEY;
    let llmResponse = null;

    if (apiKey) {
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
                content: renderedPrompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 150,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          llmResponse = data.choices?.[0]?.message?.content || null;
        }
      } catch (llmError) {
        logger.warn({ err: llmError }, "LLM test call failed");
      }
    }

    return NextResponse.json({
      success: true,
      sampleTest: {
        title: latestFailure.testTitle,
        filePath: latestFailure.filePath,
        failedAt: latestFailure.startedAt.toISOString(),
      },
      renderedPrompt,
      llmResponse,
      llmConfigured: !!apiKey,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to test prompt");
    return NextResponse.json(
      { error: "Failed to test prompt" },
      { status: 500 }
    );
  }
}

function renderPromptWithContent(
  template: string,
  variables: PromptVariables
): string {
  let prompt = template;

  prompt = prompt.replace(/\{\{testTitle\}\}/g, variables.testTitle);
  prompt = prompt.replace(/\{\{filePath\}\}/g, variables.filePath);
  prompt = prompt.replace(
    /\{\{errorMessage\}\}/g,
    variables.errorMessage || "No error message"
  );
  prompt = prompt.replace(/\{\{stackTrace\}\}/g, variables.stackTrace);
  prompt = prompt.replace(
    /\{\{recentHistory\}\}/g,
    variables.recentHistory || "No history available"
  );
  prompt = prompt.replace(
    /\{\{similarErrors\}\}/g,
    variables.similarErrors || "No similar errors found"
  );
  prompt = prompt.replace(
    /\{\{heuristicScore\}\}/g,
    String(variables.heuristicScore)
  );
  prompt = prompt.replace(
    /\{\{heuristicReasoning\}\}/g,
    variables.heuristicReasoning
  );

  return prompt;
}

function truncateStackTrace(
  stack: string | undefined,
  maxLines: number = 15
): string {
  if (!stack) return "No stack trace";
  const lines = stack.split("\n");
  if (lines.length <= maxLines) return stack;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n... (${lines.length - maxLines} more lines)`
  );
}
