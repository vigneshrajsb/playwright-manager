import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, testHealth, testResults, testRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get test with health
    const test = await db.query.tests.findFirst({
      where: eq(tests.id, id),
      with: {
        health: true,
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Get recent results with run info
    const recentResults = await db
      .select({
        result: testResults,
        run: testRuns,
      })
      .from(testResults)
      .innerJoin(testRuns, eq(testResults.testRunId, testRuns.id))
      .where(eq(testResults.testId, id))
      .orderBy(desc(testResults.startedAt))
      .limit(50);

    return NextResponse.json({
      test,
      results: recentResults.map((r) => ({
        ...r.result,
        run: {
          id: r.run.id,
          runId: r.run.runId,
          branch: r.run.branch,
          commitSha: r.run.commitSha,
          status: r.run.status,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching test:", error);
    return NextResponse.json(
      { error: "Failed to fetch test" },
      { status: 500 }
    );
  }
}
