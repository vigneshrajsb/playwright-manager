import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
    console.error("Error toggling test:", error);
    return NextResponse.json(
      { error: "Failed to toggle test" },
      { status: 500 }
    );
  }
}
