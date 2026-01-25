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

  const prompt = await renderPrompt(variables);

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
