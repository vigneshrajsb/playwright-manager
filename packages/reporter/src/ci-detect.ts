import type { CIEnvironment } from "./types";

export function detectCIEnvironment(): CIEnvironment {
  const env = process.env;

  if (env.GITHUB_ACTIONS) {
    return {
      isCI: true,
      branch: env.GITHUB_REF_NAME || env.GITHUB_HEAD_REF,
      commitSha: env.GITHUB_SHA,
      commitMessage: undefined,
      jobUrl: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
      runId: `github-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`,
    };
  }

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

  return {
    isCI: false,
    branch: undefined,
    commitSha: undefined,
    commitMessage: undefined,
    jobUrl: undefined,
    runId: undefined,
  };
}

export function generateRunId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `local-${timestamp}-${random}`;
}
