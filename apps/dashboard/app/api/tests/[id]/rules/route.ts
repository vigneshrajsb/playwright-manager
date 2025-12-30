import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, skipRules } from "@/lib/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { isValidUUID } from "@/lib/validation/uuid";

/**
 * @swagger
 * /api/tests/{id}/rules:
 *   get:
 *     tags:
 *       - Tests
 *     summary: Get skip rules for a test
 *     description: Returns all skip rules configured for a specific test.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Test ID (UUID)
 *     responses:
 *       200:
 *         description: Skip rules retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rules:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       testId:
 *                         type: string
 *                       branchPattern:
 *                         type: string
 *                         nullable: true
 *                       envPattern:
 *                         type: string
 *                         nullable: true
 *                       reason:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Test not found
 *       500:
 *         description: Server error
 */

export async function GET(
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

    const [test] = await db.select().from(tests).where(eq(tests.id, id));
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const rules = await db
      .select()
      .from(skipRules)
      .where(and(eq(skipRules.testId, id), isNull(skipRules.deletedAt)))
      .orderBy(desc(skipRules.createdAt));

    return NextResponse.json({ rules });
  } catch (error) {
    logger.error({ err: error }, "Failed to get skip rules");
    return NextResponse.json(
      { error: "Failed to get skip rules" },
      { status: 500 }
    );
  }
}
