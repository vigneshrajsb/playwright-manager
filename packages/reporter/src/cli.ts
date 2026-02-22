#!/usr/bin/env node
import { parseArgs } from "node:util";
import { detectCIEnvironment, generateRunId } from "./ci-detect";
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

  if (command === "upload-report") {
    await uploadReport(values);
  } else {
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

  const { s3, apiUrl, repository } = options;
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
      status: "passed",
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
  upload-report    Upload Playwright HTML report to S3

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
