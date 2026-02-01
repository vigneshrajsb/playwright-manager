import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skipRules } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { parseId } from "@/lib/validation/id";

/**
 * @swagger
 * /api/tests/{id}/rules/{ruleId}:
 *   delete:
 *     tags:
 *       - Tests
 *     summary: Delete a skip rule
 *     description: Soft-deletes a specific skip rule from a test by setting deletedAt timestamp.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test ID
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Skip rule ID
 *     responses:
 *       200:
 *         description: Skip rule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Skip rule not found
 *       500:
 *         description: Server error
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const { id: idStr, ruleId: ruleIdStr } = await params;
    const id = parseId(idStr);
    const ruleId = parseId(ruleIdStr);

    if (id === null) {
      return NextResponse.json(
        { error: "Invalid test ID format" },
        { status: 400 }
      );
    }
    if (ruleId === null) {
      return NextResponse.json(
        { error: "Invalid rule ID format" },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .update(skipRules)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(skipRules.id, ruleId),
          eq(skipRules.testId, id),
          isNull(skipRules.deletedAt) // Only update if not already deleted
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Skip rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete skip rule");
    return NextResponse.json(
      { error: "Failed to delete skip rule" },
      { status: 500 }
    );
  }
}
