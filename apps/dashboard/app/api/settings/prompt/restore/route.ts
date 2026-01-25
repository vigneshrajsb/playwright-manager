import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promptSettings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { invalidatePromptCache } from "@/lib/flakiness-analyzer/prompts";

const MAX_VERSIONS = 10;

/**
 * POST /api/settings/prompt/restore
 * Restores a previous version by creating a new version with its content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { versionId } = body;

    if (!versionId || typeof versionId !== "string") {
      return NextResponse.json(
        { error: "versionId is required" },
        { status: 400 }
      );
    }

    // Find the version to restore
    const [versionToRestore] = await db
      .select()
      .from(promptSettings)
      .where(eq(promptSettings.id, versionId))
      .limit(1);

    if (!versionToRestore) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
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

    // Insert new version with restored content
    const [inserted] = await db
      .insert(promptSettings)
      .values({
        content: versionToRestore.content,
        version: newVersion,
        isActive: true,
        createdBy: "user",
      })
      .returning();

    // Invalidate the cached prompt so the restored one is used immediately
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
      restoredFrom: versionToRestore.version,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to restore prompt version");
    return NextResponse.json(
      { error: "Failed to restore prompt version" },
      { status: 500 }
    );
  }
}
