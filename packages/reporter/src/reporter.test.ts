import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const { uploadReportDirectory: mockUploadReportDirectory } = (await import("./s3-uploader")) as any;

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockUploadReportDirectory.mockReset();
  mockUploadReportDirectory.mockResolvedValue("reports/org/repo/run-123");
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

  it("does not check verdict when run passed", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runReporterLifecycle({
      reporterOptions: { autoPassFlaky: true },
      fullResultOverrides: { status: "passed" },
    });

    // Should only have the report call, no verdict call
    const verdictCalls = mockFetch.mock.calls.filter(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("/verdict"),
    );
    expect(verdictCalls).toHaveLength(0);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("prints verdict summary for mixed flaky and real failures", async () => {
    vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/verdict")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              canAutoPass: false,
              verdict: "real_failure",
              confidence: 50,
              failedTests: [
                { testTitle: "flaky test", verdict: "flaky", reasoning: "known flaky pattern" },
                {
                  testTitle: "broken test",
                  verdict: "likely_real_failure",
                  reasoning: "new failure",
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

    await runReporterLifecycle({
      reporterOptions: { autoPassFlaky: true },
      fullResultOverrides: { status: "failed" },
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Flakiness Analysis"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("1 failure is known flaky"));
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("1 failure needs investigation"),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"flaky test"'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"broken test"'));
  });

  it("handles verdict network error gracefully", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/verdict")) {
        return Promise.reject(new Error("Network error"));
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

// ─── CI detection — additional providers ─────────────────────

describe("CI detection — additional providers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    const ciVars = [
      "GITHUB_ACTIONS",
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

  it("detects GitLab CI environment", async () => {
    process.env.GITLAB_CI = "true";
    process.env.CI_COMMIT_REF_NAME = "feature-branch";
    process.env.CI_COMMIT_SHA = "gitlab-sha-123";
    process.env.CI_COMMIT_MESSAGE = "fix: stuff";
    process.env.CI_JOB_URL = "https://gitlab.com/org/repo/-/jobs/999";
    process.env.CI_PIPELINE_ID = "100";
    process.env.CI_JOB_ID = "999";

    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBe("feature-branch");
    expect(body.metadata.commitSha).toBe("gitlab-sha-123");
    expect(body.metadata.commitMessage).toBe("fix: stuff");
    expect(body.metadata.ciJobUrl).toBe("https://gitlab.com/org/repo/-/jobs/999");
    expect(body.runId).toBe("gitlab-100-999");
  });

  it("detects CircleCI environment", async () => {
    process.env.CIRCLECI = "true";
    process.env.CIRCLE_BRANCH = "develop";
    process.env.CIRCLE_SHA1 = "circle-sha-456";
    process.env.CIRCLE_BUILD_URL = "https://circleci.com/gh/org/repo/42";
    process.env.CIRCLE_WORKFLOW_ID = "wf-1";
    process.env.CIRCLE_BUILD_NUM = "42";

    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBe("develop");
    expect(body.metadata.commitSha).toBe("circle-sha-456");
    expect(body.metadata.ciJobUrl).toBe("https://circleci.com/gh/org/repo/42");
    expect(body.runId).toBe("circle-wf-1-42");
  });

  it("detects Jenkins environment", async () => {
    process.env.JENKINS_URL = "https://jenkins.example.com/";
    process.env.GIT_BRANCH = "main";
    process.env.GIT_COMMIT = "jenkins-sha-789";
    process.env.BUILD_URL = "https://jenkins.example.com/job/build/5";
    process.env.BUILD_ID = "5";

    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBe("main");
    expect(body.metadata.commitSha).toBe("jenkins-sha-789");
    expect(body.metadata.ciJobUrl).toBe("https://jenkins.example.com/job/build/5");
    expect(body.runId).toBe("jenkins-5");
  });

  it("detects Azure DevOps environment", async () => {
    process.env.TF_BUILD = "True";
    process.env.BUILD_SOURCEBRANCH = "refs/heads/release/v2";
    process.env.BUILD_SOURCEVERSION = "azure-sha-abc";
    process.env.BUILD_SOURCEVERSIONMESSAGE = "chore: release";
    process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = "https://dev.azure.com/org/";
    process.env.SYSTEM_TEAMPROJECT = "my-project";
    process.env.BUILD_BUILDID = "77";

    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBe("release/v2");
    expect(body.metadata.commitSha).toBe("azure-sha-abc");
    expect(body.metadata.ciJobUrl).toBe(
      "https://dev.azure.com/org/my-project/_build/results?buildId=77",
    );
    expect(body.runId).toBe("azure-77");
  });

  it("detects Codefresh environment", async () => {
    process.env.CF_BUILD_URL = "https://g.codefresh.io/build/abc123";
    process.env.CF_BRANCH = "hotfix";
    process.env.CF_REVISION = "cf-sha-def";
    process.env.CF_COMMIT_MESSAGE = "fix: urgent";
    process.env.CF_BUILD_ID = "abc123";

    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBe("hotfix");
    expect(body.metadata.commitSha).toBe("cf-sha-def");
    expect(body.metadata.ciJobUrl).toBe("https://g.codefresh.io/build/abc123");
    expect(body.runId).toBe("codefresh-abc123");
  });

  it("detects generic CI environment", async () => {
    process.env.CI = "true";
    process.env.BRANCH_NAME = "generic-branch";
    process.env.GIT_COMMIT = "generic-sha";

    const { body } = await runReporterLifecycle();

    expect(body.metadata.branch).toBe("generic-branch");
    expect(body.metadata.commitSha).toBe("generic-sha");
    expect(body.runId).toMatch(/^local-/); // generic CI has no runId
  });

  it("uses option overrides over CI-detected values", async () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REF_NAME = "ci-branch";
    process.env.GITHUB_SHA = "ci-sha";

    const { body } = await runReporterLifecycle({
      reporterOptions: {
        branch: "override-branch",
        commitSha: "override-sha",
        ciJobUrl: "https://custom.com/job/1",
      },
    });

    expect(body.metadata.branch).toBe("override-branch");
    expect(body.metadata.commitSha).toBe("override-sha");
    expect(body.metadata.ciJobUrl).toBe("https://custom.com/job/1");
  });
});

// ─── skippedByDashboard ─────────────────────────────────────

describe("skippedByDashboard", () => {
  it("sets skippedByDashboard when annotation matches", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: {
        expectedStatus: "skipped",
        annotations: [{ type: "skip", description: "[dashboard] Disabled by skip rule #42" }],
      },
      testResultOverrides: { status: "skipped" },
    });

    expect(body.results[0].skippedByDashboard).toBe(true);
  });

  it("does not set skippedByDashboard for non-dashboard skips", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: {
        expectedStatus: "skipped",
        annotations: [{ type: "skip", description: "Skipping because of known issue" }],
      },
      testResultOverrides: { status: "skipped" },
    });

    expect(body.results[0].skippedByDashboard).toBeUndefined();
  });

  it("does not set skippedByDashboard for non-skip annotations", async () => {
    const { body } = await runReporterLifecycle({
      testCaseOverrides: {
        annotations: [{ type: "fixme", description: "[dashboard] should fix this" }],
      },
    });

    expect(body.results[0].skippedByDashboard).toBeUndefined();
  });
});

// ─── flushResults / sendResults ─────────────────────────────

describe("flushResults / sendResults", () => {
  it("re-queues results on failure when failSilently=true", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ runId: "pipeline-123" }),
        text: () => Promise.resolve(""),
      });
    });

    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      batchSize: 1,
      failSilently: true,
      debug: true,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    // flushResults is fire-and-forget from onTestEnd — wait for the async catch to re-queue
    await new Promise((r) => setTimeout(r, 10));

    // First flush failed (batchSize=1 triggered it), results re-queued
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // onEnd sends remaining results (the re-queued ones)
    await reporter.onEnd(createMockFullResult());

    // Second call succeeds — the re-queued result is sent
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const finalBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(finalBody.results).toHaveLength(1);
    expect(finalBody.status).toBe("passed");
  });

  it("throws on failure when failSilently=false", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      failSilently: false,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    await expect(reporter.onEnd(createMockFullResult())).rejects.toThrow("Connection refused");
  });

  it("throws on non-OK API response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      failSilently: false,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    await expect(reporter.onEnd(createMockFullResult())).rejects.toThrow("API returned 500");
  });

  it("includes shard info in metadata when config has shard", async () => {
    const { body } = await runReporterLifecycle({
      configOverrides: {
        shard: { current: 2, total: 4 },
      },
    });

    expect(body.metadata.shardCurrent).toBe(2);
    expect(body.metadata.shardTotal).toBe(4);
  });

  it("sets endTime only on final send (not during running flushes)", async () => {
    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      batchSize: 1,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    // First flush (running) should not have endTime
    const runningBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(runningBody.endTime).toBeUndefined();

    await reporter.onEnd(createMockFullResult());

    // Final send should have endTime
    const finalBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(finalBody.endTime).toBeDefined();
  });

  it("sends final report with no results when all results flushed mid-run", async () => {
    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      batchSize: 1,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    // batchSize=1 flushes immediately
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await reporter.onEnd(createMockFullResult());

    // Final send with empty results
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const finalBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(finalBody.results).toHaveLength(0);
    expect(finalBody.status).toBe("passed");
  });
});

// ─── printSummary ───────────────────────────────────────────

describe("printSummary", () => {
  it("prints dashboard URL with pipeline ID", async () => {
    await runReporterLifecycle();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:3000/dashboard/pipelines?pipelineId=pipeline-123"),
    );
  });

  it("prints branch and short SHA when available", async () => {
    await runReporterLifecycle({
      reporterOptions: { branch: "main", commitSha: "abc123def456789" },
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Branch:"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("main"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("abc123d"));
  });

  it("prints 'Uploaded' when reportPath is present", async () => {
    await runReporterLifecycle({
      reporterOptions: { s3: { bucket: "my-bucket", region: "us-east-1" } },
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Report:"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Uploaded"));
  });

  it("omits branch line when no branch available", async () => {
    await runReporterLifecycle();

    const branchCalls = (console.log as any).mock.calls.filter(
      (args: any[]) => typeof args[0] === "string" && args[0].includes("Branch:"),
    );
    expect(branchCalls).toHaveLength(0);
  });
});

// ─── S3 upload in onEnd ─────────────────────────────────────

describe("S3 upload in onEnd", () => {
  it("uploads report and includes reportPath in final send", async () => {
    const { body } = await runReporterLifecycle({
      reporterOptions: { s3: { bucket: "my-bucket", region: "us-east-1" } },
    });

    expect(mockUploadReportDirectory).toHaveBeenCalledWith(
      { bucket: "my-bucket", region: "us-east-1" },
      "org/repo",
      expect.any(String),
      false,
    );
    expect(body.metadata.reportPath).toBe("reports/org/repo/run-123");
  });

  it("continues when S3 upload fails and failSilently=true", async () => {
    mockUploadReportDirectory.mockRejectedValue(new Error("S3 bucket not found"));

    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      s3: { bucket: "bad-bucket", region: "us-east-1" },
      failSilently: true,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);
    await reporter.onEnd(createMockFullResult());

    // Should still send results (without reportPath)
    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.metadata.reportPath).toBeUndefined();
  });

  it("throws when S3 upload fails and failSilently=false", async () => {
    mockUploadReportDirectory.mockRejectedValue(new Error("S3 bucket not found"));

    const reporter = new TestManagerReporter({
      ...DEFAULT_OPTIONS,
      s3: { bucket: "bad-bucket", region: "us-east-1" },
      failSilently: false,
    });

    reporter.onBegin(createMockFullConfig(), createMockSuite());
    reporter.onTestEnd(createMockTestCase() as any, createMockTestResult() as any);

    await expect(reporter.onEnd(createMockFullResult())).rejects.toThrow("S3 bucket not found");
  });
});
