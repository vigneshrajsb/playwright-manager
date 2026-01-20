import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verdictFeedback } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { isValidUUID } from "@/lib/validation/uuid";

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
 *     summary: Record verdict feedback
 *     description: Records user feedback on the accuracy of a flakiness verdict
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
 *                 format: uuid
 *                 description: The ID of the test run
 *               testId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the test
 *               verdict:
 *                 type: string
 *                 description: The verdict that was given (e.g., "flaky", "genuine_failure")
 *               confidence:
 *                 type: integer
 *                 description: Confidence score of the verdict (0-100)
 *               llmUsed:
 *                 type: boolean
 *                 description: Whether LLM was used for analysis
 *               feedback:
 *                 type: string
 *                 enum: [up, down]
 *                 description: User feedback on verdict accuracy
 *     responses:
 *       200:
 *         description: Feedback recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid request - missing required fields or invalid feedback value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
export async function POST(request: NextRequest) {
  try {
    const body: FeedbackPayload = await request.json();

    // Validate required fields
    if (!body.testRunId || !body.testId || !body.verdict || body.confidence === undefined || !body.feedback) {
      return NextResponse.json(
        { error: "testRunId, testId, verdict, confidence, and feedback are required" },
        { status: 400 }
      );
    }

    // Validate UUID formats
    if (!isValidUUID(body.testRunId) || !isValidUUID(body.testId)) {
      return NextResponse.json(
        { error: "testRunId and testId must be valid UUIDs" },
        { status: 400 }
      );
    }

    // Validate feedback value
    if (body.feedback !== "up" && body.feedback !== "down") {
      return NextResponse.json(
        { error: "feedback must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    // Validate confidence range
    if (body.confidence < 0 || body.confidence > 100) {
      return NextResponse.json(
        { error: "confidence must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Validate verdict length (schema allows max 20 chars)
    if (body.verdict.length > 20) {
      return NextResponse.json(
        { error: "verdict must not exceed 20 characters" },
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
