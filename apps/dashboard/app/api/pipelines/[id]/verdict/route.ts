import { NextRequest, NextResponse } from "next/server";
import { analyzeFlakiness, type PipelineVerdict } from "@/lib/flakiness-analyzer";
import { logger } from "@/lib/logger";

// Simple in-memory cache for verdicts (per pipeline)
const verdictCache = new Map<string, { verdict: PipelineVerdict; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * @swagger
 * /api/pipelines/{id}/verdict:
 *   get:
 *     tags:
 *       - Pipelines
 *     summary: Analyze pipeline flakiness
 *     description: Analyzes test failures in a pipeline to determine if they are flaky or likely real failures. Results are cached for 24 hours. Use refresh=true to force re-analysis.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pipeline ID (UUID)
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Set to true to bypass cache and force re-analysis
 *     responses:
 *       200:
 *         description: Flakiness analysis verdict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verdict:
 *                   type: string
 *                   enum: [flaky, likely_real_failure]
 *                   description: Overall verdict for the pipeline
 *                 confidence:
 *                   type: number
 *                   description: Confidence score (0-1)
 *                 canAutoPass:
 *                   type: boolean
 *                   description: Whether the pipeline can be safely auto-passed
 *                 failedTests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       testId:
 *                         type: string
 *                       testTitle:
 *                         type: string
 *                       filePath:
 *                         type: string
 *                       verdict:
 *                         type: string
 *                         enum: [flaky, likely_real_failure]
 *                       confidence:
 *                         type: number
 *                       reasoning:
 *                         type: string
 *                       llmUsed:
 *                         type: boolean
 *                 summary:
 *                   type: string
 *                   description: Human-readable summary of the analysis
 *       500:
 *         description: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  try {
    // Check cache (skip if refresh requested)
    if (!forceRefresh) {
      const cached = verdictCache.get(id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cached.verdict);
      }
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

// Export cache invalidation function for use by reports API
export function invalidateVerdictCache(pipelineId: string) {
  verdictCache.delete(pipelineId);
}
