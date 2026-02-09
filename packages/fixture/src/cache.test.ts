import { disabledTestsCache } from "./cache";
import type { DisabledTestsResponse } from "./types";

describe("disabledTestsCache", () => {
  const TTL = 60_000;
  const mockResponse: DisabledTestsResponse = {
    disabledTests: { "test-1": { reason: "flaky" } },
    timestamp: 1704067200,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    disabledTestsCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("get/set", () => {
    it("returns undefined for unknown key", () => {
      expect(disabledTestsCache.get("unknown-key", TTL)).toBeUndefined();
    });

    it("returns data after set within TTL", () => {
      disabledTestsCache.set("key1", mockResponse);

      expect(disabledTestsCache.get("key1", TTL)).toEqual(mockResponse);
    });

    it("returns undefined after TTL expires", () => {
      disabledTestsCache.set("key1", mockResponse);

      vi.advanceTimersByTime(TTL + 1);

      expect(disabledTestsCache.get("key1", TTL)).toBeUndefined();
    });

    it("isolates different keys", () => {
      const otherResponse: DisabledTestsResponse = {
        disabledTests: { "test-2": { reason: "broken" } },
        timestamp: 1704067200,
      };

      disabledTestsCache.set("key1", mockResponse);
      disabledTestsCache.set("key2", otherResponse);

      expect(disabledTestsCache.get("key1", TTL)).toEqual(mockResponse);
      expect(disabledTestsCache.get("key2", TTL)).toEqual(otherResponse);
    });
  });

  describe("pending requests", () => {
    it("returns undefined when no pending request exists", () => {
      expect(disabledTestsCache.getPendingRequest("key1")).toBeUndefined();
    });

    it("returns pending request after setPendingRequest", () => {
      const promise = Promise.resolve(mockResponse);
      disabledTestsCache.setPendingRequest("key1", promise);

      expect(disabledTestsCache.getPendingRequest("key1")).toBe(promise);
    });

    it("removes pending request after clearPendingRequest", () => {
      const promise = Promise.resolve(mockResponse);
      disabledTestsCache.setPendingRequest("key1", promise);
      disabledTestsCache.clearPendingRequest("key1");

      expect(disabledTestsCache.getPendingRequest("key1")).toBeUndefined();
    });

    it("keeps pending requests independent per key", () => {
      const promise1 = Promise.resolve(mockResponse);
      const promise2 = Promise.resolve({
        ...mockResponse,
        disabledTests: {},
      });

      disabledTestsCache.setPendingRequest("key1", promise1);
      disabledTestsCache.setPendingRequest("key2", promise2);

      expect(disabledTestsCache.getPendingRequest("key1")).toBe(promise1);
      expect(disabledTestsCache.getPendingRequest("key2")).toBe(promise2);

      disabledTestsCache.clearPendingRequest("key1");

      expect(disabledTestsCache.getPendingRequest("key1")).toBeUndefined();
      expect(disabledTestsCache.getPendingRequest("key2")).toBe(promise2);
    });
  });

  describe("clear", () => {
    it("clears all data and pending requests", () => {
      disabledTestsCache.set("key1", mockResponse);
      disabledTestsCache.setPendingRequest("key2", Promise.resolve(mockResponse));

      disabledTestsCache.clear();

      expect(disabledTestsCache.get("key1", TTL)).toBeUndefined();
      expect(disabledTestsCache.getPendingRequest("key2")).toBeUndefined();
    });
  });
});
