#!/usr/bin/env node
import { parseArgs } from "node:util";
import { detectCIEnvironment, generateRunId } from "./ci-detect";
import { runCheckConnection } from "./commands/check-connection";
import { runInit } from "./commands/init";
import { findConfigFile, loadReporterConfig } from "./config-loader";
import { uploadReportDirectory } from "./s3-uploader";

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      config: { type: "string" },
      "report-dir": { type: "string" },
      "run-id": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  const command = positionals[0];

  if (values.help || !command) {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case "upload-report":
      await uploadReport(values);
      break;
    case "init":
      await runInit();
      break;
    case "check-connection":
      await runCheckConnection({ config: values.config });
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

interface UploadReportFlags {
  config?: string;
  "report-dir"?: string;
  "run-id"?: string;
}

async function uploadReport(values: UploadReportFlags): Promise<void> {
  const configPath = values.config ?? findConfigFile(process.cwd());
  if (!configPath) {
    console.error(
      "[Playwright Manager] Could not find playwright config. Use --config to specify path.",
    );
    process.exit(1);
  }

  let options: ReturnType<typeof loadReporterConfig>;
  try {
    options = loadReporterConfig(configPath);
  } catch (err: any) {
    console.error(`[Playwright Manager] Failed to load config: ${err.message}`);
    process.exit(1);
  }

  if (!options) {
    console.error(
      "[Playwright Manager] Could not find @playwright-manager/reporter in playwright config.",
    );
    process.exit(1);
  }

  const apiUrl = options.apiUrl || process.env.PLAYWRIGHT_MANAGER_URL || "";
  const repository = options.repository || process.env.PLAYWRIGHT_MANAGER_REPOSITORY || "";
  const { s3 } = options;

  if (!s3) {
    console.error("[Playwright Manager] No s3 config found in reporter options.");
    process.exit(1);
  }

  const s3Config = values["report-dir"] ? { ...s3, reportDir: values["report-dir"] } : s3;

  const ciEnv = detectCIEnvironment();
  const runId = values["run-id"] ?? options.runId ?? ciEnv.runId ?? generateRunId();

  console.log("[Playwright Manager] Uploading report to S3...");
  const reportPath = await uploadReportDirectory(s3Config, repository, runId);

  const response = await fetch(`${apiUrl}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId,
      metadata: {
        repository,
        branch: options.branch ?? ciEnv.branch,
        commitSha: options.commitSha ?? ciEnv.commitSha,
        commitMessage: ciEnv.commitMessage,
        ciJobUrl: options.ciJobUrl ?? ciEnv.jobUrl,
        playwrightVersion: "unknown",
        workers: 1,
        reportPath,
      },
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      results: [],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API returned ${response.status}: ${text}`);
  }

  console.log("");
  console.log("[Playwright Manager] Report uploaded successfully");
  console.log(`  S3 Path:    ${reportPath}`);
  console.log(`  Dashboard:  ${apiUrl}/dashboard/pipelines?pipelineId=${runId}`);
  console.log("");
}

function printHelp(): void {
  console.log(`playwright-manager <command> [options]

Commands:
  init               Set up Playwright Manager in your project
  check-connection   Verify dashboard connectivity
  upload-report      Upload Playwright HTML report to S3

Options:
  --config <path>      Path to playwright.config.ts (default: auto-detect)
  --report-dir <path>  Override report directory (default: from config)
  --run-id <id>        Override run ID (default: auto-detect from CI)
  --help, -h           Show help
`);
}

if (require.main === module) {
  main().catch((err: Error) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
