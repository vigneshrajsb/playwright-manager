import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tests, skipRules, SkipRule } from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { minimatch } from "minimatch";

/**
 * @swagger
 * /api/tests/check:
 *   post:
 *     tags:
 *       - Tests
 *     summary: Check disabled tests
 *     description: Returns a map of disabled tests based on skip rules. Used by the fixture to determine which tests to skip.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repository
 *             properties:
 *               repository:
 *                 type: string
 *                 description: Repository in "org/repo" format (required)
 *               testIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional array of Playwright test IDs to filter
 *               projectName:
 *                 type: string
 *                 description: Project name to filter by
 *               branch:
 *                 type: string
 *                 description: Current git branch for conditional skip matching
 *               baseURL:
 *                 type: string
 *                 description: Current Playwright baseURL for conditional skip matching
 *     responses:
 *       200:
 *         description: Disabled tests map retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disabledTests:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       reason:
 *                         type: string
 *                         nullable: true
 *                       ruleId:
 *                         type: string
 *                       matchedBranch:
 *                         type: boolean
 *                       matchedEnv:
 *                         type: boolean
 *                 timestamp:
 *                   type: integer
 *                   description: Unix timestamp in milliseconds
 *       500:
 *         description: Server error
 */

interface CheckBody {
  repository: string;
  testIds?: string[];
  projectName?: string;
  branch?: string;
  baseURL?: string;
}

interface MatchResult {
  matches: boolean;
  matchedBranch?: boolean;
  matchedEnv?: boolean;
}

/**
 * Match a skip rule against the current branch and baseURL context
 */
function matchRule(
  rule: SkipRule,
  branch: string | undefined,
  baseURL: string | undefined
): MatchResult {
  const hasBranchPattern = !!rule.branchPattern;
  const hasEnvPattern = !!rule.envPattern;

  // Global rule (no patterns) - always matches
  if (!hasBranchPattern && !hasEnvPattern) {
    return { matches: true };
  }

  let branchMatches = true;
  let envMatches = true;

  // Safe minimatch options to prevent ReDoS attacks
  const minimatchOptions = {
    nocase: true,
    nobrace: true, // Disable brace expansion
    noext: true, // Disable extglob
  };

  if (hasBranchPattern) {
    if (!branch) {
      // No branch provided, branch-specific rule doesn't match
      branchMatches = false;
    } else {
      branchMatches = minimatch(branch, rule.branchPattern!, minimatchOptions);
    }
  }

  if (hasEnvPattern) {
    if (!baseURL) {
      // No baseURL provided, env-specific rule doesn't match
      envMatches = false;
    } else {
      try {
        const url = new URL(baseURL);
        envMatches = minimatch(url.hostname, rule.envPattern!, minimatchOptions);
      } catch {
        envMatches = false;
      }
    }
  }

  // Both must match if both are specified (AND within rule)
  const matches = branchMatches && envMatches;

  return {
    matches,
    matchedBranch: hasBranchPattern ? branchMatches : undefined,
    matchedEnv: hasEnvPattern ? envMatches : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckBody = await request.json();
    const { repository, testIds, projectName, branch, baseURL } = body;

    if (!repository) {
      return NextResponse.json(
        { error: "Repository is required" },
        { status: 400 }
      );
    }

    const conditions = [
      eq(tests.repository, repository),
      eq(tests.isDeleted, false),
    ];

    if (testIds && testIds.length > 0) {
      conditions.push(inArray(tests.playwrightTestId, testIds));
    }

    if (projectName) {
      conditions.push(eq(tests.projectName, projectName));
    }

    const testsWithRules = await db
      .select({
        playwrightTestId: tests.playwrightTestId,
        projectName: tests.projectName,
        rule: skipRules,
      })
      .from(tests)
      .leftJoin(skipRules, eq(tests.id, skipRules.testId))
      .where(and(...conditions));

    const testRulesMap = new Map<string, SkipRule[]>();
    for (const row of testsWithRules) {
      const key = projectName
        ? row.playwrightTestId
        : `${row.playwrightTestId}:${row.projectName}`;

      if (row.rule && !row.rule.deletedAt) {
        if (!testRulesMap.has(key)) {
          testRulesMap.set(key, []);
        }
        testRulesMap.get(key)!.push(row.rule);
      }
    }

    const disabledMap: Record<
      string,
      {
        reason: string;
        ruleId: string;
        matchedBranch?: boolean;
        matchedEnv?: boolean;
      }
    > = {};

    for (const [testKey, rules] of testRulesMap) {
      for (const rule of rules) {
        const matchResult = matchRule(rule, branch, baseURL);
        if (matchResult.matches) {
          disabledMap[testKey] = {
            reason: rule.reason,
            ruleId: rule.id,
            matchedBranch: matchResult.matchedBranch,
            matchedEnv: matchResult.matchedEnv,
          };
          break; // First matching rule wins (OR between rules)
        }
      }
    }

    return NextResponse.json({
      disabledTests: disabledMap,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to check tests");
    return NextResponse.json(
      { error: "Failed to check tests" },
      { status: 500 }
    );
  }
}
