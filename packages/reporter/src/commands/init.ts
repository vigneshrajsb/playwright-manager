import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { findConfigFile } from "../config-loader";

function prompt(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

function detectRepository(): string | undefined {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf-8",
    }).trim();
    const match = url.match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    // Not a git repo or no remote
  }
  return undefined;
}

function detectPackageManager(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(cwd, "bun.lockb"))) return "bun";
  return "npm";
}

export async function runInit(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  console.log("Playwright Manager Setup");
  console.log("========================");
  console.log("");

  try {
    const detectedRepo = detectRepository();
    const apiUrl = await prompt(rl, "Dashboard URL", "http://localhost:3000");
    const repository = await prompt(rl, "Repository (org/repo)", detectedRepo);

    if (!repository) {
      console.error("\nRepository is required. Run again with a valid org/repo.");
      process.exit(1);
    }

    const configPath = findConfigFile(process.cwd());
    const pm = detectPackageManager();
    const installCmd = pm === "yarn" ? "add -D" : "install -D";

    console.log("");
    console.log("---");
    console.log("");
    console.log("1. Install packages:");
    console.log("");
    console.log(`   ${pm} ${installCmd} @playwright-manager/reporter @playwright-manager/fixture`);
    console.log("");

    if (configPath) {
      console.log(`2. Add this to your ${path.basename(configPath)}:`);
    } else {
      console.log("2. Add this to your playwright.config.ts:");
    }
    console.log("");
    console.log('   import { defineConfig } from "@playwright/test";');
    console.log("");
    console.log("   export default defineConfig({");
    console.log("     reporter: [");
    console.log('       ["html"],');
    console.log('       ["@playwright-manager/reporter", {');
    console.log(`         apiUrl: "${apiUrl}",`);
    console.log(`         repository: "${repository}",`);
    console.log("       }],");
    console.log("     ],");
    console.log("     use: {");
    console.log("       testManager: {");
    console.log(`         apiUrl: "${apiUrl}",`);
    console.log(`         repository: "${repository}",`);
    console.log("       },");
    console.log("     },");
    console.log("   });");
    console.log("");

    console.log("3. Run your tests:");
    console.log("");
    console.log("   npx playwright test");
    console.log("");

    console.log("---");
    console.log("");
    console.log("Checking dashboard connectivity...");

    try {
      const res = await fetch(`${apiUrl}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`  Dashboard: connected`);
        console.log(`  Database:  ${(data as any).db || "unknown"}`);
        console.log(`  Storage:   ${(data as any).s3 || "unknown"}`);
      } else {
        console.log(`  Dashboard returned ${res.status} — check if it's running at ${apiUrl}`);
      }
    } catch {
      console.log(`  Could not reach ${apiUrl} — make sure the dashboard is running`);
    }

    console.log("");
  } finally {
    rl.close();
  }
}
