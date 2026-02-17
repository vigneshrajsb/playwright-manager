import { describe, expect, it } from "vitest";
import type { FlakinessSignals } from "./types";
import { calculateHeuristicScore, isHighConfidence } from "./heuristics";

const baseSignals: FlakinessSignals = {
	flakinessRate: 0,
	recentFlakinessRate: 0,
	recentOutcomes: [],
	errorSeenBefore: false,
	errorPassedAfterCount: 0,
	consecutiveFailures: 0,
	consecutivePasses: 0,
	healthScore: 100,
	healthDivergence: 0,
};

function signals(overrides: Partial<FlakinessSignals> = {}): FlakinessSignals {
	return { ...baseSignals, ...overrides };
}

describe("calculateHeuristicScore", () => {
	describe("signal 1: high flakiness rate", () => {
		it("adds 30 when recentFlakinessRate > 20%", () => {
			const result = calculateHeuristicScore(signals({ recentFlakinessRate: 25 }));
			expect(result.score).toBe(30);
			expect(result.reasoning).toContainEqual(expect.stringContaining("High flakiness rate"));
		});

		it("does not add when recentFlakinessRate <= 20%", () => {
			const result = calculateHeuristicScore(signals({ recentFlakinessRate: 20 }));
			expect(result.score).toBe(0);
		});
	});

	describe("signal 2: pattern match (recent passes)", () => {
		it("adds 25 when >= 2 passes and >= 30% pass ratio", () => {
			const result = calculateHeuristicScore(
				signals({ recentOutcomes: ["pass", "pass", "fail", "fail", "fail"] }),
			);
			expect(result.score).toBe(25);
			expect(result.reasoning).toContainEqual(expect.stringContaining("Passed 2 of last 5"));
		});

		it("does not add with only 1 pass", () => {
			const result = calculateHeuristicScore(
				signals({ recentOutcomes: ["pass", "fail", "fail", "fail", "fail", "fail", "fail"] }),
			);
			expect(result.score).toBe(0);
		});

		it("does not add when pass ratio < 30%", () => {
			const result = calculateHeuristicScore(
				signals({ recentOutcomes: ["pass", "pass", "fail", "fail", "fail", "fail", "fail", "fail"] }),
			);
			expect(result.score).toBe(0);
		});

		it("excludes skips from total count", () => {
			const result = calculateHeuristicScore(
				signals({ recentOutcomes: ["pass", "pass", "fail", "skip", "skip"] }),
			);
			// 2 passes out of 3 non-skip = 66%, >= 30% and >= 2 passes
			expect(result.score).toBe(25);
		});
	});

	describe("signal 3: error seen before", () => {
		it("adds 25 when error seen before and test later passed", () => {
			const result = calculateHeuristicScore(
				signals({ errorSeenBefore: true, errorPassedAfterCount: 3 }),
			);
			expect(result.score).toBe(25);
			expect(result.reasoning).toContainEqual(expect.stringContaining("Same error seen 3x before"));
		});

		it("does not add when errorSeenBefore but passedAfterCount is 0", () => {
			const result = calculateHeuristicScore(
				signals({ errorSeenBefore: true, errorPassedAfterCount: 0 }),
			);
			expect(result.score).toBe(0);
		});

		it("does not add when errorSeenBefore is false", () => {
			const result = calculateHeuristicScore(
				signals({ errorSeenBefore: false, errorPassedAfterCount: 5 }),
			);
			expect(result.score).toBe(0);
		});
	});

	describe("signal 4: low consecutive failures", () => {
		it("adds 15 when consecutive failures < 3 with passing history", () => {
			const result = calculateHeuristicScore(
				signals({ consecutiveFailures: 2, consecutivePasses: 5 }),
			);
			expect(result.score).toBe(15);
			expect(result.reasoning).toContainEqual(expect.stringContaining("Only 2 consecutive failures"));
		});

		it("does not add when consecutive failures >= 3", () => {
			const result = calculateHeuristicScore(
				signals({ consecutiveFailures: 3, consecutivePasses: 5 }),
			);
			expect(result.score).toBe(0);
		});

		it("does not add when no passing history", () => {
			const result = calculateHeuristicScore(
				signals({ consecutiveFailures: 1, consecutivePasses: 0 }),
			);
			expect(result.score).toBe(0);
		});
	});

	describe("signal 5: low health score", () => {
		it("adds 10 when healthScore < 50", () => {
			const result = calculateHeuristicScore(signals({ healthScore: 30 }));
			expect(result.score).toBe(10);
			expect(result.reasoning).toContainEqual(expect.stringContaining("Low health score"));
		});

		it("does not add when healthScore >= 50", () => {
			const result = calculateHeuristicScore(signals({ healthScore: 50 }));
			expect(result.score).toBe(0);
		});
	});

	describe("combined signals", () => {
		it("sums all signals when all fire", () => {
			const result = calculateHeuristicScore(
				signals({
					recentFlakinessRate: 25,
					recentOutcomes: ["pass", "pass", "fail"],
					errorSeenBefore: true,
					errorPassedAfterCount: 2,
					consecutiveFailures: 1,
					consecutivePasses: 3,
					healthScore: 30,
				}),
			);
			// 30 + 25 + 25 + 15 + 10 = 105, capped at 100
			expect(result.score).toBe(100);
			expect(result.reasoning).toHaveLength(5);
		});

		it("returns 0 when no signals fire", () => {
			const result = calculateHeuristicScore(signals());
			expect(result.score).toBe(0);
			expect(result.reasoning).toHaveLength(0);
		});

		it("preserves signals on the result", () => {
			const s = signals({ recentFlakinessRate: 50 });
			const result = calculateHeuristicScore(s);
			expect(result.signals).toBe(s);
		});
	});
});

describe("isHighConfidence", () => {
	it("returns true at threshold (75)", () => {
		expect(isHighConfidence(75)).toBe(true);
	});

	it("returns true above threshold", () => {
		expect(isHighConfidence(100)).toBe(true);
	});

	it("returns false below threshold", () => {
		expect(isHighConfidence(74)).toBe(false);
	});
});
