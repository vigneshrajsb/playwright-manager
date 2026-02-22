import * as fs from "node:fs";
import * as path from "node:path";
import { createJiti } from "jiti";
import type { TestManagerReporterOptions } from "./types";

const CONFIG_NAMES = [
  "playwright.config.ts",
  "playwright.config.js",
  "playwright.config.mts",
  "playwright.config.mjs",
];

export function findConfigFile(cwd: string = process.cwd()): string | null {
  for (const name of CONFIG_NAMES) {
    const full = path.join(cwd, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

export function loadReporterConfig(configPath: string): TestManagerReporterOptions | null {
  const jiti = createJiti(__filename);
  const loaded: unknown = jiti(configPath);
  const config = (loaded as any)?.default ?? loaded;

  const reporters = (config as any)?.reporter;
  if (!Array.isArray(reporters)) return null;

  for (const entry of reporters) {
    if (Array.isArray(entry) && entry[0] === "@playwright-manager/reporter") {
      return (entry[1] ?? null) as TestManagerReporterOptions | null;
    }
  }

  return null;
}
