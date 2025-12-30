import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * @swagger
 * /api/tests/filters:
 *   get:
 *     tags:
 *       - Tests
 *     summary: Get filter options for tests
 *     description: Returns available repositories, projects, and tags for filtering tests. This is a separate endpoint to reduce load on paginated queries.
 *     responses:
 *       200:
 *         description: Filter options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 repositories:
 *                   type: array
 *                   items:
 *                     type: string
 *                 projects:
 *                   type: array
 *                   items:
 *                     type: string
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Server error
 */
export async function GET() {
  try {
    // Get unique repositories (excluding deleted tests)
    const repositories = await db
      .selectDistinct({ repository: tests.repository })
      .from(tests)
      .where(eq(tests.isDeleted, false));

    // Get unique projects (excluding deleted tests)
    const projects = await db
      .selectDistinct({ projectName: tests.projectName })
      .from(tests)
      .where(eq(tests.isDeleted, false));

    // Get unique tags (excluding deleted tests)
    const tagsResult = await db
      .select({ tags: tests.tags })
      .from(tests)
      .where(
        and(
          eq(tests.isDeleted, false),
          sql`${tests.tags} IS NOT NULL AND array_length(${tests.tags}, 1) > 0`
        )
      );

    // Flatten and dedupe tags
    const allTags = new Set<string>();
    for (const row of tagsResult) {
      if (row.tags) {
        for (const t of row.tags) {
          allTags.add(t);
        }
      }
    }

    return NextResponse.json({
      repositories: repositories.map((r) => r.repository),
      projects: projects.map((p) => p.projectName),
      tags: Array.from(allTags).sort(),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch test filters");
    return NextResponse.json(
      { error: "Failed to fetch test filters" },
      { status: 500 }
    );
  }
}
