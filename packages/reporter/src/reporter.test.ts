import { TestManagerReporter } from "./reporter";
import {
  createMockFullConfig,
  createMockFullResult,
  createMockSuite,
  createMockTestCase,
  createMockTestResult,
} from "./test-utils";

vi.mock("./s3-uploader", () => ({
  uploadReportDirectory: vi.fn().mockResolvedValue("reports/org/repo/run-123"),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ runId: "pipeline-123" }),
    text: () => Promise.resolve(""),
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const DEFAULT_OPTIONS = {
  apiUrl: "http://localhost:3000",
  repository: "org/repo",
} as const;

/**
 * Run a full reporter lifecycle (onBegin -> onTestEnd -> onEnd) and return
 * the parsed JSON body from the first fetch call. Covers the most common
 * test pattern in this file.
 */
async function runReporterLifecycle(opts?: {
  reporterOptions?: Record<string, unknown>;
  configOverrides?: Record<string, unknown>;
  testCaseOverrides?: Record<string, unknown>;
  testResultOverrides?: Record<string, unknown>;
  fullResultOverrides?: Record<string, unknown>;
}): Promise<{ body: any; reporter: TestManagerReporter }> {
  const reporter = new TestManagerReporter({
    ...DEFAULT_OPTIONS,
    ...opts?.reporterOptions,
  });

  const config = createMockFullConfig(opts?.configOverrides);
  reporter.onBegin(config, createMockSuite());

  const testCase = createMockTestCase(opts?.testCaseOverrides);
  const testResult = createMockTestResult(opts?.testResultOverrides);
  reporter.onTestEnd(testCase as any, testResult as any);

  await reporter.onEnd(createMockFullResult(opts?.fullResultOverrides));

  const call = mockFetch.mock.calls[0];
  const body = JSON.parse(call[1].body);
  return { body, reporter };
}

// ─── constructor ─────────────────────────────────────────────

describe("constructor", () => {
  it("throws if repository missing", () => {
    expect(() => new TestManagerReporter({ apiUrl: "http://localhost:3000" } as any)).toThrow(
      "repository option is required",
    );
  });

  it("does NOT throw when disabled:true even without repository", () => {
    expect(
      () =>
        new TestManagerReporter({
          apiUrl: "http://localhost:3000",
          disabled: true,
        } as any),
    ).not.toThrow();
  });

  it("applies defaults for batchSize, flushInterval, failSilently, debug", async () => {
    const reporter = new TestManagerReporter(DEFAULT_OPTIONS);

    reporter.onBegin(createMockFullConfig(), createMockSuite());

    // Add a single test (below default batchSize of 50)
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    // Should NOT have flushed yet (only 1 result, batchSize=50)
    expect(mockFetch).not.toHaveBeenCalled();

    await reporter.onEnd(createMockFullResult());

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.results).toHaveLength(1);
    expect(body.status).toBe("passed");
  });
});

// ─── CI detection ────────────────────────────────────────────

describe("CI detection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    const ciVars = [
      "GITHUB_ACTIONS",
      "GITHUB_REF_NAME",
      "GITHUB_HEAD_REF",
      "GITHUB_SHA",
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_ATTEMPT",
      "GITLAB_CI",
      "CIRCLECI",
      "JENKINS_URL",
      "TF_BUILD",
      "CF_BUILD_URL",
      "CI",
    ];
    for (const v of ciVars) delete process.env[v];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("detects GitHub Actions environment", async () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REF_NAME = "main";
    process.env.GITHUB_SHA = "abc123def456";
    process.env.GITHUB_SERVER_URL = "https://github.com";
    process.env.GITHUB_REPOSITORY = "org/repo";
    process.env.GITHUB_RUN_ID = "12345";
    process.env.GITHUB_RUN_ATTEMPT = "1";

    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBe("main");
    expect(body.metadata.commitSha).toBe("abc123def456");
    expect(body.metadata.ciJobUrl).toBe("https://github.com/org/repo/actions/runs/12345");
    expect(body.runId).toBe("github-12345-1");
  });

  it("detects local environment when no CI vars set", async () => {
    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBeUndefined();
    expect(body.runId).toMatch(/^local-/);
  });
});

// ─── onBegin ─────────────────────────────────────────────────

describe("onBegin", () => {
  it("extracts baseURL from first project with baseURL", async () => {
    const { body } = await runReporterLifecycle({
      configOverrides: {
        projects: [
          { name: "no-base", use: {}, retries: 0 },
          { name: "with-base", use: { baseURL: "http://staging.example.com" }, retries: 0 },
        ],
      },
    });

    expect(body.metadata.baseUrl).toBe("http://staging.example.com");
  });
});

// ─── onTestEnd ───────────────────────────────────────────────

describe("onTestEnd", () => {
  it("records basic test result correctly", async () => {
    const { body } = await runReporterLifecycle();
    const result = body.results[0];

    expect(result.testId).toBe("test-id-1");
    expect(result.title).toBe("my test");
    expect(result.titlePath).toEqual(["suite", "my test"]);
    expect(result.status).toBe("passed");
    expect(result.duration).toBe(1500);
    expect(result.retry).toBe(0);
    expect(result.workerIndex).toBe(0);
    expect(result.parallelIndex).toBe(0);
    expect(result.projectName).toBe("default");
    expect(result.outcome).toBe("expected");
    expect(result.isFinalAttempt).toBe(true);
  });

  it("includes error data when test has error", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: { expectedStatus: "passed" },
      testResultOverrides: {
        status: "failed",
        error: {
          message: "Expected true to be false",
          stack: "Error: Expected true to be false\n    at test.spec.ts:10",
        },
      },
      fullResultOverrides: { status: "failed" },
    });

    expect(body.results[0].error).toEqual({
      message: "Expected true to be false",
      stack: "Error: Expected true to be false\n    at test.spec.ts:10",
    });
  });

  it("includes attachments metadata", async () => {
    const attachments = [
      { name: "screenshot", contentType: "image/png", path: "/tmp/screenshot.png" },
      { name: "video", contentType: "video/webm", path: "/tmp/video.webm" },
    ];

    const { body } = await runReporterLifecycle({
      testResultOverrides: { attachments },
    });

    expect(body.results[0].attachments).toEqual(attachments);
  });

  it("extracts tags from test.tags property, annotations, and @tag in title", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: {
        title: "my test @smoke",
        tags: ["@fast"],
        annotations: [
          { type: "tag", description: "@regression" },
          { type: "other", description: "not a tag" },
        ],
      },
    });

    const tags = body.results[0].tags;
    expect(tags).toContain("@fast");
    expect(tags).toContain("@regression");
    expect(tags).toContain("@smoke");
    expect(tags).not.toContain("not a tag");
  });

  it("deduplicates tags", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: {
        title: "my test @smoke",
        tags: ["@smoke"],
        annotations: [{ type: "tag", description: "@smoke" }],
      },
    });

    const smokeCount = body.results[0].tags.filter((t: string) => t === "@smoke").length;
    expect(smokeCount).toBe(1);
  });

  it("flushes when batch size reached", async () => {
    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      batchSize: 1,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    // Should have flushed immediately since batchSize=1
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.status).toBe("running");
    expect(body.results).toHaveLength(1);

    await reporter.onEnd(createMockFullResult());
  });
});

// ─── determineOutcome ────────────────────────────────────────

describe("determineOutcome", () => {
  it("returns skipped when expectedStatus is skipped", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: { expectedStatus: "skipped" },
      testResultOverrides: { status: "skipped" },
    });

    expect(body.results[0].outcome).toBe("skipped");
  });

  it("returns flaky when passed with retry > 0", async () => {
    const { body } = await runReporterLifecycle({
      configOverrides: {
        projects: [{ name: "default", use: { baseURL: "http://localhost:3000" }, retries: 2 }],
      },
      testCaseOverrides: {
        parent: { project: () => ({ name: "default", retries: 2 }) },
      },
      testResultOverrides: { status: "passed", retry: 1 },
    });

    expect(body.results[0].outcome).toBe("flaky");
  });

  it("returns expected when passed matches expected passed", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: { expectedStatus: "passed" },
      testResultOverrides: { status: "passed", retry: 0 },
    });

    expect(body.results[0].outcome).toBe("expected");
  });

  it("returns expected when failed matches expected failed", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: { expectedStatus: "failed" },
      testResultOverrides: { status: "failed" },
      fullResultOverrides: { status: "failed" },
    });

    expect(body.results[0].outcome).toBe("expected");
  });

  it("returns unexpected when status does not match expected", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: { expectedStatus: "passed" },
      testResultOverrides: { status: "failed" },
      fullResultOverrides: { status: "failed" },
    });

    expect(body.results[0].outcome).toBe("unexpected");
  });
});

// ─── isFinalAttempt ──────────────────────────────────────────

describe("isFinalAttempt", () => {
  const withRetries = {
    testCaseOverrides: {
      parent: { project: () => ({ name: "default", retries: 2 }) },
    },
  };

  it("passed is always final", async () => {
    const { body } = await runReporterLifecycle({
      ...withRetries,
      testResultOverrides: { status: "passed", retry: 0 },
    });

    expect(body.results[0].isFinalAttempt).toBe(true);
  });

  it("skipped is always final", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: { expectedStatus: "skipped" },
      testResultOverrides: { status: "skipped", retry: 0 },
    });

    expect(body.results[0].isFinalAttempt).toBe(true);
  });

  it("failed with retry < maxRetries is NOT final", async () => {
    const { body } = await runReporterLifecycle({
      ...withRetries,
      testResultOverrides: { status: "failed", retry: 0 },
      fullResultOverrides: { status: "failed" },
    });

    expect(body.results[0].isFinalAttempt).toBe(false);
  });

  it("failed with retry >= maxRetries IS final", async () => {
    const { body } = await runReporterLifecycle({
      ...withRetries,
      testResultOverrides: { status: "failed", retry: 2 },
      fullResultOverrides: { status: "failed" },
    });

    expect(body.results[0].isFinalAttempt).toBe(true);
  });
});

// ─── onEnd ───────────────────────────────────────────────────

describe("onEnd", () => {
  it.each([
    ["passed", "passed"],
    ["failed", "failed"],
    ["timedout", "failed"],
    ["interrupted", "interrupted"],
  ] as const)("maps FullResult status '%s' to '%s'", async (inputStatus, expectedStatus) => {
    const { body } = await runReporterLifecycle({
      fullResultOverrides: { status: inputStatus },
    });

    expect(body.status).toBe(expectedStatus);
  });

  it("is a no-op when disabled", async () => {
    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      disabled: true,
    } as any);

    await reporter.onEnd(createMockFullResult());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("prints summary output with dashboard URL", async () => {
    await runReporterLifecycle();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Dashboard:"));
  });
});

// ─── autoPassFlaky ───────────────────────────────────────────

describe("autoPassFlaky", () => {
  function mockVerdictResponse(canAutoPass: boolean) {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/verdict")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              canAutoPass,
              verdict: canAutoPass ? "flaky" : "real_failure",
              confidence: canAutoPass ? 95 : 30,
              failedTests: [
                {
                  testTitle: canAutoPass ? "flaky test" : "broken test",
                  verdict: canAutoPass ? "flaky" : "likely_real_failure",
                  reasoning: canAutoPass ? "known flaky" : "new failure",
                },
              ],
            }),
          text: () => Promise.resolve(""),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ runId: "pipeline-123" }),
        text: () => Promise.resolve(""),
      });
    });
  }

  it("calls process.exit(0) when verdict returns canAutoPass:true", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    mockVerdictResponse(true);

    await runReporterLifecycle({
      reporterOptions: { autoPassFlaky: true },
      fullResultOverrides: { status: "failed" },
    });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("does NOT call process.exit when verdict returns canAutoPass:false", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    mockVerdictResponse(false);

    await runReporterLifecycle({
      reporterOptions: { autoPassFlaky: true },
      fullResultOverrides: { status: "failed" },
    });

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("handles verdict fetch failure gracefully", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/verdict")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve("Internal Server Error"),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ runId: "pipeline-123" }),
        text: () => Promise.resolve(""),
      });
    });

    await runReporterLifecycle({
      reporterOptions: { autoPassFlaky: true },
      fullResultOverrides: { status: "failed" },
    });

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
