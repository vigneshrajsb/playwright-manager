import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests } from "@/lib/db/schema";
import { inArray, and, eq } from "drizzle-orm";

interface CheckBody {
  testIds: string[];
  projectName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckBody = await request.json();
    const { testIds, projectName } = body;

    if (!testIds || testIds.length === 0) {
      return NextResponse.json({ disabledTests: {}, timestamp: Date.now() });
    }

    // Query for disabled tests only (optimization)
    const conditions = [
      inArray(tests.playwrightTestId, testIds),
      eq(tests.isEnabled, false),
    ];

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
