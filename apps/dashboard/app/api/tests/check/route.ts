import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests } from "@/lib/db/schema";
import { inArray, and, eq } from "drizzle-orm";

/**
 * @swagger
 * /api/tests/check:
 *   post:
 *     tags:
 *       - Tests
 *     summary: Check disabled tests
 *     description: Returns a map of disabled tests. Used by the fixture to determine which tests to skip.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               testIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional array of Playwright test IDs to filter
 *               projectName:
 *                 type: string
 *                 description: Project name to filter by
 *     responses:
 *       200:
 *         description: Disabled tests map retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disabledTests:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       reason:
 *                         type: string
 *                         nullable: true
 *                 timestamp:
 *                   type: integer
 *                   description: Unix timestamp in milliseconds
 *       500:
 *         description: Server error
 */

interface CheckBody {
  testIds?: string[];
  projectName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckBody = await request.json();
    const { testIds, projectName } = body;

    // Build query conditions - always filter by disabled only
    const conditions = [eq(tests.isEnabled, false)];

    // Optionally filter by specific testIds (if provided)
    if (testIds && testIds.length > 0) {
      conditions.push(inArray(tests.playwrightTestId, testIds));
    }

    // Optionally filter by project
    if (projectName) {
      conditions.push(eq(tests.projectName, projectName));
    }

    const disabledTests = await db
      .select({
        playwrightTestId: tests.playwrightTestId,
        projectName: tests.projectName,
        disabledReason: tests.disabledReason,
      })
      .from(tests)
      .where(and(...conditions));

    // Create a map for quick lookup
    const disabledMap: Record<string, { reason?: string | null }> = {};
    for (const t of disabledTests) {
      const key = projectName
        ? t.playwrightTestId
        : `${t.playwrightTestId}:${t.projectName}`;
      disabledMap[key] = { reason: t.disabledReason };
    }

    return NextResponse.json({
      disabledTests: disabledMap,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error checking tests:", error);
    return NextResponse.json(
      { error: "Failed to check tests" },
      { status: 500 }
    );
  }
}
