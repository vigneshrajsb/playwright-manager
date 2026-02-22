import { beforeEach, describe, expect, it, vi } from "vitest";
import { findConfigFile, loadReporterConfig } from "./config-loader";

const { mockJitiInstance } = vi.hoisted(() => ({ mockJitiInstance: vi.fn() }));

vi.mock("jiti", () => ({
  createJiti: vi.fn().mockReturnValue(mockJitiInstance),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

const fs = await import("node:fs");

beforeEach(() => {
  mockJitiInstance.mockReset();
  vi.mocked(fs.existsSync).mockReturnValue(false);
});

describe("findConfigFile", () => {
  it("returns path to playwright.config.ts when found", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith("playwright.config.ts"));

    const result = findConfigFile("/project");

    expect(result).toBe("/project/playwright.config.ts");
  });

  it("returns path to playwright.config.js as fallback", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith("playwright.config.js"));

    const result = findConfigFile("/project");

    expect(result).toBe("/project/playwright.config.js");
  });

  it("returns null when no config file found", () => {
    const result = findConfigFile("/project");

    expect(result).toBeNull();
  });

  it("prefers playwright.config.ts over .js", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = findConfigFile("/project");

    expect(result).toBe("/project/playwright.config.ts");
  });
});

describe("loadReporterConfig", () => {
  it("extracts reporter options from config", () => {
    mockJitiInstance.mockReturnValue({
      default: {
        reporter: [
          ["html"],
          [
            "@playwright-manager/reporter",
            { apiUrl: "http://localhost:3000", repository: "org/repo" },
          ],
        ],
      },
    });

    const result = loadReporterConfig("/project/playwright.config.ts");

    expect(result).toEqual({ apiUrl: "http://localhost:3000", repository: "org/repo" });
  });

  it("handles config without default export", () => {
    mockJitiInstance.mockReturnValue({
      reporter: [
        [
          "@playwright-manager/reporter",
          { apiUrl: "http://localhost:3000", repository: "org/repo" },
        ],
      ],
    });

    const result = loadReporterConfig("/project/playwright.config.ts");

    expect(result).toEqual({ apiUrl: "http://localhost:3000", repository: "org/repo" });
  });

  it("returns null when reporter not in config", () => {
    mockJitiInstance.mockReturnValue({
      default: {
        reporter: [["html"]],
      },
    });

    const result = loadReporterConfig("/project/playwright.config.ts");

    expect(result).toBeNull();
  });

  it("returns null when no reporters array", () => {
    mockJitiInstance.mockReturnValue({
      default: { testDir: "./tests" },
    });

    const result = loadReporterConfig("/project/playwright.config.ts");

    expect(result).toBeNull();
  });

  it("returns null when reporter entry has no options", () => {
    mockJitiInstance.mockReturnValue({
      default: {
        reporter: [["@playwright-manager/reporter"]],
      },
    });

    const result = loadReporterConfig("/project/playwright.config.ts");

    expect(result).toBeNull();
  });

  it("throws when jiti fails to load config", () => {
    mockJitiInstance.mockImplementation(() => {
      throw new Error("Cannot find module");
    });

    expect(() => loadReporterConfig("/nonexistent/playwright.config.ts")).toThrow(
      "Cannot find module",
    );
  });
});
