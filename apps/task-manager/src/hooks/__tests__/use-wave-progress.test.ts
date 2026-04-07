import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWaveProgress } from "../use-wave-progress";
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

describe("useWaveProgress", () => {
  describe("initial state", () => {
    it("returns inactive state when no project path", () => {
      const { result } = renderHook(() => useWaveProgress(null));

      expect(result.current.isActive).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.plan).toBeNull();
      expect(result.current.completionPct).toBe(0);
    });

    it("returns inactive state when session is inactive", () => {
      const { result } = renderHook(() =>
        useWaveProgress("/project"),
      );

      expect(result.current.isActive).toBe(false);
      expect(result.current.progress).toBeNull();
    });
  });

  describe("when session becomes active", () => {
    it("fetches progress and plan files", async () => {
      // Use real timers to avoid the infinite loop with setInterval + runAllTimersAsync
      mockFetchSessionFile.mockResolvedValue({
        filename: "progress.md",
        content: `# Execution Progress
Status: Executing
Wave: 1 of 3
Max Parallel: 5
Updated: 2026-04-06T14:00:00Z

## Active Tasks
- [101] Build service -- Executing

## Completed This Session
`,
        error: null,
        exists: true,
      });

      renderHook(() => useWaveProgress("/project"));

      // Activate session -- this triggers the initial fetch
      await act(async () => {
        useSessionStore.setState({
          status: "active",
          isDashboardActive: true,
        });
      });

      // Flush the promises from the initial fetch
      await flushMicrotasks();
      await flushMicrotasks();

      expect(mockFetchSessionFile).toHaveBeenCalledWith(
        "/project",
        "progress.md",
      );
      expect(mockFetchSessionFile).toHaveBeenCalledWith(
        "/project",
        "execution_plan.md",
      );
    });
  });

  describe("session-change event listener", () => {
    it("registers a listener for session-change events", async () => {
      renderHook(() => useWaveProgress("/project"));

      // Let the async listen() setup run
      await flushMicrotasks();

      expect(listeners.has("session-change")).toBe(true);
    });

    it("unlistens on unmount", async () => {
      const { unmount } = renderHook(() => useWaveProgress("/project"));

      await flushMicrotasks();

      unmount();
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it("ignores events from other projects", async () => {
      renderHook(() => useWaveProgress("/project"));

      await flushMicrotasks();

      const listener = listeners.get("session-change");
      expect(listener).toBeDefined();

      // Emit event for a different project
      act(() => {
        listener!({
          status: "active",
          project_path: "/other-project",
          session_path: "/other-project/.agents/sessions/__live_session__",
        });
      });

      // The store status should remain inactive since the event was for another project
      expect(useSessionStore.getState().status).toBe("inactive");
    });
  });

  describe("when session is null project", () => {
    it("does not set up event listener when projectPath is null", async () => {
      renderHook(() => useWaveProgress(null));

      await flushMicrotasks();

      expect(listeners.has("session-change")).toBe(false);
    });
  });
});
