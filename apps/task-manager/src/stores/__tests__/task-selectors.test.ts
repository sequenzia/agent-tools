import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import {
  useTasksData,
  useTasksLoading,
  useTasksError,
  useLockedTaskIds,
  useFetchTasks,
  useTaskCount,
  useStalePaths,
} from "../task-selectors";
import { useTaskStore } from "../task-store";
import type { TasksByStatus, TaskWithPath } from "../../services/task-service";

// Mock api-client to avoid import errors in task-store
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({
    tasks: null,
    isLoading: false,
    error: null,
    parseErrors: [],
    stalePaths: new Set(),
    lockedTaskIds: new Set(),
    pendingMoves: new Map(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeTaskWithPath(
  id: number,
  title: string,
  status: string,
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: `Desc for ${title}`,
      status: status as TaskWithPath["task"]["status"],
      metadata: {},
    },
    filePath: `/project/.agents/tasks/${status}/group/task-${id}.json`,
    mtimeMs: Date.now(),
  };
}

function makeTasksByStatus(counts: {
  backlog?: number;
  pending?: number;
  in_progress?: number;
  completed?: number;
}): TasksByStatus {
  return {
    backlog: Array.from({ length: counts.backlog ?? 0 }, (_, i) =>
      makeTaskWithPath(i + 1, `Backlog ${i}`, "backlog"),
    ),
    pending: Array.from({ length: counts.pending ?? 0 }, (_, i) =>
      makeTaskWithPath(100 + i, `Pending ${i}`, "pending"),
    ),
    in_progress: Array.from({ length: counts.in_progress ?? 0 }, (_, i) =>
      makeTaskWithPath(200 + i, `InProgress ${i}`, "in_progress"),
    ),
    completed: Array.from({ length: counts.completed ?? 0 }, (_, i) =>
      makeTaskWithPath(300 + i, `Completed ${i}`, "completed"),
    ),
    errors: [],
  };
}

describe("task-selectors", () => {
  describe("useTasksData", () => {
    it("returns null when no tasks loaded", () => {
      const { result } = renderHook(() => useTasksData());
      expect(result.current).toBeNull();
    });

    it("returns tasks when loaded", () => {
      const tasks = makeTasksByStatus({ pending: 3 });
      useTaskStore.setState({ tasks });

      const { result } = renderHook(() => useTasksData());
      expect(result.current).toBe(tasks);
    });
  });

  describe("useTasksLoading", () => {
    it("returns false by default", () => {
      const { result } = renderHook(() => useTasksLoading());
      expect(result.current).toBe(false);
    });

    it("returns true when loading", () => {
      useTaskStore.setState({ isLoading: true });
      const { result } = renderHook(() => useTasksLoading());
      expect(result.current).toBe(true);
    });
  });

  describe("useTasksError", () => {
    it("returns null by default", () => {
      const { result } = renderHook(() => useTasksError());
      expect(result.current).toBeNull();
    });

    it("returns error message when set", () => {
      useTaskStore.setState({ error: "Failed to load" });
      const { result } = renderHook(() => useTasksError());
      expect(result.current).toBe("Failed to load");
    });
  });

  describe("useLockedTaskIds", () => {
    it("returns empty set by default", () => {
      const { result } = renderHook(() => useLockedTaskIds());
      expect(result.current.size).toBe(0);
    });

    it("returns locked IDs when set", () => {
      const locked = new Set(["1", "2", "3"]);
      useTaskStore.setState({ lockedTaskIds: locked });
      const { result } = renderHook(() => useLockedTaskIds());
      expect(result.current.size).toBe(3);
      expect(result.current.has("1")).toBe(true);
    });
  });

  describe("useFetchTasks", () => {
    it("returns a function", () => {
      const { result } = renderHook(() => useFetchTasks());
      expect(typeof result.current).toBe("function");
    });
  });

  describe("useTaskCount", () => {
    it("returns 0 when no tasks loaded", () => {
      const { result } = renderHook(() => useTaskCount());
      expect(result.current).toBe(0);
    });

    it("returns total count across all statuses", () => {
      const tasks = makeTasksByStatus({
        backlog: 5,
        pending: 10,
        in_progress: 3,
        completed: 20,
      });
      useTaskStore.setState({ tasks });

      const { result } = renderHook(() => useTaskCount());
      expect(result.current).toBe(38);
    });
  });

  describe("useStalePaths", () => {
    it("returns empty set by default", () => {
      const { result } = renderHook(() => useStalePaths());
      expect(result.current.size).toBe(0);
    });

    it("returns stale paths when set", () => {
      const stale = new Set(["/path/1.json", "/path/2.json"]);
      useTaskStore.setState({ stalePaths: stale });
      const { result } = renderHook(() => useStalePaths());
      expect(result.current.size).toBe(2);
    });
  });
});
