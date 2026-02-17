import { describe, expect, it } from "vitest";
import { validateGlobPattern, validatePatterns } from "./patterns";

describe("validateGlobPattern", () => {
	it.each([null, undefined, "", "main", "develop", "main-*", "feature/*", "release-?.?", "feature/[abc]*", "a".repeat(255)])(
		"accepts valid pattern %j",
		(input) => {
			expect(validateGlobPattern(input)).toEqual({ valid: true });
		},
	);

	it("rejects patterns longer than 255 characters", () => {
		const result = validateGlobPattern("a".repeat(256));
		expect(result.valid).toBe(false);
		expect(result.error).toContain("too long");
	});

	it.each(["main;drop", "my branch"])(
		"rejects pattern with invalid characters: '%s'",
		(input) => {
			const result = validateGlobPattern(input);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("invalid characters");
		},
	);
});

describe("validatePatterns", () => {
	it("accepts when both are valid", () => {
		expect(validatePatterns("main", "staging.*")).toEqual({ valid: true });
	});

	it("accepts when both are null", () => {
		expect(validatePatterns(null, null)).toEqual({ valid: true });
	});

	it("fails with branch pattern error when branch is invalid", () => {
		const result = validatePatterns("invalid pattern;", "staging.*");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Branch pattern");
	});

	it("fails with env pattern error when env is invalid", () => {
		const result = validatePatterns("main", "invalid pattern;");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Environment pattern");
	});

	it("reports branch error first when both are invalid", () => {
		const result = validatePatterns("invalid;", "also invalid;");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Branch pattern");
	});
});
