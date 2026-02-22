import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectCIEnvironment, generateRunId } from "./ci-detect";

const CI_VARS = [
  "GITHUB_ACTIONS",
  "GITHUB_REF_NAME",
  "GITHUB_HEAD_REF",
  "GITHUB_SHA",
  "GITHUB_SERVER_URL",
  "GITHUB_REPOSITORY",
  "GITHUB_RUN_ID",
  "GITHUB_RUN_ATTEMPT",
  "GITLAB_CI",
  "CI_COMMIT_REF_NAME",
  "CI_COMMIT_SHA",
  "CI_COMMIT_MESSAGE",
  "CI_JOB_URL",
  "CI_PIPELINE_ID",
  "CI_JOB_ID",
  "CIRCLECI",
  "CIRCLE_BRANCH",
  "CIRCLE_SHA1",
  "CIRCLE_BUILD_URL",
  "CIRCLE_WORKFLOW_ID",
  "CIRCLE_BUILD_NUM",
  "JENKINS_URL",
  "GIT_BRANCH",
  "GIT_COMMIT",
  "BUILD_URL",
  "BUILD_ID",
  "TF_BUILD",
  "BUILD_SOURCEBRANCH",
  "BUILD_SOURCEVERSION",
  "BUILD_SOURCEVERSIONMESSAGE",
  "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI",
  "SYSTEM_TEAMPROJECT",
  "BUILD_BUILDID",
  "CF_BUILD_URL",
  "CF_BRANCH",
  "CF_REVISION",
  "CF_COMMIT_MESSAGE",
  "CF_BUILD_ID",
  "CI",
  "BRANCH_NAME",
  "COMMIT_SHA",
];

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  for (const v of CI_VARS) delete process.env[v];
});

afterEach(() => {
  process.env = originalEnv;
});

describe("detectCIEnvironment", () => {
  it("detects GitHub Actions", () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REF_NAME = "main";
    process.env.GITHUB_SHA = "abc123";
    process.env.GITHUB_SERVER_URL = "https://github.com";
    process.env.GITHUB_REPOSITORY = "org/repo";
    process.env.GITHUB_RUN_ID = "12345";
    process.env.GITHUB_RUN_ATTEMPT = "1";

    const result = detectCIEnvironment();

    expect(result.isCI).toBe(true);
    expect(result.branch).toBe("main");
    expect(result.commitSha).toBe("abc123");
    expect(result.jobUrl).toBe("https://github.com/org/repo/actions/runs/12345");
    expect(result.runId).toBe("github-12345-1");
  });

  it("uses GITHUB_HEAD_REF when GITHUB_REF_NAME not set", () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_HEAD_REF = "feature-branch";

    const result = detectCIEnvironment();

    expect(result.branch).toBe("feature-branch");
  });

  it("detects GitLab CI", () => {
    process.env.GITLAB_CI = "true";
    process.env.CI_COMMIT_REF_NAME = "feature-branch";
    process.env.CI_COMMIT_SHA = "gitlab-sha";
    process.env.CI_COMMIT_MESSAGE = "fix: stuff";
    process.env.CI_JOB_URL = "https://gitlab.com/org/repo/-/jobs/999";
    process.env.CI_PIPELINE_ID = "100";
    process.env.CI_JOB_ID = "999";

    const result = detectCIEnvironment();

    expect(result.isCI).toBe(true);
    expect(result.branch).toBe("feature-branch");
    expect(result.commitSha).toBe("gitlab-sha");
    expect(result.commitMessage).toBe("fix: stuff");
    expect(result.jobUrl).toBe("https://gitlab.com/org/repo/-/jobs/999");
    expect(result.runId).toBe("gitlab-100-999");
  });

  it("detects CircleCI", () => {
    process.env.CIRCLECI = "true";
    process.env.CIRCLE_BRANCH = "develop";
    process.env.CIRCLE_SHA1 = "circle-sha";
    process.env.CIRCLE_BUILD_URL = "https://circleci.com/gh/org/repo/42";
    process.env.CIRCLE_WORKFLOW_ID = "wf-1";
    process.env.CIRCLE_BUILD_NUM = "42";

    const result = detectCIEnvironment();

    expect(result.isCI).toBe(true);
    expect(result.branch).toBe("develop");
    expect(result.commitSha).toBe("circle-sha");
    expect(result.jobUrl).toBe("https://circleci.com/gh/org/repo/42");
    expect(result.runId).toBe("circle-wf-1-42");
  });

  it("detects Jenkins", () => {
    process.env.JENKINS_URL = "https://jenkins.example.com/";
    process.env.GIT_BRANCH = "main";
    process.env.GIT_COMMIT = "jenkins-sha";
    process.env.BUILD_URL = "https://jenkins.example.com/job/build/5";
    process.env.BUILD_ID = "5";

    const result = detectCIEnvironment();

    expect(result.isCI).toBe(true);
    expect(result.branch).toBe("main");
    expect(result.commitSha).toBe("jenkins-sha");
    expect(result.jobUrl).toBe("https://jenkins.example.com/job/build/5");
    expect(result.runId).toBe("jenkins-5");
  });

  it("uses BRANCH_NAME fallback for Jenkins when GIT_BRANCH not set", () => {
    process.env.JENKINS_URL = "https://jenkins.example.com/";
    process.env.BRANCH_NAME = "release-1";

    const result = detectCIEnvironment();

    expect(result.branch).toBe("release-1");
  });

  it("detects Azure DevOps", () => {
    process.env.TF_BUILD = "True";
    process.env.BUILD_SOURCEBRANCH = "refs/heads/release/v2";
    process.env.BUILD_SOURCEVERSION = "azure-sha";
    process.env.BUILD_SOURCEVERSIONMESSAGE = "chore: release";
    process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI = "https://dev.azure.com/org/";
    process.env.SYSTEM_TEAMPROJECT = "my-project";
    process.env.BUILD_BUILDID = "77";

    const result = detectCIEnvironment();

    expect(result.isCI).toBe(true);
    expect(result.branch).toBe("release/v2");
    expect(result.commitSha).toBe("azure-sha");
    expect(result.commitMessage).toBe("chore: release");
    expect(result.jobUrl).toBe("https://dev.azure.com/org/my-project/_build/results?buildId=77");
    expect(result.runId).toBe("azure-77");
  });

  it("detects Codefresh", () => {
    process.env.CF_BUILD_URL = "https://g.codefresh.io/build/abc123";
    process.env.CF_BRANCH = "hotfix";
    process.env.CF_REVISION = "cf-sha";
    process.env.CF_COMMIT_MESSAGE = "fix: urgent";
    process.env.CF_BUILD_ID = "abc123";

    const result = detectCIEnvironment();

    expect(result.isCI).toBe(true);
    expect(result.branch).toBe("hotfix");
    expect(result.commitSha).toBe("cf-sha");
    expect(result.commitMessage).toBe("fix: urgent");
    expect(result.jobUrl).toBe("https://g.codefresh.io/build/abc123");
    expect(result.runId).toBe("codefresh-abc123");
  });

  it("detects generic CI", () => {
    process.env.CI = "true";
    process.env.BRANCH_NAME = "generic-branch";
    process.env.GIT_COMMIT = "generic-sha";

    const result = detectCIEnvironment();

    expect(result.isCI).toBe(true);
    expect(result.branch).toBe("generic-branch");
    expect(result.commitSha).toBe("generic-sha");
    expect(result.runId).toBeUndefined();
  });

  it("uses COMMIT_SHA fallback for generic CI", () => {
    process.env.CI = "true";
    process.env.COMMIT_SHA = "commit-sha-fallback";

    const result = detectCIEnvironment();

    expect(result.commitSha).toBe("commit-sha-fallback");
  });

  it("returns local environment when no CI vars set", () => {
    const result = detectCIEnvironment();

    expect(result.isCI).toBe(false);
    expect(result.branch).toBeUndefined();
    expect(result.commitSha).toBeUndefined();
    expect(result.runId).toBeUndefined();
  });
});

describe("generateRunId", () => {
  it("generates ID with local- prefix", () => {
    const id = generateRunId();
    expect(id).toMatch(/^local-\d+-[a-z0-9]+$/);
  });

  it("generates unique IDs", () => {
    const id1 = generateRunId();
    const id2 = generateRunId();
    expect(id1).not.toBe(id2);
  });
});
