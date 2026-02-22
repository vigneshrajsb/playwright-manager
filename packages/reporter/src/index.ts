// Default export for Playwright reporter config

export { detectCIEnvironment, generateRunId } from "./ci-detect";
export { TestManagerReporter, TestManagerReporter as default } from "./reporter";
export type {
  CIEnvironment,
  ReportPayload,
  RunMetadata,
  S3ReportConfig,
  TestManagerReporterOptions,
  TestResultData,
} from "./types";
