import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, skipRules } from "@/lib/db/schema";
import { inArray, and, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { validatePatterns } from "@/lib/validation/patterns";

/**
 * @swagger
 * /api/tests/toggle:
 *   post:
 *     tags:
 *       - Tests
 *     summary: Bulk toggle tests enabled status
 *     description: Enables or disables multiple tests at once. Disabling creates skip rules, enabling removes all skip rules.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testIds
 *               - enabled
 *             properties:
 *               testIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of test IDs (UUIDs)
 *               enabled:
 *                 type: boolean
 *                 description: Whether the tests should be enabled
 *               reason:
 *                 type: string
 *                 description: Reason for disabling the tests (required when enabled=false)
 *               branchPattern:
 *                 type: string
 *                 description: Glob pattern to match branch names (e.g., "feature-*")
 *               envPattern:
 *                 type: string
 *                 description: Glob pattern to match baseURL hostname (e.g., "*.staging.example.com")
 *     responses:
 *       200:
 *         description: Tests toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                   description: Number of tests affected
 *       400:
 *         description: Bad request (missing reason when disabling, or empty testIds)
 *       500:
 *         description: Server error
 */

interface BulkToggleBody {
  testIds: string[];
  enabled: boolean;
  reason?: string;
  branchPattern?: string;
  envPattern?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkToggleBody = await request.json();
    const { testIds, enabled, reason, branchPattern, envPattern } = body;

    if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
      return NextResponse.json(
        { error: "testIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    const existingTests = await db
      .select({ id: tests.id })
      .from(tests)
      .where(inArray(tests.id, testIds));

    if (existingTests.length !== testIds.length) {
      return NextResponse.json(
        { error: "One or more test IDs not found" },
        { status: 404 }
      );
    }

    if (enabled) {
      await db
        .update(skipRules)
        .set({ deletedAt: new Date() })
        .where(
          and(inArray(skipRules.testId, testIds), isNull(skipRules.deletedAt))
        );

      return NextResponse.json({
        success: true,
        count: testIds.length,
        rulesRemoved: true,
      });
    } else {
      if (!reason) {
        return NextResponse.json(
          { error: "Reason is required when disabling tests" },
          { status: 400 }
        );
      }

      const patternValidation = validatePatterns(branchPattern, envPattern);
      if (!patternValidation.valid) {
        return NextResponse.json(
          { error: patternValidation.error },
          { status: 400 }
        );
      }

      const newRules = testIds.map((testId) => ({
        testId,
        reason,
        branchPattern: branchPattern || null,
        envPattern: envPattern || null,
      }));

      await db.insert(skipRules).values(newRules);

      return NextResponse.json({
        success: true,
        count: testIds.length,
        rulesCreated: testIds.length,
      });
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to bulk toggle tests");
    return NextResponse.json(
      { error: "Failed to toggle tests" },
      { status: 500 }
    );
  }
}
