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
  S3ReportConfig,
} from "./types";
import { uploadReportDirectory } from "./s3-uploader";

// Options type with most fields required but branch/commitSha/ciJobUrl/s3 optional
type ResolvedOptions = Required<Omit<TestManagerReporterOptions, 'branch' | 'commitSha' | 'ciJobUrl' | 's3' | 'autoPassFlaky' | 'autoPassThreshold'>> & {
  branch?: string;
  commitSha?: string;
  ciJobUrl?: string;
  s3?: S3ReportConfig;
  autoPassFlaky: boolean;
  autoPassThreshold: number;
};

export class TestManagerReporter implements Reporter {
  private options: ResolvedOptions;
  private results: TestResultData[] = [];
  private runId: string = "";
  private startTime: string = "";
  private flushTimer: NodeJS.Timeout | null = null;
  private config: FullConfig | null = null;
  private ciEnv: CIEnvironment = { isCI: false };
  private isDisabled: boolean = false;
  private baseUrl: string | undefined = undefined;

  constructor(options: TestManagerReporterOptions) {
    // Check if disabled first
    if (options.disabled) {
      this.isDisabled = true;
      this.options = options as ResolvedOptions;
      return;
    }

    if (!options.repository) {
      throw new Error(
        "[TestManagerReporter] repository option is required. Example: { repository: 'org/repo' }"
      );
    }

    this.options = {
      apiUrl: options.apiUrl,
      repository: options.repository,
      disabled: false,
      branch: options.branch,
      commitSha: options.commitSha,
      ciJobUrl: options.ciJobUrl,
      batchSize: options.batchSize ?? 50,
      flushInterval: options.flushInterval ?? 5000,
      failSilently: options.failSilently ?? true,
      runId: options.runId ?? "",
      debug: options.debug ?? false,
      s3: options.s3,
      autoPassFlaky: options.autoPassFlaky ?? false,
      autoPassThreshold: options.autoPassThreshold ?? 90,
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

    // Codefresh
    if (env.CF_BUILD_URL) {
      return {
        isCI: true,
        branch: env.CF_BRANCH,
        commitSha: env.CF_REVISION,
        commitMessage: env.CF_COMMIT_MESSAGE,
        jobUrl: env.CF_BUILD_URL,
        runId: `codefresh-${env.CF_BUILD_ID}`,
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

    // Get tags from test.tags property (Playwright 1.42+)
    // The property exists but isn't in older type definitions
    if ("tags" in test && Array.isArray((test as any).tags)) {
      tags.push(...(test as any).tags);
    }

    // Extract tags from annotations
    for (const annotation of test.annotations) {
      if (annotation.type === "tag" && annotation.description) {
        tags.push(annotation.description);
      }
    }

    // Extract @tag from title - keep the @ prefix as-is
    const tagMatches = test.title.match(/@[\w-]+/g);
    if (tagMatches) {
      tags.push(...tagMatches);
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

    // Flaky: passed but required retries (must check BEFORE expected!)
    if (status === "passed" && retry > 0) return "flaky";

    // Check if result matches expectation
    const isExpected =
      (status === "passed" && expectedStatus === "passed") ||
      (status === "failed" && expectedStatus === "failed");

    if (isExpected) return "expected";

    return "unexpected";
  }

  private isFinalAttempt(
    status: TestResult["status"],
    retry: number,
    maxRetries: number
  ): boolean {
    // Passed tests are always final (no retry needed)
    if (status === "passed") return true;

    // Skipped and interrupted are final
    if (status === "skipped" || status === "interrupted") return true;

    // Failed/timedOut: final only if retries exhausted
    return retry >= maxRetries;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    if (this.isDisabled) return;

    this.config = config;
    this.startTime = new Date().toISOString();

    // Extract baseURL from first project with a defined baseURL
    this.baseUrl = config.projects.find((p) => p.use?.baseURL)?.use?.baseURL;

    this.log("Test run started", {
      runId: this.runId,
      repository: this.options.repository,
      apiUrl: this.options.apiUrl,
      baseUrl: this.baseUrl,
      branch: this.options.branch || this.ciEnv.branch,
      isCI: this.ciEnv.isCI,
    });

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
    if (this.isDisabled) return;

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
      isFinalAttempt: this.isFinalAttempt(result.status, result.retry, maxRetries),
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      outcome: this.determineOutcome(
        result.status,
        test.expectedStatus,
        result.retry,
        maxRetries
      ),
      startTime: new Date(result.startTime).toISOString(),
      baseUrl: this.baseUrl,
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
    this.log("Test ended", {
      testId: test.id,
      title: test.title,
      status: result.status,
      duration: result.duration,
      retry: result.retry,
      project: project?.name,
    });

    // Flush if batch size reached
    if (this.results.length >= this.options.batchSize) {
      this.flushResults();
    }
  }

  private async flushResults(): Promise<void> {
    if (this.results.length === 0) return;

    const resultsToSend = [...this.results];
    this.results = [];

    this.log("Flushing results", { count: resultsToSend.length, runId: this.runId });

    try {
      await this.sendResults(resultsToSend, "running");
    } catch (error) {
      if (!this.options.failSilently) {
        throw error;
      }
      if (this.options.debug) {
        console.error(
          "[TestManagerReporter] Failed to flush results",
          { runId: this.runId, resultCount: resultsToSend.length, apiUrl: this.options.apiUrl },
          error
        );
      }
      // Re-add results to queue for next flush attempt
      this.results = [...resultsToSend, ...this.results];
    }
  }

  private async sendResults(
    results: TestResultData[],
    status: ReportPayload["status"],
    reportPath?: string
  ): Promise<{ runId?: string }> {
    const metadata: RunMetadata = {
      repository: this.options.repository,
      branch: this.options.branch || this.ciEnv.branch,
      commitSha: this.options.commitSha || this.ciEnv.commitSha,
      commitMessage: this.ciEnv.commitMessage,
      ciJobUrl: this.options.ciJobUrl || this.ciEnv.jobUrl,
      baseUrl: this.baseUrl,
      playwrightVersion: this.config?.version ?? "unknown",
      workers: this.config?.workers ?? 1,
      reportPath,
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

    const data = await response.json() as { runId?: string };
    this.log("Results sent successfully", { runId: this.runId, count: results.length });
    return { runId: data.runId };
  }

  async onEnd(result: FullResult): Promise<void> {
    if (this.isDisabled) return;

    // Clear flush interval
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Send remaining results with final status
    const finalStatus = this.mapFinalStatus(result.status);

    this.log("Test run ended", { runId: this.runId, status: finalStatus, remainingResults: this.results.length });

    // Upload HTML report to S3 if configured
    let reportPath: string | undefined;
    if (this.options.s3) {
      try {
        this.log("Uploading HTML report to S3...");
        reportPath = await uploadReportDirectory(
          this.options.s3,
          this.options.repository,
          this.runId,
          this.options.debug
        );
        this.log("HTML report uploaded", { reportPath });
      } catch (error) {
        if (!this.options.failSilently) {
          throw error;
        }
        if (this.options.debug) {
          console.error(
            "[TestManagerReporter] Failed to upload HTML report",
            { runId: this.runId, error }
          );
        }
      }
    }

    try {
      // Always send final report, even if no remaining results
      const response = await this.sendResults(this.results, finalStatus, reportPath);
      this.results = [];

      // Print dashboard link
      if (response.runId) {
        this.printSummary(response.runId, reportPath);
      }

      // Check for auto-pass if enabled and run failed
      if (this.options.autoPassFlaky && result.status === "failed" && response.runId) {
        await this.checkAutoPass(response.runId);
      }
    } catch (error) {
      if (!this.options.failSilently) {
        throw error;
      }
      if (this.options.debug) {
        console.error(
          "[TestManagerReporter] Failed to send final report",
          { runId: this.runId, status: finalStatus, resultCount: this.results.length, apiUrl: this.options.apiUrl },
          error
        );
      }
    }
  }

  private mapFinalStatus(status: FullResult["status"]): ReportPayload["status"] {
    switch (status) {
      case "passed":
        return "passed";
      case "failed":
        return "failed";
      case "interrupted":
        return "interrupted";
      case "timedout":
        return "failed";
    }
  }

  private printSummary(pipelineId: string, reportPath?: string): void {
    const branch = this.options.branch || this.ciEnv.branch;
    const commitSha = this.options.commitSha || this.ciEnv.commitSha;
    const shortSha = commitSha ? ` (${commitSha.slice(0, 7)})` : "";
    const dashboardUrl = `${this.options.apiUrl}/dashboard/pipelines?pipelineId=${pipelineId}`;

    console.log("");
    console.log("[Playwright Manager] Results uploaded successfully");
    if (branch) {
      console.log(`  Branch:     ${branch}${shortSha}`);
    }
    if (reportPath) {
      console.log(`  Report:     Uploaded`);
    }
    console.log(`  Dashboard:  ${dashboardUrl}`);
    console.log("");
  }

  private async checkAutoPass(pipelineId: string): Promise<void> {
    try {
      this.log("Checking flakiness verdict for auto-pass...");

      const response = await fetch(
        `${this.options.apiUrl}/api/pipelines/${pipelineId}/verdict`
      );

      if (!response.ok) {
        this.log("Failed to fetch verdict, not auto-passing");
        return;
      }

      const verdict = await response.json() as {
        canAutoPass?: boolean;
        verdict?: string;
        confidence?: number;
        failedTests?: Array<{
          testTitle: string;
          verdict: string;
          reasoning: string;
        }>;
      };

      if (verdict.canAutoPass) {
        this.printVerdictSummary(verdict);
        console.log("");
        console.log("[Playwright Manager] Exiting with code 0 - all failures are known flaky");
        console.log("");
        process.exit(0);
      } else {
        this.log("Verdict does not allow auto-pass", {
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          threshold: this.options.autoPassThreshold,
        });

        // Still print the verdict for information
        if (verdict.failedTests?.length) {
          this.printVerdictSummary(verdict);
        }
      }
    } catch (error) {
      this.log("Error checking auto-pass verdict", error);
    }
  }

  private printVerdictSummary(verdict: {
    failedTests?: Array<{
      testTitle: string;
      verdict: string;
      reasoning: string;
    }>;
  }): void {
    console.log("");
    console.log("[Playwright Manager] Flakiness Analysis");

    const flakyTests = verdict.failedTests?.filter((t) => t.verdict === "flaky") || [];
    const realTests = verdict.failedTests?.filter((t) => t.verdict === "likely_real_failure") || [];

    if (flakyTests.length > 0) {
      console.log(`  ✓ ${flakyTests.length} failure${flakyTests.length > 1 ? "s are" : " is"} known flaky:`);
      for (const test of flakyTests) {
        console.log(`    • "${test.testTitle}" - ${test.reasoning}`);
      }
    }

    if (realTests.length > 0) {
      console.log(`  ✗ ${realTests.length} failure${realTests.length > 1 ? "s need" : " needs"} investigation:`);
      for (const test of realTests) {
        console.log(`    • "${test.testTitle}" - ${test.reasoning}`);
      }
    }
  }
}
