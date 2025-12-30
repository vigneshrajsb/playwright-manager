import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skipRules } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { isValidUUID } from "@/lib/validation/uuid";
import { validatePatterns } from "@/lib/validation/patterns";

interface UpdateRuleBody {
  reason?: string;
  branchPattern?: string | null;
  envPattern?: string | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid rule ID format" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as UpdateRuleBody;

    // Validate patterns if provided
    if ("branchPattern" in body || "envPattern" in body) {
      const validation = validatePatterns(
        body.branchPattern,
        body.envPattern
      );
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    // Validate reason if provided
    if ("reason" in body && (!body.reason || body.reason.trim().length === 0)) {
      return NextResponse.json(
        { error: "Reason is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Partial<typeof skipRules.$inferInsert> = {};
    if ("reason" in body) updateData.reason = body.reason!.trim();
    if ("branchPattern" in body)
      updateData.branchPattern = body.branchPattern?.trim() || null;
    if ("envPattern" in body)
      updateData.envPattern = body.envPattern?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(skipRules)
      .set(updateData)
      .where(and(eq(skipRules.id, id), isNull(skipRules.deletedAt)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Skip rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ rule: updated });
  } catch (error) {
    logger.error({ err: error }, "Failed to update skip rule");
    return NextResponse.json(
      { error: "Failed to update skip rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: "Invalid rule ID format" },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .update(skipRules)
      .set({ deletedAt: new Date() })
      .where(and(eq(skipRules.id, id), isNull(skipRules.deletedAt)))
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
