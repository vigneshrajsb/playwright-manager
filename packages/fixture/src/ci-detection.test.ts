import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectCIContext } from "./ci-detection";

describe("detectCIContext", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    const ciVars = [
      "GITHUB_ACTIONS",
      "GITHUB_REF_NAME",
      "GITHUB_HEAD_REF",
      "GITLAB_CI",
      "CI_COMMIT_REF_NAME",
      "CIRCLECI",
      "CIRCLE_BRANCH",
      "JENKINS_URL",
      "GIT_BRANCH",
      "BRANCH_NAME",
      "TF_BUILD",
      "BUILD_SOURCEBRANCH",
      "CF_BUILD_URL",
      "CF_BRANCH",
      "CI",
    ];
    for (const v of ciVars) delete process.env[v];
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it("detects GitHub Actions with GITHUB_REF_NAME", () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REF_NAME = "main";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "main" });
  });

  it("GitHub Actions: GITHUB_REF_NAME takes priority over GITHUB_HEAD_REF", () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_REF_NAME = "main";
    process.env.GITHUB_HEAD_REF = "feature";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "main" });
  });

  it("GitHub Actions: falls back to GITHUB_HEAD_REF when GITHUB_REF_NAME is not set", () => {
    process.env.GITHUB_ACTIONS = "true";
    process.env.GITHUB_HEAD_REF = "feature";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "feature" });
  });

  it("detects GitLab CI", () => {
    process.env.GITLAB_CI = "true";
    process.env.CI_COMMIT_REF_NAME = "develop";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "develop" });
  });

  it("detects CircleCI", () => {
    process.env.CIRCLECI = "true";
    process.env.CIRCLE_BRANCH = "release";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "release" });
  });

  it("detects Jenkins with GIT_BRANCH", () => {
    process.env.JENKINS_URL = "http://jenkins";
    process.env.GIT_BRANCH = "main";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "main" });
  });

  it("detects Jenkins with BRANCH_NAME fallback", () => {
    process.env.JENKINS_URL = "http://jenkins";
    process.env.BRANCH_NAME = "hotfix";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "hotfix" });
  });

  it("detects Azure DevOps and strips refs/heads/ prefix", () => {
    process.env.TF_BUILD = "True";
    process.env.BUILD_SOURCEBRANCH = "refs/heads/main";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "main" });
  });

  it("detects Codefresh", () => {
    process.env.CF_BUILD_URL = "http://cf";
    process.env.CF_BRANCH = "staging";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "staging" });
  });

  it("detects generic CI with BRANCH_NAME", () => {
    process.env.CI = "true";
    process.env.BRANCH_NAME = "test-branch";

    expect(detectCIContext()).toEqual({ isCI: true, branch: "test-branch" });
  });

  it("returns isCI: false and branch: undefined when no CI vars are set", () => {
    expect(detectCIContext()).toEqual({ isCI: false, branch: undefined });
  });

  it("returns isCI: false with branch from BRANCH_NAME in local environment", () => {
    process.env.BRANCH_NAME = "local-branch";

    expect(detectCIContext()).toEqual({
      isCI: false,
      branch: "local-branch",
    });
  });
});
