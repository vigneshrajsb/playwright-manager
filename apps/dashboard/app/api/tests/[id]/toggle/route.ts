import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * @swagger
 * /api/tests/{id}/toggle:
 *   patch:
 *     tags:
 *       - Tests
 *     summary: Toggle test enabled status
 *     description: Enables or disables a test. Disabled tests will be auto-skipped by the fixture during test runs.
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
 *                 description: Reason for disabling the test (optional)
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
 *                 test:
 *                   type: object
 *       404:
 *         description: Test not found
 *       500:
 *         description: Server error
 */

interface ToggleBody {
  enabled: boolean;
  reason?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: ToggleBody = await request.json();
    const { enabled, reason } = body;

    const [updated] = await db
      .update(tests)
      .set({
        isEnabled: enabled,
        disabledAt: enabled ? null : new Date(),
        disabledReason: enabled ? null : reason || null,
        updatedAt: new Date(),
      })
      .where(eq(tests.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, test: updated });
  } catch (error) {
    logger.error({ err: error }, "Failed to toggle test");
    return NextResponse.json(
      { error: "Failed to toggle test" },
      { status: 500 }
    );
  }
}
