/**
 * CI context information
 */
export interface CIContext {
  branch?: string;
  isCI: boolean;
}

/**
 * Detect current git branch from CI environment variables.
 * Supports multiple CI providers with the same detection logic as the reporter.
 */
export function detectCIContext(): CIContext {
  const env = process.env;

  // GitHub Actions
  if (env.GITHUB_ACTIONS) {
    return {
      isCI: true,
      branch: env.GITHUB_REF_NAME || env.GITHUB_HEAD_REF,
    };
  }

  // GitLab CI
  if (env.GITLAB_CI) {
    return {
      isCI: true,
      branch: env.CI_COMMIT_REF_NAME,
    };
  }

  // CircleCI
  if (env.CIRCLECI) {
    return {
      isCI: true,
      branch: env.CIRCLE_BRANCH,
    };
  }

  // Jenkins
  if (env.JENKINS_URL) {
    return {
      isCI: true,
      branch: env.GIT_BRANCH || env.BRANCH_NAME,
    };
  }

  // Azure DevOps
  if (env.TF_BUILD) {
    return {
      isCI: true,
      branch: env.BUILD_SOURCEBRANCH?.replace("refs/heads/", ""),
    };
  }

  // Codefresh
  if (env.CF_BUILD_URL) {
    return {
      isCI: true,
      branch: env.CF_BRANCH,
    };
  }

  // Generic CI detection
  if (env.CI) {
    return {
      isCI: true,
      branch: env.BRANCH_NAME || env.GIT_BRANCH,
    };
  }

  // Local development - no automatic branch detection
  // User can set BRANCH_NAME env var manually or use the branch option
  return {
    isCI: false,
    branch: env.BRANCH_NAME,
  };
}
