import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promptSettings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import {
  FLAKINESS_ANALYSIS_PROMPT,
  invalidatePromptCache,
} from "@/lib/flakiness-analyzer/prompts";

const MAX_VERSIONS = 10;

/**
 * GET /api/settings/prompt
 * Returns active prompt (or null if using default) and version history
 */
export async function GET() {
  try {
    const allVersions = await db
      .select()
      .from(promptSettings)
      .orderBy(desc(promptSettings.version))
      .limit(MAX_VERSIONS);

    const active = allVersions.find((v) => v.isActive) || null;
    const history = allVersions.map((v) => ({
      id: v.id,
      version: v.version,
      createdAt: v.createdAt.toISOString(),
      isActive: v.isActive,
    }));

    return NextResponse.json({
      active: active
        ? {
            id: active.id,
            content: active.content,
            version: active.version,
            createdAt: active.createdAt.toISOString(),
          }
        : null,
      history,
      default: FLAKINESS_ANALYSIS_PROMPT,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch prompt settings");
    return NextResponse.json(
      { error: "Failed to fetch prompt settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/prompt
 * Saves a new version of the prompt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    // Get current max version
    const [latest] = await db
      .select({ version: promptSettings.version })
      .from(promptSettings)
      .orderBy(desc(promptSettings.version))
      .limit(1);

    const newVersion = (latest?.version ?? 0) + 1;

    // Deactivate all existing active prompts
    await db
      .update(promptSettings)
      .set({ isActive: false })
      .where(eq(promptSettings.isActive, true));

    // Insert new version
    const [inserted] = await db
      .insert(promptSettings)
      .values({
        content,
        version: newVersion,
        isActive: true,
        createdBy: "user",
      })
      .returning();

    // Invalidate the cached prompt so the new one is used immediately
    invalidatePromptCache();

    // Clean up old versions (keep only MAX_VERSIONS)
    const allVersions = await db
      .select({ id: promptSettings.id, version: promptSettings.version })
      .from(promptSettings)
      .orderBy(desc(promptSettings.version));

    if (allVersions.length > MAX_VERSIONS) {
      const versionsToDelete = allVersions.slice(MAX_VERSIONS);
      for (const v of versionsToDelete) {
        await db.delete(promptSettings).where(eq(promptSettings.id, v.id));
      }
    }

    return NextResponse.json({
      success: true,
      prompt: {
        id: inserted.id,
        content: inserted.content,
        version: inserted.version,
        createdAt: inserted.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to save prompt settings");
    return NextResponse.json(
      { error: "Failed to save prompt settings" },
      { status: 500 }
    );
  }
}
