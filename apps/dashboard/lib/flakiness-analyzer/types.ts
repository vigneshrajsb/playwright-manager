export interface FlakinessSignals {
  flakinessRate: number;
  recentFlakinessRate: number;
  recentOutcomes: Array<"pass" | "fail" | "flaky" | "skip">;
  errorSeenBefore: boolean;
  errorPassedAfterCount: number;
  consecutiveFailures: number;
  consecutivePasses: number;
  healthScore: number;
  healthDivergence: number;
}

export interface TestVerdict {
  testId: string;
  testTitle: string;
  filePath: string;
  verdict: "flaky" | "likely_real_failure";
  confidence: number;
  reasoning: string;
  signals: FlakinessSignals;
  llmUsed: boolean;
  errorMessage?: string;
  errorStack?: string;
}

export interface PipelineVerdict {
  verdict: "flaky" | "likely_real_failure";
  confidence: number;
  canAutoPass: boolean;
  failedTests: TestVerdict[];
  summary: string;
}

export interface HeuristicResult {
  score: number;
  reasoning: string[];
  signals: FlakinessSignals;
}

export interface LLMAnalysisResult {
  verdict: "flaky" | "real_bug";
  confidenceAdjustment: number;
  reasoning: string;
}
