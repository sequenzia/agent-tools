import { describe, it, expect, vi, beforeEach } from "vitest";
import { useResultStore } from "../result-store";

// Mock the result service
vi.mock("../../services/result-service", () => ({
  fetchResult: vi.fn(),
  fetchAllResults: vi.fn(),
}));

import {
  fetchResult,
  fetchAllResults,
} from "../../services/result-service";
import type { ParsedResult } from "../../services/result-service";

const mockFetchResult = vi.mocked(fetchResult);
const mockFetchAllResults = vi.mocked(fetchAllResults);

function makeResult(overrides: Partial<ParsedResult> = {}): ParsedResult {
  return {
    taskId: "5",
    filename: "result-5.md",
    subject: "Test task",
    outcome: "PASS",
    rawContent: "# Task Result: [5] Test task\nstatus: PASS",
    isTruncated: false,
    contentSize: 100,
    isMalformed: false,
    parseWarning: null,
    receivedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useResultStore.setState({
    results: new Map(),
    isLoading: false,
    error: null,
  });
});

describe("useResultStore", () => {
  describe("initial state", () => {
    it("has empty results by default", () => {
      const state = useResultStore.getState();
      expect(state.results.size).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("loadAllResults", () => {
    it("loads and stores results", async () => {
      const result1 = makeResult({ taskId: "5", filename: "result-5.md" });
      const result2 = makeResult({
        taskId: "10",
        filename: "result-10.md",
        outcome: "PARTIAL",
      });
      mockFetchAllResults.mockResolvedValueOnce([result1, result2]);

      await useResultStore.getState().loadAllResults("/project");

      const state = useResultStore.getState();
      expect(state.results.size).toBe(2);
      expect(state.results.get("result-5.md")?.outcome).toBe("PASS");
      expect(state.results.get("result-10.md")?.outcome).toBe("PARTIAL");
      expect(state.isLoading).toBe(false);
    });

    it("sets isLoading during fetch", async () => {
      let resolve: (value: ParsedResult[]) => void;
      const promise = new Promise<ParsedResult[]>((r) => {
        resolve = r;
      });
      mockFetchAllResults.mockReturnValueOnce(promise);

      const loadPromise = useResultStore
        .getState()
        .loadAllResults("/project");

      expect(useResultStore.getState().isLoading).toBe(true);

      resolve!([]);
      await loadPromise;

      expect(useResultStore.getState().isLoading).toBe(false);
    });

    it("sets error on failure", async () => {
      mockFetchAllResults.mockRejectedValueOnce(new Error("Network error"));

      await useResultStore.getState().loadAllResults("/project");

      const state = useResultStore.getState();
      expect(state.error).toBe("Network error");
      expect(state.isLoading).toBe(false);
    });

    it("handles string error", async () => {
      mockFetchAllResults.mockRejectedValueOnce("IPC failed");

      await useResultStore.getState().loadAllResults("/project");

      expect(useResultStore.getState().error).toBe("IPC failed");
    });
  });

  describe("addResult", () => {
    it("adds a new result", async () => {
      const result = makeResult();
      mockFetchResult.mockResolvedValueOnce(result);

      await useResultStore.getState().addResult("/project", "result-5.md");

      const state = useResultStore.getState();
      expect(state.results.size).toBe(1);
      expect(state.results.get("result-5.md")?.taskId).toBe("5");
    });

    it("updates an existing result", async () => {
      const original = makeResult({ outcome: "FAIL" });
      useResultStore.setState({
        results: new Map([["result-5.md", original]]),
      });

      const updated = makeResult({ outcome: "PASS" });
      mockFetchResult.mockResolvedValueOnce(updated);

      await useResultStore.getState().addResult("/project", "result-5.md");

      expect(useResultStore.getState().results.get("result-5.md")?.outcome).toBe(
        "PASS",
      );
    });

    it("does not add when fetch returns null", async () => {
      mockFetchResult.mockResolvedValueOnce(null);

      await useResultStore.getState().addResult("/project", "result-99.md");

      expect(useResultStore.getState().results.size).toBe(0);
    });

    it("sets error on fetch failure", async () => {
      mockFetchResult.mockRejectedValueOnce(new Error("Read failed"));

      await useResultStore.getState().addResult("/project", "result-5.md");

      expect(useResultStore.getState().error).toBe("Read failed");
    });
  });

  describe("removeResult", () => {
    it("removes a result by filename", () => {
      const result = makeResult();
      useResultStore.setState({
        results: new Map([["result-5.md", result]]),
      });

      useResultStore.getState().removeResult("result-5.md");

      expect(useResultStore.getState().results.size).toBe(0);
    });

    it("does nothing for non-existent filename", () => {
      const result = makeResult();
      useResultStore.setState({
        results: new Map([["result-5.md", result]]),
      });

      useResultStore.getState().removeResult("result-99.md");

      expect(useResultStore.getState().results.size).toBe(1);
    });
  });

  describe("clearResults", () => {
    it("clears all results and resets state", () => {
      useResultStore.setState({
        results: new Map([["result-5.md", makeResult()]]),
        isLoading: true,
        error: "some error",
      });

      useResultStore.getState().clearResults();

      const state = useResultStore.getState();
      expect(state.results.size).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("getSortedResults", () => {
    it("returns results sorted by receivedAt descending", () => {
      const older = makeResult({
        filename: "result-5.md",
        receivedAt: 1000,
      });
      const newer = makeResult({
        filename: "result-10.md",
        receivedAt: 2000,
      });
      useResultStore.setState({
        results: new Map([
          ["result-5.md", older],
          ["result-10.md", newer],
        ]),
      });

      const sorted = useResultStore.getState().getSortedResults();
      expect(sorted[0].filename).toBe("result-10.md");
      expect(sorted[1].filename).toBe("result-5.md");
    });

    it("returns empty array when no results", () => {
      const sorted = useResultStore.getState().getSortedResults();
      expect(sorted).toEqual([]);
    });
  });
});
