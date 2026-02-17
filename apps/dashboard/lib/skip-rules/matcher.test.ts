import { describe, expect, it } from "vitest";
import { matchRule } from "./matcher";
import type { SkipRule } from "@/lib/db/schema";

function makeRule(
	overrides: Partial<SkipRule> = {},
): SkipRule {
	return {
		id: 1,
		testId: 100,
		branchPattern: null,
		envPattern: null,
		reason: "test rule",
		createdAt: new Date(),
		deletedAt: null,
		...overrides,
	};
}

describe("matchRule", () => {
	describe("global rules (no patterns)", () => {
		it("matches when both patterns are null", () => {
			const result = matchRule(makeRule(), "main", "http://localhost:3000");
			expect(result.matches).toBe(true);
			expect(result.matchedBranch).toBeUndefined();
			expect(result.matchedEnv).toBeUndefined();
		});

		it("matches even with no branch or baseURL", () => {
			const result = matchRule(makeRule(), undefined, undefined);
			expect(result.matches).toBe(true);
		});
	});

	describe("branch pattern matching", () => {
		it("matches exact branch name", () => {
			const rule = makeRule({ branchPattern: "main" });
			const result = matchRule(rule, "main", undefined);
			expect(result.matches).toBe(true);
			expect(result.matchedBranch).toBe(true);
		});

		it("matches glob pattern", () => {
			const rule = makeRule({ branchPattern: "feature/*" });
			const result = matchRule(rule, "feature/login", undefined);
			expect(result.matches).toBe(true);
			expect(result.matchedBranch).toBe(true);
		});

		it("does not match non-matching branch", () => {
			const rule = makeRule({ branchPattern: "main" });
			const result = matchRule(rule, "develop", undefined);
			expect(result.matches).toBe(false);
			expect(result.matchedBranch).toBe(false);
		});

		it("is case-insensitive", () => {
			const rule = makeRule({ branchPattern: "Main" });
			const result = matchRule(rule, "main", undefined);
			expect(result.matches).toBe(true);
		});

		it("fails when branch is undefined", () => {
			const rule = makeRule({ branchPattern: "main" });
			const result = matchRule(rule, undefined, undefined);
			expect(result.matches).toBe(false);
			expect(result.matchedBranch).toBe(false);
		});
	});

	describe("env pattern matching", () => {
		it("matches hostname from baseURL", () => {
			const rule = makeRule({ envPattern: "staging.*" });
			const result = matchRule(rule, undefined, "http://staging.example.com");
			expect(result.matches).toBe(true);
			expect(result.matchedEnv).toBe(true);
		});

		it("does not match non-matching hostname", () => {
			const rule = makeRule({ envPattern: "staging.*" });
			const result = matchRule(rule, undefined, "http://prod.example.com");
			expect(result.matches).toBe(false);
			expect(result.matchedEnv).toBe(false);
		});

		it("fails when baseURL is undefined", () => {
			const rule = makeRule({ envPattern: "staging.*" });
			const result = matchRule(rule, undefined, undefined);
			expect(result.matches).toBe(false);
			expect(result.matchedEnv).toBe(false);
		});

		it("fails when baseURL is invalid", () => {
			const rule = makeRule({ envPattern: "staging.*" });
			const result = matchRule(rule, undefined, "not-a-url");
			expect(result.matches).toBe(false);
			expect(result.matchedEnv).toBe(false);
		});
	});

	describe("combined patterns (AND logic)", () => {
		it("matches when both branch and env match", () => {
			const rule = makeRule({
				branchPattern: "main",
				envPattern: "staging.*",
			});
			const result = matchRule(rule, "main", "http://staging.example.com");
			expect(result.matches).toBe(true);
			expect(result.matchedBranch).toBe(true);
			expect(result.matchedEnv).toBe(true);
		});

		it("fails when branch matches but env does not", () => {
			const rule = makeRule({
				branchPattern: "main",
				envPattern: "staging.*",
			});
			const result = matchRule(rule, "main", "http://prod.example.com");
			expect(result.matches).toBe(false);
			expect(result.matchedBranch).toBe(true);
			expect(result.matchedEnv).toBe(false);
		});

		it("fails when env matches but branch does not", () => {
			const rule = makeRule({
				branchPattern: "main",
				envPattern: "staging.*",
			});
			const result = matchRule(rule, "develop", "http://staging.example.com");
			expect(result.matches).toBe(false);
			expect(result.matchedBranch).toBe(false);
			expect(result.matchedEnv).toBe(true);
		});
	});
});
