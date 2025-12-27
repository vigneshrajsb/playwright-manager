import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testRuns, testResults, tests } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get run
    const run = await db.query.testRuns.findFirst({
      where: eq(testRuns.id, id),
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Get results with test info
    const results = await db
      .select({
        result: testResults,
        test: tests,
      })
      .from(testResults)
      .innerJoin(tests, eq(testResults.testId, tests.id))
      .where(eq(testResults.testRunId, id))
      .orderBy(desc(testResults.startedAt));

    // Group by outcome for summary
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.result.outcome === "expected").length,
      failed: results.filter((r) => r.result.outcome === "unexpected").length,
      skipped: results.filter((r) => r.result.outcome === "skipped").length,
      flaky: results.filter((r) => r.result.outcome === "flaky").length,
    };

    return NextResponse.json({
      run,
      summary,
      results: results.map((r) => ({
        ...r.result,
        test: {
          id: r.test.id,
          filePath: r.test.filePath,
          testTitle: r.test.testTitle,
          projectName: r.test.projectName,
          tags: r.test.tags,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching run:", error);
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
