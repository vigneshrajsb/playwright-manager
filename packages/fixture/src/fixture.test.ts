import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_API_TIMEOUT_MS, DEFAULT_CACHE_TTL_MS } from "./constants";
import type { DisabledTestsResponse } from "./types";

vi.mock("./cache", () => ({
  disabledTestsCache: {
    get: vi.fn(),
    set: vi.fn(),
    getPendingRequest: vi.fn(),
    setPendingRequest: vi.fn(),
    clearPendingRequest: vi.fn(),
  },
}));

import { disabledTestsCache } from "./cache";
import { fetchDisabledTestsForProject, getDisabledTests } from "./fixture";

const mockCache = vi.mocked(disabledTestsCache);

const mockResponse: DisabledTestsResponse = {
  disabledTests: { "test-1": { reason: "flaky" } },
  timestamp: 1704067200,
};

describe("fetchDisabledTestsForProject", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  it("sends POST to correct URL with correct body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchDisabledTestsForProject(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      "http://localhost:8080",
      5000,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/tests/check",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: "org/repo",
          projectName: "chromium",
          branch: "main",
          baseURL: "http://localhost:8080",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchDisabledTestsForProject(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      undefined,
      5000,
    );

    expect(result).toEqual(mockResponse);
  });

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(
      fetchDisabledTestsForProject(
        "http://localhost:3000",
        "org/repo",
        "chromium",
        "main",
        undefined,
        5000,
      ),
    ).rejects.toThrow("API returned 500");
  });

  it("passes an AbortSignal to fetch for timeout support", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await fetchDisabledTestsForProject(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      undefined,
      5000,
    );

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts fetch when timeout expires", async () => {
    vi.useFakeTimers();

    mockFetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const promise = fetchDisabledTestsForProject(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      undefined,
      5000,
    );

    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow("aborted");

    vi.useRealTimers();
  });
});

describe("getDisabledTests", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockCache.get.mockReset();
    mockCache.set.mockReset();
    mockCache.getPendingRequest.mockReset();
    mockCache.setPendingRequest.mockReset();
    mockCache.clearPendingRequest.mockReset();
    mockCache.get.mockReturnValue(undefined);
    mockCache.getPendingRequest.mockReturnValue(undefined);
  });

  it("returns cached data without calling fetch on cache hit", async () => {
    mockCache.get.mockReturnValue(mockResponse);

    const result = await getDisabledTests(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      "http://localhost:8080",
      DEFAULT_CACHE_TTL_MS,
      DEFAULT_API_TIMEOUT_MS,
    );

    expect(result).toEqual(mockResponse);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns pending request result when one already exists", async () => {
    mockCache.getPendingRequest.mockReturnValue(Promise.resolve(mockResponse));

    const result = await getDisabledTests(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      undefined,
      DEFAULT_CACHE_TTL_MS,
      DEFAULT_API_TIMEOUT_MS,
    );

    expect(result).toEqual(mockResponse);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches from API and caches result on cache miss", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await getDisabledTests(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      "http://localhost:8080",
      DEFAULT_CACHE_TTL_MS,
      DEFAULT_API_TIMEOUT_MS,
    );

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockCache.set).toHaveBeenCalledWith(
      "org/repo:chromium:main:http://localhost:8080",
      mockResponse,
    );
  });

  it("builds cache key as repo:project:branch:baseURL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await getDisabledTests(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      "http://localhost:8080",
      DEFAULT_CACHE_TTL_MS,
      DEFAULT_API_TIMEOUT_MS,
    );

    expect(mockCache.setPendingRequest).toHaveBeenCalledWith(
      "org/repo:chromium:main:http://localhost:8080",
      expect.any(Promise),
    );
  });

  it("uses 'unknown' for undefined branch and baseURL in cache key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await getDisabledTests(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      undefined,
      undefined,
      DEFAULT_CACHE_TTL_MS,
      DEFAULT_API_TIMEOUT_MS,
    );

    expect(mockCache.setPendingRequest).toHaveBeenCalledWith(
      "org/repo:chromium:unknown:unknown",
      expect.any(Promise),
    );
  });

  it("clears pending request on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await getDisabledTests(
      "http://localhost:3000",
      "org/repo",
      "chromium",
      "main",
      undefined,
      DEFAULT_CACHE_TTL_MS,
      DEFAULT_API_TIMEOUT_MS,
    );

    expect(mockCache.clearPendingRequest).toHaveBeenCalledWith("org/repo:chromium:main:unknown");
  });

  it("clears pending request on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(
      getDisabledTests(
        "http://localhost:3000",
        "org/repo",
        "chromium",
        "main",
        undefined,
        DEFAULT_CACHE_TTL_MS,
        DEFAULT_API_TIMEOUT_MS,
      ),
    ).rejects.toThrow("Network error");

    expect(mockCache.clearPendingRequest).toHaveBeenCalledWith("org/repo:chromium:main:unknown");
  });
});
