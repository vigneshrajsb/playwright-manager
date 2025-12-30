import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skipRules } from "@/lib/db/schema";
import { and, inArray, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { isValidUUID } from "@/lib/validation/uuid";

interface BulkDeleteBody {
  ruleIds: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkDeleteBody = await request.json();
    const { ruleIds } = body;

    if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
      return NextResponse.json(
        { error: "ruleIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate all IDs are valid UUIDs
    const invalidIds = ruleIds.filter((id) => !isValidUUID(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Invalid rule ID format" },
        { status: 400 }
      );
    }

    // Soft delete all specified rules
    const result = await db
      .update(skipRules)
      .set({ deletedAt: new Date() })
      .where(and(inArray(skipRules.id, ruleIds), isNull(skipRules.deletedAt)))
      .returning({ id: skipRules.id });

    return NextResponse.json({
      success: true,
      deletedCount: result.length,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to bulk delete quarantined rules");
    return NextResponse.json(
      { error: "Failed to delete rules" },
      { status: 500 }
    );
  }
}
