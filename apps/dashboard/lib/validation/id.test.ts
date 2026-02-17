import { describe, expect, it } from "vitest";
import { parseId, isValidId } from "./id";

describe("parseId", () => {
	it.each([
		["1", 1],
		["42", 42],
		["99999", 99999],
	])("parses '%s' as %i", (input, expected) => {
		expect(parseId(input)).toBe(expected);
	});

	it.each(["0", "-1", "-100", "1.5", "3.0", "01", "007", "abc", "", " ", "12abc"])(
		"returns null for '%s'",
		(input) => {
			expect(parseId(input)).toBeNull();
		},
	);
});

describe("isValidId", () => {
	it("delegates to parseId", () => {
		expect(isValidId("1")).toBe(true);
		expect(isValidId("0")).toBe(false);
		expect(isValidId("abc")).toBe(false);
	});
});
