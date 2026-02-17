import { db } from "@/lib/db";
import { testRuns } from "@/lib/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const STALE_THRESHOLD_HOURS = 3;

/**
 * Marks test runs stuck in "running" status for longer than the threshold
 * as "interrupted". This handles cases where a CI job crashes and the
 * reporter's onEnd() never fires.
 */
export async function cleanupStaleRuns(): Promise<void> {
  try {
    const cutoff = sql`now() - interval '${sql.raw(String(STALE_THRESHOLD_HOURS))} hours'`;

    const updated = await db
      .update(testRuns)
      .set({
        status: "interrupted",
        finishedAt: sql`now()`,
      })
      .where(
        and(eq(testRuns.status, "running"), lt(testRuns.startedAt, cutoff))
      )
      .returning({ id: testRuns.id });

    if (updated.length > 0) {
      logger.info(
        { count: updated.length },
        "Cleaned up stale running test runs"
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to cleanup stale runs");
  }
}
