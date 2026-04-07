import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExecutionContext, _computeNewLines } from "../use-execution-context";
import { useSessionStore } from "../../stores/session-store";

// --- Mock api-client ---

type ListenerCallback = (payload: unknown) => void;
const listeners: Map<string, ListenerCallback> = new Map();
const mockUnlisten = vi.fn();

vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: {
    on: vi.fn((eventName: string, callback: ListenerCallback) => {
      listeners.set(eventName, callback);
      return mockUnlisten;
    }),
    send: vi.fn(),
    connected: vi.fn(() => true),
    close: vi.fn(),
  },
}));

// --- Mock session service ---

vi.mock("../../services/session-service", () => ({
  checkLiveSession: vi.fn(),
  readSessionFile: vi.fn(),
}));

// Directly mock fetchSessionFile on the store
const mockFetchSessionFile = vi.fn();

function resetStore() {
  useSessionStore.setState({
    status: "inactive",
    sessionInfo: null,
    isChecking: false,
    error: null,
    sessionFiles: new Map(),
    isDashboardActive: false,
    fetchSessionFile: mockFetchSessionFile,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Flush microtasks without advancing fake timers. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useExecutionContext", () => {
  describe("initial state", () => {
    it("returns inactive state when no project path", () => {
      const { result } = renderHook(() => useExecutionContext(null));

      expect(result.current.isActive).toBe(false);
      expect(result.current.content).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("returns inactive state when session is inactive", () => {
      const { result } = renderHook(() =>
        useExecutionContext("/project"),
      );

      expect(result.current.isActive).toBe(false);
      expect(result.current.content).toBeNull();
    });
  });

  describe("when session becomes active", () => {
    it("fetches execution_context.md", async () => {
      mockFetchSessionFile.mockResolvedValue({
        filename: "execution_context.md",
        content: "## Project Patterns\n- Pattern 1\n",
        error: null,
        exists: true,
      });

      renderHook(() => useExecutionContext("/project"));

      // Activate session
      await act(async () => {
        useSessionStore.setState({
          status: "active",
          isDashboardActive: true,
          fetchSessionFile: mockFetchSessionFile,
        });
      });

      // Wait for the async fetch
      await flushMicrotasks();
      await flushMicrotasks();

      expect(mockFetchSessionFile).toHaveBeenCalledWith(
        "/project",
        "execution_context.md",
      );
    });

    it("sets content from fetched file", async () => {
      const content = "## Project Patterns\n- Pattern 1\n";
      mockFetchSessionFile.mockResolvedValue({
        filename: "execution_context.md",
        content,
        error: null,
        exists: true,
      });

      const { result } = renderHook(() => useExecutionContext("/project"));

      await act(async () => {
        useSessionStore.setState({
          status: "active",
          isDashboardActive: true,
          fetchSessionFile: mockFetchSessionFile,
        });
      });

      await flushMicrotasks();
      await flushMicrotasks();

      expect(result.current.content).toBe(content);
      expect(result.current.isActive).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("when file does not exist", () => {
    it("sets content to null (empty state)", async () => {
      mockFetchSessionFile.mockResolvedValue({
        filename: "execution_context.md",
        content: null,
        error: null,
        exists: false,
      });

      const { result } = renderHook(() => useExecutionContext("/project"));

      await act(async () => {
        useSessionStore.setState({
          status: "active",
          isDashboardActive: true,
          fetchSessionFile: mockFetchSessionFile,
        });
      });

      await flushMicrotasks();
      await flushMicrotasks();

      expect(result.current.content).toBeNull();
      expect(result.current.isActive).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe("file read error", () => {
    it("sets error when fetch fails with no previous content", async () => {
      mockFetchSessionFile.mockRejectedValue(new Error("Disk error"));

      const { result } = renderHook(() => useExecutionContext("/project"));

      await act(async () => {
        useSessionStore.setState({
          status: "active",
          isDashboardActive: true,
          fetchSessionFile: mockFetchSessionFile,
        });
      });
      await flushMicrotasks();
      await flushMicrotasks();

      expect(result.current.error).toBe("Disk error");
      expect(result.current.content).toBeNull();
    });
  });

  describe("session-change event listener", () => {
    it("registers a listener for session-change events", async () => {
      renderHook(() => useExecutionContext("/project"));

      await flushMicrotasks();

      expect(listeners.has("session-change")).toBe(true);
    });

    it("cleans up listener on unmount", async () => {
      const { unmount } = renderHook(() =>
        useExecutionContext("/project"),
      );

      await flushMicrotasks();
      expect(listeners.has("session-change")).toBe(true);

      unmount();
      expect(mockUnlisten).toHaveBeenCalled();
    });
  });

  describe("when session becomes inactive", () => {
    it("resets state to initial values", async () => {
      const content = "## Patterns\n- P1\n";
      mockFetchSessionFile.mockResolvedValue({
        filename: "execution_context.md",
        content,
        error: null,
        exists: true,
      });

      const { result } = renderHook(() => useExecutionContext("/project"));

      // Activate
      await act(async () => {
        useSessionStore.setState({
          status: "active",
          isDashboardActive: true,
          fetchSessionFile: mockFetchSessionFile,
        });
      });
      await flushMicrotasks();
      await flushMicrotasks();

      expect(result.current.content).toBe(content);

      // Deactivate
      await act(async () => {
        useSessionStore.setState({
          status: "inactive",
          isDashboardActive: false,
          fetchSessionFile: mockFetchSessionFile,
        });
      });

      expect(result.current.content).toBeNull();
      expect(result.current.isActive).toBe(false);
    });
  });
});

// --- Unit tests for computeNewLines ---

describe("computeNewLines", () => {
  it("marks all appended lines as new", () => {
    const prev = "Line 1\nLine 2";
    const curr = "Line 1\nLine 2\nLine 3\nLine 4";
    const result = _computeNewLines(prev, curr);
    expect(result.has(2)).toBe(true);
    expect(result.has(3)).toBe(true);
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(false);
  });

  it("marks modified lines as new", () => {
    const prev = "Line 1\nLine 2\nLine 3";
    const curr = "Line 1\nChanged\nLine 3";
    const result = _computeNewLines(prev, curr);
    expect(result.has(1)).toBe(true);
    expect(result.has(0)).toBe(false);
    expect(result.has(2)).toBe(false);
  });

  it("returns empty set when content is identical", () => {
    const content = "Same\nContent";
    const result = _computeNewLines(content, content);
    expect(result.size).toBe(0);
  });

  it("handles first diff in the middle with appended lines", () => {
    const prev = "A\nB\nC";
    const curr = "A\nB\nX\nY\nZ";
    const result = _computeNewLines(prev, curr);
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
    expect(result.has(3)).toBe(true);
    expect(result.has(4)).toBe(true);
  });

  it("handles empty previous content", () => {
    const prev = "";
    const curr = "New line";
    const result = _computeNewLines(prev, curr);
    expect(result.has(0)).toBe(true);
  });
});
