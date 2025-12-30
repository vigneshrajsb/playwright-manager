import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, skipRules } from "@/lib/db/schema";
import {
  eq,
  desc,
  asc,
  sql,
  and,
  or,
  isNull,
  isNotNull,
  ilike,
} from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 1000);
  const search = searchParams.get("search");
  const repository = searchParams.get("repository");
  const project = searchParams.get("project");
  const ruleType = searchParams.get("ruleType"); // global, branch, env, branch+env (comma-separated)
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  try {
    const conditions: ReturnType<typeof and>[] = [];

    // Only active rules (not soft deleted)
    conditions.push(isNull(skipRules.deletedAt));

    // Only non-deleted tests
    conditions.push(eq(tests.isDeleted, false));

    // Search across test title, reason, and patterns
    if (search) {
      conditions.push(
        or(
          ilike(tests.testTitle, `%${search}%`),
          ilike(skipRules.reason, `%${search}%`),
          ilike(skipRules.branchPattern, `%${search}%`),
          ilike(skipRules.envPattern, `%${search}%`)
        )
      );
    }

    // Filter by repository
    if (repository) {
      conditions.push(eq(tests.repository, repository));
    }

    // Filter by project
    if (project) {
      conditions.push(eq(tests.projectName, project));
    }

    // Filter by rule type
    if (ruleType) {
      const types = ruleType.split(",");
      const typeConditions = types
        .map((t) => {
          if (t === "global")
            return and(
              isNull(skipRules.branchPattern),
              isNull(skipRules.envPattern)
            );
          if (t === "branch")
            return and(
              isNotNull(skipRules.branchPattern),
              isNull(skipRules.envPattern)
            );
          if (t === "env")
            return and(
              isNull(skipRules.branchPattern),
              isNotNull(skipRules.envPattern)
            );
          if (t === "branch+env")
            return and(
              isNotNull(skipRules.branchPattern),
              isNotNull(skipRules.envPattern)
            );
          return undefined;
        })
        .filter(Boolean);

      if (typeConditions.length > 0) {
        conditions.push(or(...typeConditions));
      }
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * limit;

    // Get sort column
    const sortColumn =
      sortBy === "testTitle"
        ? tests.testTitle
        : sortBy === "projectName"
          ? tests.projectName
          : skipRules.createdAt;

    // Query rules with joined test data
    const result = await db
      .select({
        id: skipRules.id,
        testId: skipRules.testId,
        branchPattern: skipRules.branchPattern,
        envPattern: skipRules.envPattern,
        reason: skipRules.reason,
        createdAt: skipRules.createdAt,
        test: {
          id: tests.id,
          testTitle: tests.testTitle,
          filePath: tests.filePath,
          projectName: tests.projectName,
          repository: tests.repository,
        },
      })
      .from(skipRules)
      .innerJoin(tests, eq(skipRules.testId, tests.id))
      .where(whereClause)
      .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(skipRules)
      .innerJoin(tests, eq(skipRules.testId, tests.id))
      .where(whereClause);

    const total = Number(countResult[0].count);

    // Get available filter values
    const [repositories, projects] = await Promise.all([
      db
        .selectDistinct({ repository: tests.repository })
        .from(skipRules)
        .innerJoin(tests, eq(skipRules.testId, tests.id))
        .where(and(isNull(skipRules.deletedAt), eq(tests.isDeleted, false))),
      db
        .selectDistinct({ projectName: tests.projectName })
        .from(skipRules)
        .innerJoin(tests, eq(skipRules.testId, tests.id))
        .where(and(isNull(skipRules.deletedAt), eq(tests.isDeleted, false))),
    ]);

    return NextResponse.json({
      rules: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        repositories: repositories.map((r) => r.repository),
        projects: projects.map((p) => p.projectName),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch quarantined rules");
    return NextResponse.json(
      { error: "Failed to fetch quarantined rules" },
      { status: 500 }
    );
  }
}
