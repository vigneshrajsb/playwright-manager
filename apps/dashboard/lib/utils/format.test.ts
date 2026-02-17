import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	formatDate,
	formatDuration,
	formatShortDate,
	formatRelativeTime,
	formatPassRate,
	truncate,
	formatCommitSha,
	stripAnsi,
} from "./format";

describe("formatDuration", () => {
	it.each([
		[0, "0ms"],
		[150, "150ms"],
		[999, "999ms"],
		[1000, "1.0s"],
		[2500, "2.5s"],
		[59999, "60.0s"],
		[60000, "1m 0s"],
		[90000, "1m 30s"],
		[125000, "2m 5s"],
	])("formats %ims as %s", (ms, expected) => {
		expect(formatDuration(ms)).toBe(expected);
	});
});

describe("formatDate", () => {
	it.each([null, undefined, ""])("returns 'Never' for %j", (input) => {
		expect(formatDate(input)).toBe("Never");
	});

	it("formats a valid date string", () => {
		const result = formatDate("2024-06-15T10:30:00Z");
		expect(result).toContain("Jun");
		expect(result).toContain("15");
	});
});

describe("formatShortDate", () => {
	it("formats as month and day", () => {
		const result = formatShortDate("2024-12-28T12:00:00Z");
		expect(result).toContain("Dec");
		expect(result).toContain("28");
	});
});

describe("formatRelativeTime", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns 'just now' for < 1 minute ago", () => {
		expect(formatRelativeTime("2024-06-15T11:59:31Z")).toBe("just now");
	});

	it("returns minutes ago", () => {
		expect(formatRelativeTime("2024-06-15T11:55:00Z")).toBe("5m ago");
	});

	it("returns hours ago", () => {
		expect(formatRelativeTime("2024-06-15T09:00:00Z")).toBe("3h ago");
	});

	it("returns days ago", () => {
		expect(formatRelativeTime("2024-06-12T12:00:00Z")).toBe("3d ago");
	});

	it("returns formatted date for > 7 days ago", () => {
		const result = formatRelativeTime("2024-06-01T12:00:00Z");
		expect(result).toContain("Jun");
		expect(result).toContain("1");
	});
});

describe("formatPassRate", () => {
	it.each([
		[100, "100%"],
		[0, "0%"],
		[95, "95%"],
		[95.5, "95.5%"],
		[33.33, "33.3%"],
		["100", "100%"],
		["95.5", "95.5%"],
	])("formats %s as %s", (input, expected) => {
		expect(formatPassRate(input)).toBe(expected);
	});
});

describe("truncate", () => {
	it("returns string unchanged when shorter than max", () => {
		expect(truncate("hello", 10)).toBe("hello");
	});

	it("returns string unchanged when equal to max", () => {
		expect(truncate("hello", 5)).toBe("hello");
	});

	it("truncates with ellipsis when longer than max", () => {
		expect(truncate("hello world", 8)).toBe("hello...");
	});
});

describe("formatCommitSha", () => {
	it("returns first 7 characters", () => {
		expect(formatCommitSha("abc1234567890")).toBe("abc1234");
	});

	it.each([null, undefined])("returns empty string for %j", (input) => {
		expect(formatCommitSha(input)).toBe("");
	});
});

describe("stripAnsi", () => {
	it("removes ANSI color codes", () => {
		expect(stripAnsi("\x1B[31mred text\x1B[0m")).toBe("red text");
	});

	it("removes multiple ANSI codes", () => {
		expect(stripAnsi("\x1B[1m\x1B[31mbold red\x1B[0m")).toBe("bold red");
	});

	it("returns plain text unchanged", () => {
		expect(stripAnsi("plain text")).toBe("plain text");
	});
});
