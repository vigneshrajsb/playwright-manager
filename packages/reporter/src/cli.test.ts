import { beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "./cli";

vi.mock("./config-loader", () => ({
  findConfigFile: vi.fn().mockReturnValue("/project/playwright.config.ts"),
  loadReporterConfig: vi.fn().mockReturnValue({
    apiUrl: "http://localhost:3000",
    repository: "org/repo",
    s3: { bucket: "my-bucket", region: "us-east-1" },
  }),
}));

vi.mock("./s3-uploader", () => ({
  uploadReportDirectory: vi.fn().mockResolvedValue("reports/org/repo/run-123"),
}));

vi.mock("./ci-detect", () => ({
  detectCIEnvironment: vi.fn().mockReturnValue({
    isCI: false,
    branch: undefined,
    commitSha: undefined,
    runId: undefined,
  }),
  generateRunId: vi.fn().mockReturnValue("local-12345-abc"),
}));

const { findConfigFile, loadReporterConfig } = await import("./config-loader");
const { uploadReportDirectory } = await import("./s3-uploader");

class ProcessExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
  }
}

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.mocked(findConfigFile).mockReturnValue("/project/playwright.config.ts");
  vi.mocked(loadReporterConfig).mockReturnValue({
    apiUrl: "http://localhost:3000",
    repository: "org/repo",
    s3: { bucket: "my-bucket", region: "us-east-1" },
  });
  vi.mocked(uploadReportDirectory).mockResolvedValue("reports/org/repo/run-123");
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  });
  global.fetch = mockFetch;
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ProcessExitError((code as number) ?? 0);
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function expectExit(promise: Promise<void>, code: number): Promise<ProcessExitError> {
  const err = await promise.catch((e) => e);
  expect(err).toBeInstanceOf(ProcessExitError);
  expect((err as ProcessExitError).code).toBe(code);
  return err as ProcessExitError;
}

describe("main --help", () => {
  it("prints help and exits 0 with --help flag", async () => {
    await expectExit(main(["--help"]), 0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("upload-report"));
  });

  it("prints help and exits 0 with no command", async () => {
    await expectExit(main([]), 0);
  });

  it("exits 1 for unknown command", async () => {
    await expectExit(main(["unknown-command"]), 1);
  });
});

describe("upload-report", () => {
  it("runs full upload flow successfully", async () => {
    await main(["upload-report"]);

    expect(uploadReportDirectory).toHaveBeenCalledWith(
      { bucket: "my-bucket", region: "us-east-1" },
      "org/repo",
      "local-12345-abc",
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/reports",
      expect.objectContaining({ method: "POST" }),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("reports/org/repo/run-123"));
  });

  it("includes reportPath in API payload", async () => {
    await main(["upload-report"]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.metadata.reportPath).toBe("reports/org/repo/run-123");
    expect(body.results).toEqual([]);
    expect(body).not.toHaveProperty("status");
  });

  it("uses --run-id override", async () => {
    await main(["upload-report", "--run-id", "my-custom-run"]);

    expect(uploadReportDirectory).toHaveBeenCalledWith(
      expect.any(Object),
      "org/repo",
      "my-custom-run",
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.runId).toBe("my-custom-run");
  });

  it("overrides reportDir with --report-dir", async () => {
    await main(["upload-report", "--report-dir", "custom-report"]);

    expect(uploadReportDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ reportDir: "custom-report" }),
      "org/repo",
      expect.any(String),
    );
  });

  it("uses --config to load specific config file", async () => {
    await main(["upload-report", "--config", "/custom/playwright.config.ts"]);

    expect(loadReporterConfig).toHaveBeenCalledWith("/custom/playwright.config.ts");
  });

  it("exits 1 when no config file found", async () => {
    vi.mocked(findConfigFile).mockReturnValue(null);

    await expectExit(main(["upload-report"]), 1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Could not find"));
  });

  it("exits 1 when reporter not found in config", async () => {
    vi.mocked(loadReporterConfig).mockReturnValue(null);

    await expectExit(main(["upload-report"]), 1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("@playwright-manager/reporter"),
    );
  });

  it("exits 1 when no s3 config", async () => {
    vi.mocked(loadReporterConfig).mockReturnValue({
      apiUrl: "http://localhost:3000",
      repository: "org/repo",
    });

    await expectExit(main(["upload-report"]), 1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("s3 config"));
  });

  it("exits 1 when config loading throws", async () => {
    vi.mocked(loadReporterConfig).mockImplementation(() => {
      throw new Error("Cannot find module");
    });

    await expectExit(main(["upload-report"]), 1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Cannot find module"));
  });

  it("throws when API returns non-OK response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(main(["upload-report"])).rejects.toThrow("API returned 500");
  });
});
