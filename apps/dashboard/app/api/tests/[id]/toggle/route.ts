import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, skipRules } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { validatePatterns } from "@/lib/validation/patterns";
import { isValidUUID } from "@/lib/validation/uuid";

/**
 * @swagger
 * /api/tests/{id}/toggle:
 *   patch:
 *     tags:
 *       - Tests
 *     summary: Toggle test enabled status
 *     description: Enables or disables a test. Disabling creates a skip rule, enabling removes all skip rules.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Test ID (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Whether the test should be enabled
 *               reason:
 *                 type: string
 *                 description: Reason for disabling the test (required when enabled=false)
 *               branchPattern:
 *                 type: string
 *                 description: Glob pattern to match branch names (e.g., "feature-*")
 *               envPattern:
 *                 type: string
 *                 description: Glob pattern to match baseURL hostname (e.g., "*.staging.example.com")
 *     responses:
 *       200:
 *         description: Test toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 rule:
 *                   type: object
 *                   description: The created skip rule (when disabling)
 *                 rulesRemoved:
 *                   type: boolean
 *                   description: True when all rules were removed (when enabling)
 *       400:
 *         description: Bad request (missing reason when disabling)
 *       404:
 *         description: Test not found
 *       500:
 *         description: Server error
 */

interface ToggleBody {
  enabled: boolean;
  reason?: string;
  branchPattern?: string;
  envPattern?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid test ID format" },
        { status: 400 }
      );
    }

    const body: ToggleBody = await request.json();
    const { enabled, reason, branchPattern, envPattern } = body;

    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    if (enabled) {
      await db
        .update(skipRules)
        .set({ deletedAt: new Date() })
        .where(and(eq(skipRules.testId, id), isNull(skipRules.deletedAt)));

      return NextResponse.json({ success: true, rulesRemoved: true });
    } else {
      if (!reason) {
        return NextResponse.json(
          { error: "Reason is required when disabling a test" },
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

      const [rule] = await db
        .insert(skipRules)
        .values({
          testId: id,
          reason,
          branchPattern: branchPattern || null,
          envPattern: envPattern || null,
        })
        .returning();

      return NextResponse.json({ success: true, rule });
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to toggle test");
    return NextResponse.json(
      { error: "Failed to toggle test" },
      { status: 500 }
    );
  }
}
