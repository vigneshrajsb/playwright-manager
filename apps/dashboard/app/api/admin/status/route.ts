import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testRuns } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  const [testCount] = await db.select({ count: count() }).from(tests);
  const [runCount] = await db.select({ count: count() }).from(testRuns);

  return NextResponse.json({
    hasData: testCount.count > 0 || runCount.count > 0,
    testCount: testCount.count,
    runCount: runCount.count,
  });
}
