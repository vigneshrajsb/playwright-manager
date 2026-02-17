import { describe, expect, it } from "vitest";
import {
	getHealthLevel,
	getHealthLabel,
	getHealthVariant,
	getStatusVariant,
	getRunStatusVariant,
	getOutcomeVariant,
	isResultNegative,
	getStatusVariantWithExpectation,
} from "./badges";

describe("getHealthLevel", () => {
	it.each([
		[null, "unknown"],
		[undefined, "unknown"],
		[100, "healthy"],
		[80, "healthy"],
		[79, "flaky"],
		[50, "flaky"],
		[49, "failing"],
		[0, "failing"],
	] as const)("returns '%s' for score %s", (score, expected) => {
		expect(getHealthLevel(score)).toBe(expected);
	});
});

describe("getHealthLabel", () => {
	it.each([
		[null, "No data"],
		[90, "Healthy"],
		[60, "Flaky"],
		[20, "Failing"],
	] as const)("returns '%s' for score %s", (score, expected) => {
		expect(getHealthLabel(score)).toBe(expected);
	});
});

describe("getHealthVariant", () => {
	it.each([
		[90, "green"],
		[60, "yellow"],
		[20, "red"],
	])("returns %s-colored classes for score %i", (score, color) => {
		expect(getHealthVariant(score)).toContain(color);
	});

	it("returns empty string for unknown", () => {
		expect(getHealthVariant(null)).toBe("");
	});
});

describe("getStatusVariant", () => {
	it.each([
		["passed", "green"],
		["failed", "red"],
		["timedOut", "orange"],
		["skipped", "gray"],
		["interrupted", "yellow"],
		["unknown", "gray"],
	])("returns %s-colored classes for '%s'", (status, color) => {
		expect(getStatusVariant(status)).toContain(color);
	});
});

describe("getRunStatusVariant", () => {
	it.each([
		["running", "blue"],
		["passed", "green"],
		["failed", "red"],
		["interrupted", "yellow"],
		["unknown", "gray"],
	])("returns %s-colored classes for '%s'", (status, color) => {
		expect(getRunStatusVariant(status)).toContain(color);
	});
});

describe("getOutcomeVariant", () => {
	it.each([
		["expected", "green"],
		["unexpected", "red"],
		["flaky", "yellow"],
		["skipped", "gray"],
		["unknown", "gray"],
	])("returns %s-colored classes for '%s'", (outcome, color) => {
		expect(getOutcomeVariant(outcome)).toContain(color);
	});
});

describe("isResultNegative", () => {
	it.each([
		["failed", "expected", true],
		["timedOut", "expected", true],
		["passed", "unexpected", true],
		["passed", "expected", false],
		["skipped", "expected", false],
	] as const)("status='%s' + outcome='%s' => %s", (status, outcome, expected) => {
		expect(isResultNegative(status, outcome)).toBe(expected);
	});
});

describe("getStatusVariantWithExpectation", () => {
	it("always returns red for unexpected outcome", () => {
		expect(getStatusVariantWithExpectation("passed", "passed", "unexpected")).toContain("red");
		expect(getStatusVariantWithExpectation("failed", "failed", "unexpected")).toContain("red");
	});

	it("returns normal status variant for expected outcome", () => {
		expect(getStatusVariantWithExpectation("passed", "passed", "expected")).toContain("green");
	});

	it("returns normal status variant for flaky outcome", () => {
		expect(getStatusVariantWithExpectation("passed", "passed", "flaky")).toContain("green");
	});
});
