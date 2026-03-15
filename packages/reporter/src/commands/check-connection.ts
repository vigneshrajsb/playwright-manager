import { findConfigFile, loadReporterConfig } from "../config-loader";

interface CheckConnectionFlags {
  config?: string;
}

export async function runCheckConnection(flags: CheckConnectionFlags): Promise<void> {
  const configPath = flags.config ?? findConfigFile(process.cwd());

  let apiUrl: string | undefined;

  if (configPath) {
    const options = loadReporterConfig(configPath);
    apiUrl = options?.apiUrl;
  }

  apiUrl = apiUrl || process.env.PLAYWRIGHT_MANAGER_URL;

  if (!apiUrl) {
    console.error(
      "[Playwright Manager] No apiUrl found. Configure it in playwright.config.ts or set PLAYWRIGHT_MANAGER_URL env var.",
    );
    process.exit(1);
  }

  console.log(`[Playwright Manager] Checking connection to ${apiUrl}...`);
  console.log("");

  try {
    const res = await fetch(`${apiUrl}/api/admin/health`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.log(`  Status:    FAILED (HTTP ${res.status})`);
      process.exit(1);
    }

    const data = (await res.json()) as { status: string; db: string; s3: string };

    console.log(`  Dashboard: ${data.status === "ok" ? "healthy" : data.status}`);
    console.log(`  Database:  ${data.db}`);
    console.log(`  Storage:   ${data.s3}`);
    console.log("");

    if (data.status !== "ok") {
      console.log("Dashboard is running but some services are degraded.");
      process.exit(1);
    }

    console.log("All checks passed.");
  } catch (err) {
    console.error(`  Could not reach ${apiUrl}`);
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error("");
    console.error("Make sure the dashboard is running and accessible.");
    process.exit(1);
  }
}
