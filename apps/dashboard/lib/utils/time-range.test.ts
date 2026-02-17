import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	sanitizeTimeInput,
	parseTimeRange,
	validateTimeRange,
	timeRangeToDateRange,
	isRelativeTimeRange,
	toISODateString,
	dateStringToStartOfDay,
	dateStringToEndOfDay,
	formatDateRangeDisplay,
} from "./time-range";

describe("sanitizeTimeInput", () => {
	it("trims whitespace", () => {
		expect(sanitizeTimeInput("  24h  ")).toBe("24h");
	});

	it("lowercases input", () => {
		expect(sanitizeTimeInput("24H")).toBe("24h");
	});

	it("removes internal whitespace", () => {
		expect(sanitizeTimeInput("2 4 h")).toBe("24h");
	});
});

describe("parseTimeRange", () => {
	it.each([
		["15m", { value: 15, unit: "m" }],
		["24h", { value: 24, unit: "h" }],
		["7d", { value: 7, unit: "d" }],
		["2w", { value: 2, unit: "w" }],
		["999d", { value: 999, unit: "d" }],
		["  15m  ", { value: 15, unit: "m" }],
	])("parses '%s'", (input, expected) => {
		expect(parseTimeRange(input)).toEqual(expected);
	});

	it.each(["0m", "1000h", "abc", "", "24x"])(
		"returns null for invalid input '%s'",
		(input) => {
			expect(parseTimeRange(input)).toBeNull();
		},
	);
});

describe("validateTimeRange", () => {
	it.each(["15m", "24h", "7d", "2w"])("accepts valid range '%s'", (input) => {
		expect(validateTimeRange(input)).toEqual({ valid: true });
	});

	it.each([
		["", "empty"],
		["abc", "Invalid format"],
		["24x", "Invalid unit"],
		["0h", "at least 1"],
		["1000d", "999 or less"],
	])("rejects '%s' with error containing '%s'", (input, errorFragment) => {
		const result = validateTimeRange(input);
		expect(result.valid).toBe(false);
		expect(result.error).toContain(errorFragment);
	});
});

describe("timeRangeToDateRange", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([
		["15m", "2024-06-15T11:45:00.000Z"],
		["24h", "2024-06-14T12:00:00.000Z"],
		["7d", "2024-06-08T12:00:00.000Z"],
		["2w", "2024-06-01T12:00:00.000Z"],
		["invalid", "2024-06-14T12:00:00.000Z"],
	])("'%s' starts at %s", (input, expectedStart) => {
		const { startDate, endDate } = timeRangeToDateRange(input);
		expect(endDate.toISOString()).toBe("2024-06-15T12:00:00.000Z");
		expect(startDate.toISOString()).toBe(expectedStart);
	});
});

describe("isRelativeTimeRange", () => {
	it.each([
		["24h", undefined, undefined, true],
		[undefined, undefined, undefined, false],
		["24h", "2024-01-01", undefined, false],
		["24h", undefined, "2024-01-31", false],
	] as const)(
		"(%s, %s, %s) => %s",
		(timeRange, startDate, endDate, expected) => {
			expect(isRelativeTimeRange(timeRange, startDate, endDate)).toBe(expected);
		},
	);
});

it("toISODateString formats a date as yyyy-MM-dd", () => {
	expect(toISODateString(new Date("2024-06-15T12:30:00Z"))).toBe("2024-06-15");
});

it("dateStringToStartOfDay returns start of day", () => {
	const result = dateStringToStartOfDay("2024-06-15");
	expect(result.getHours()).toBe(0);
	expect(result.getMinutes()).toBe(0);
	expect(result.getSeconds()).toBe(0);
});

it("dateStringToEndOfDay returns end of day", () => {
	const result = dateStringToEndOfDay("2024-06-15");
	expect(result.getHours()).toBe(23);
	expect(result.getMinutes()).toBe(59);
	expect(result.getSeconds()).toBe(59);
});

it("formatDateRangeDisplay formats as 'Mon d - Mon d'", () => {
	const result = formatDateRangeDisplay("2024-01-15T12:00:00Z", "2024-01-20T12:00:00Z");
	expect(result).toBe("Jan 15 - Jan 20");
});
