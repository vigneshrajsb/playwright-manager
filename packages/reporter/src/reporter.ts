import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
import type {
  TestManagerReporterOptions,
  TestResultData,
  RunMetadata,
  ReportPayload,
  CIEnvironment,
} from "./types";

export class TestManagerReporter implements Reporter {
  private options: Required<TestManagerReporterOptions>;
  private results: TestResultData[] = [];
  private runId: string;
  private startTime: string = "";
  private flushTimer: NodeJS.Timeout | null = null;
  private config: FullConfig | null = null;
  private ciEnv: CIEnvironment;

  constructor(options: TestManagerReporterOptions) {
    this.options = {
      apiUrl: options.apiUrl,
      batchSize: options.batchSize ?? 50,
      flushInterval: options.flushInterval ?? 5000,
      failSilently: options.failSilently ?? true,
      runId: options.runId ?? "",
      debug: options.debug ?? false,
    };

    this.ciEnv = this.detectCIEnvironment();
    this.runId = this.options.runId || this.ciEnv.runId || this.generateRunId();
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log("[TestManagerReporter]", ...args);
    }
  }

  private detectCIEnvironment(): CIEnvironment {
    const env = process.env;

    // GitHub Actions
    if (env.GITHUB_ACTIONS) {
      return {
        isCI: true,
        branch: env.GITHUB_REF_NAME || env.GITHUB_HEAD_REF,
        commitSha: env.GITHUB_SHA,
        commitMessage: undefined, // Not available in env
        jobUrl: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
        runId: `github-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`,
      };
    }

    // GitLab CI
    if (env.GITLAB_CI) {
      return {
        isCI: true,
        branch: env.CI_COMMIT_REF_NAME,
        commitSha: env.CI_COMMIT_SHA,
        commitMessage: env.CI_COMMIT_MESSAGE,
        jobUrl: env.CI_JOB_URL,
        runId: `gitlab-${env.CI_PIPELINE_ID}-${env.CI_JOB_ID}`,
      };
    }

    // CircleCI
    if (env.CIRCLECI) {
      return {
        isCI: true,
        branch: env.CIRCLE_BRANCH,
        commitSha: env.CIRCLE_SHA1,
        commitMessage: undefined,
        jobUrl: env.CIRCLE_BUILD_URL,
        runId: `circle-${env.CIRCLE_WORKFLOW_ID}-${env.CIRCLE_BUILD_NUM}`,
      };
    }

    // Jenkins
    if (env.JENKINS_URL) {
      return {
        isCI: true,
        branch: env.GIT_BRANCH || env.BRANCH_NAME,
        commitSha: env.GIT_COMMIT,
        commitMessage: undefined,
        jobUrl: env.BUILD_URL,
        runId: `jenkins-${env.BUILD_ID}`,
      };
    }

    // Azure DevOps
    if (env.TF_BUILD) {
      return {
        isCI: true,
        branch: env.BUILD_SOURCEBRANCH?.replace("refs/heads/", ""),
        commitSha: env.BUILD_SOURCEVERSION,
        commitMessage: env.BUILD_SOURCEVERSIONMESSAGE,
        jobUrl: `${env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI}${env.SYSTEM_TEAMPROJECT}/_build/results?buildId=${env.BUILD_BUILDID}`,
        runId: `azure-${env.BUILD_BUILDID}`,
      };
    }

    // Generic CI detection
    if (env.CI) {
      return {
        isCI: true,
        branch: env.BRANCH_NAME || env.GIT_BRANCH,
        commitSha: env.GIT_COMMIT || env.COMMIT_SHA,
        commitMessage: undefined,
        jobUrl: undefined,
        runId: undefined,
      };
    }

    // Local development
    return {
      isCI: false,
      branch: undefined,
      commitSha: undefined,
      commitMessage: undefined,
      jobUrl: undefined,
      runId: undefined,
    };
  }

  private generateRunId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `local-${timestamp}-${random}`;
  }

  private getRelativePath(absolutePath: string): string {
    const cwd = process.cwd();
    if (absolutePath.startsWith(cwd)) {
      return absolutePath.slice(cwd.length + 1);
    }
    return absolutePath;
  }

  private extractTags(test: TestCase): string[] {
    const tags: string[] = [];

    // Extract tags from annotations
    for (const annotation of test.annotations) {
      if (annotation.type === "tag" && annotation.description) {
        tags.push(annotation.description);
      }
    }

    // Extract @tag from title
    const tagMatches = test.title.match(/@[\w-]+/g);
    if (tagMatches) {
      tags.push(...tagMatches.map((t) => t.slice(1)));
    }

    return [...new Set(tags)];
  }

  private determineOutcome(
    status: TestResult["status"],
    expectedStatus: TestCase["expectedStatus"],
    retry: number,
    maxRetries: number
  ): TestResultData["outcome"] {
    // Check if test was expected to be skipped
    if (expectedStatus === "skipped") return "skipped";

    // Check if result matches expectation
    const isExpected =
      (status === "passed" && expectedStatus === "passed") ||
      (status === "failed" && expectedStatus === "failed");

    if (isExpected) return "expected";

    // Flaky: failed on retries but passed eventually
    if (status === "passed" && retry > 0) return "flaky";

    return "unexpected";
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.startTime = new Date().toISOString();
    this.log("Test run started:", this.runId);

    // Start flush interval timer
    if (this.options.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        if (this.results.length > 0) {
          this.flushResults();
        }
      }, this.options.flushInterval);
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project();
    const maxRetries = project?.retries ?? 0;

    // Map status - if test was skipped, report as skipped
    const status: TestResultData["status"] =
      test.expectedStatus === "skipped" ? "skipped" : result.status;

    const resultData: TestResultData = {
      testId: test.id,
      filePath: this.getRelativePath(test.location.file),
      title: test.title,
      titlePath: test.titlePath(),
      projectName: project?.name ?? "default",
      tags: this.extractTags(test),
      location: {
        file: this.getRelativePath(test.location.file),
        line: test.location.line,
        column: test.location.column,
      },
      status,
      expectedStatus: test.expectedStatus,
      duration: result.duration,
      retry: result.retry,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      outcome: this.determineOutcome(
        result.status,
        test.expectedStatus,
        result.retry,
        maxRetries
      ),
      startTime: new Date(result.startTime).toISOString(),
    };

    // Add error if present
    if (result.error) {
      resultData.error = {
        message: result.error.message ?? "Unknown error",
        stack: result.error.stack,
      };
    }

    // Add attachments (metadata only, not content)
    if (result.attachments.length > 0) {
      resultData.attachments = result.attachments.map((a) => ({
        name: a.name,
        contentType: a.contentType,
        path: a.path,
      }));
    }

    // Add annotations
    if (test.annotations.length > 0) {
      resultData.annotations = test.annotations.map((a) => ({
        type: a.type,
        description: a.description,
      }));
    }

    this.results.push(resultData);
    this.log(`Test ended: ${test.title} [${result.status}]`);

    // Flush if batch size reached
    if (this.results.length >= this.options.batchSize) {
      this.flushResults();
    }
  }

  private async flushResults(): Promise<void> {
    if (this.results.length === 0) return;

    const resultsToSend = [...this.results];
    this.results = [];

    this.log(`Flushing ${resultsToSend.length} results...`);

    try {
      await this.sendResults(resultsToSend, "running");
    } catch (error) {
      if (!this.options.failSilently) {
        throw error;
      }
      console.error("[TestManagerReporter] Failed to flush results:", error);
      // Re-add results to queue for next flush attempt
      this.results = [...resultsToSend, ...this.results];
    }
  }

  private async sendResults(
    results: TestResultData[],
    status: ReportPayload["status"]
  ): Promise<void> {
    const metadata: RunMetadata = {
      branch: this.ciEnv.branch,
      commitSha: this.ciEnv.commitSha,
      commitMessage: this.ciEnv.commitMessage,
      ciJobUrl: this.ciEnv.jobUrl,
      playwrightVersion: this.config?.version ?? "unknown",
      workers: this.config?.workers ?? 1,
    };

    // Add shard info if present
    if (this.config?.shard) {
      metadata.shardCurrent = this.config.shard.current;
      metadata.shardTotal = this.config.shard.total;
    }

    const payload: ReportPayload = {
      runId: this.runId,
      metadata,
      startTime: this.startTime,
      status,
      results,
    };

    if (status !== "running") {
      payload.endTime = new Date().toISOString();
    }

    const response = await fetch(`${this.options.apiUrl}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API returned ${response.status}: ${text}`);
    }

    this.log("Results sent successfully");
  }

  async onEnd(result: FullResult): Promise<void> {
    // Clear flush interval
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Send remaining results with final status
    const finalStatus = result.status === "passed" ? "passed" :
                        result.status === "failed" ? "failed" :
                        result.status === "interrupted" ? "interrupted" : "failed";

    this.log(`Test run ended with status: ${finalStatus}`);

    try {
      // Always send final report, even if no remaining results
      await this.sendResults(this.results, finalStatus);
      this.results = [];
    } catch (error) {
      if (!this.options.failSilently) {
        throw error;
      }
      console.error("[TestManagerReporter] Failed to send final report:", error);
    }
  }
}
