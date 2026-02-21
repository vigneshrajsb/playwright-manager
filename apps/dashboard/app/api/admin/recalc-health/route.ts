import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests } from "@/lib/db/schema";
import { updateTestHealth } from "@/lib/health/update-test-health";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testIdParam = searchParams.get("testId");

  try {
    if (testIdParam) {
      const testId = parseInt(testIdParam, 10);
      if (isNaN(testId)) {
        return NextResponse.json({ error: "Invalid testId" }, { status: 400 });
      }

      const test = await db.query.tests.findFirst({ where: eq(tests.id, testId) });
      if (!test) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      await db.transaction(async (tx) => {
        await updateTestHealth(tx, testId);
      });

      logger.info(`Recalculated health for test ${testId}`);
      return NextResponse.json({ recalculated: 1, testIds: [testId] });
    }

    const allTests = await db.query.tests.findMany({
      where: eq(tests.isDeleted, false),
      columns: { id: true },
    });

    let recalculated = 0;
    for (const test of allTests) {
      await db.transaction(async (tx) => {
        await updateTestHealth(tx, test.id);
      });
      recalculated++;
    }

    logger.info(`Recalculated health for ${recalculated} tests`);
    return NextResponse.json({ recalculated });
  } catch (error) {
    logger.error("Failed to recalculate health:", error);
    return NextResponse.json(
      { error: "Failed to recalculate health" },
      { status: 500 }
    );
  }
}
