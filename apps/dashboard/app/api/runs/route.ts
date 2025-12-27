import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns } from "@/lib/db/schema";
import { eq, desc, sql, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const branch = searchParams.get("branch");
  const status = searchParams.get("status");
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const offset = (page - 1) * limit;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Build query
    let query = db
      .select()
      .from(testRuns)
      .where(gte(testRuns.startedAt, since))
      .orderBy(desc(testRuns.startedAt))
      .limit(limit)
      .offset(offset);

    const runs = await query;

    // Filter in application layer for simplicity
    let filteredRuns = runs;
    if (branch) {
      filteredRuns = runs.filter((r) => r.branch === branch);
    }
    if (status) {
      filteredRuns = runs.filter((r) => r.status === status);
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(testRuns)
      .where(gte(testRuns.startedAt, since));
    const total = Number(countResult[0].count);

    // Get unique branches for filter
    const branches = await db
      .selectDistinct({ branch: testRuns.branch })
      .from(testRuns)
      .where(gte(testRuns.startedAt, since));

    return NextResponse.json({
      runs: filteredRuns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        branches: branches.map((b) => b.branch).filter(Boolean),
        statuses: ["running", "passed", "failed", "interrupted"],
      },
    });
  } catch (error) {
    console.error("Error fetching runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch runs" },
      { status: 500 }
    );
  }
}
