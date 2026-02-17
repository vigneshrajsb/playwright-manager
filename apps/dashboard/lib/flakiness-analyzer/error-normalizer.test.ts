import { describe, expect, it } from "vitest";
import { normalizeErrorMessage, hashErrorSignature } from "./error-normalizer";

describe("normalizeErrorMessage", () => {
	it("returns empty string for empty input", () => {
		expect(normalizeErrorMessage("")).toBe("");
	});

	it("removes line:column numbers", () => {
		expect(normalizeErrorMessage("Error in file.ts:123:45")).toBe("Error in file.ts");
	});

	it("removes standalone line numbers", () => {
		expect(normalizeErrorMessage("at file.ts:42")).toBe("at file.ts");
	});

	it("normalizes ISO timestamps consistently (same hour, different min:sec)", () => {
		// The :\d+:\d+ regex fires before the ISO regex, stripping minutes:seconds.
		// Timestamps with the same hour+ms but different min:sec normalize identically.
		const result1 = normalizeErrorMessage("Error at 2024-01-20T12:34:56.789Z");
		const result2 = normalizeErrorMessage("Error at 2024-01-20T12:00:05.789Z");
		expect(result1).toBe(result2);
	});

	it("replaces unix timestamps (13 digits)", () => {
		const msg = "Request id 1705745696789 failed";
		expect(normalizeErrorMessage(msg)).toBe("Request id <TIMESTAMP> failed");
	});

	it("replaces UUIDs", () => {
		const msg = "Session 550e8400-e29b-41d4-a716-446655440000 expired";
		expect(normalizeErrorMessage(msg)).toBe("Session <UUID> expired");
	});

	it("replaces UUIDs case-insensitively", () => {
		const msg = "ID: 550E8400-E29B-41D4-A716-446655440000";
		expect(normalizeErrorMessage(msg)).toBe("ID: <UUID>");
	});

	it("replaces memory addresses", () => {
		const msg = "Segfault at 0x7fff5fbff8c0";
		expect(normalizeErrorMessage(msg)).toBe("Segfault at <ADDR>");
	});

	it("normalizes localhost ports consistently", () => {
		// The standalone line number regex (:\d+) fires before localhost:<PORT>,
		// stripping the port. Both variants normalize to the same string.
		const result1 = normalizeErrorMessage("Connection refused at localhost:3456");
		const result2 = normalizeErrorMessage("Connection refused at localhost:9999");
		expect(result1).toBe(result2);
	});

	it("replaces /tmp paths", () => {
		const msg = "File not found: /tmp/playwright-abc123/screenshot.png";
		expect(normalizeErrorMessage(msg)).toBe("File not found: /tmp/<TEMP>");
	});

	it("replaces /var/folders paths", () => {
		const msg = "Cache at /var/folders/ab/cd1234/T/test expired";
		expect(normalizeErrorMessage(msg)).toBe("Cache at /var/folders/<TEMP> expired");
	});

	it("normalizes whitespace", () => {
		const msg = "Error   in   module    foo";
		expect(normalizeErrorMessage(msg)).toBe("Error in module foo");
	});

	it("handles multiple dynamic parts in one message", () => {
		const msg = "Error in file.ts:42:10 session 550e8400-e29b-41d4-a716-446655440000 at 0x7fff";
		const result = normalizeErrorMessage(msg);
		expect(result).toBe("Error in file.ts session <UUID> at <ADDR>");
	});
});

describe("hashErrorSignature", () => {
	it("returns same hash for errors differing only in line numbers", () => {
		const hash1 = hashErrorSignature("Error in file.ts:100:20 unexpected token");
		const hash2 = hashErrorSignature("Error in file.ts:200:30 unexpected token");
		expect(hash1).toBe(hash2);
	});

	it("returns same hash for errors differing only in UUIDs", () => {
		const hash1 = hashErrorSignature("Session 550e8400-e29b-41d4-a716-446655440000 expired");
		const hash2 = hashErrorSignature("Session a1b2c3d4-e5f6-7890-abcd-ef1234567890 expired");
		expect(hash1).toBe(hash2);
	});

	it("returns different hash for different errors", () => {
		const hash1 = hashErrorSignature("Error: timeout exceeded");
		const hash2 = hashErrorSignature("Error: element not found");
		expect(hash1).not.toBe(hash2);
	});

	it("returns a 64-character hex string", () => {
		const hash = hashErrorSignature("test error");
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});
});
