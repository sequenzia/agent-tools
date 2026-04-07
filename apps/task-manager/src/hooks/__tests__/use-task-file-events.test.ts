import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useTaskFileEvents } from "../use-task-file-events";
import { useTaskStore } from "../../stores/task-store";
import type { TasksByStatus } from "../../services/task-service";

// --- Mock api-client ---

type ListenCallback = (payload: unknown) => void;
const listeners = new Map<string, ListenCallback>();

vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: {
    on: vi.fn((eventName: string, callback: ListenCallback) => {
      listeners.set(eventName, callback);
      return () => {
        listeners.delete(eventName);
      };
    }),
    send: vi.fn(),
    connected: vi.fn(() => true),
    close: vi.fn(),
  },
}));

import { api } from "../../services/api-client";
const mockGet = vi.mocked(api.get);

// --- Mock task-service (to avoid import issues in task-store) ---

vi.mock("../../services/task-service", () => ({
  loadTasks: vi.fn(),
  STATUS_ORDER: ["backlog", "pending", "in_progress", "completed"],
}));

function emptyTasks(): TasksByStatus {
  return { backlog: [], pending: [], in_progress: [], completed: [], errors: [] };
}

function emitEvent(eventName: string, payload: unknown) {
  const callback = listeners.get(eventName);
  if (callback) {
    callback(payload);
  }
}

/**
 * Setup the hook with listeners ready. Call this at the start of each test.
 */
async function setupHook(projectPath: string = "/project") {
  const hookResult = renderHook(() => useTaskFileEvents(projectPath));

  // Flush the async listen() setup: the mock listen() is async so we need
  // to let the microtasks complete for the listener to be registered.
  await act(async () => {
    // just await microtask
  });

  return hookResult;
}

/**
 * Fire the debounce timer and wait for all async processing to complete.
 * Uses real timers temporarily to avoid fake timer deadlocks.
 */
async function triggerFlush() {
  // First, fire the debounce timer
  vi.advanceTimersByTime(60);

  // Switch to real timers so Promise resolution works normally
  vi.useRealTimers();

  // Wait for all microtasks (invoke calls, Promise.all, applyBatch)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // Switch back to fake timers for the next operation
  vi.useFakeTimers();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  listeners.clear();
  useTaskStore.setState({
    tasks: emptyTasks(),
    isLoading: false,
    error: null,
    parseErrors: [],
    stalePaths: new Set(),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useTaskFileEvents", () => {
  describe("connection lifecycle", () => {
    it("registers event listeners when projectPath is provided", async () => {
      await setupHook("/project");

      expect(listeners.has("task-file-change")).toBe(true);
      expect(listeners.has("task-watch-disconnected")).toBe(true);
      expect(listeners.has("task-watch-error")).toBe(true);
    });

    it("does not register listeners when projectPath is null", async () => {
      renderHook(() => useTaskFileEvents(null));
      await act(async () => {});

      expect(listeners.size).toBe(0);
    });

    it("cleans up listeners on unmount", async () => {
      const hookResult = await setupHook("/project");

      expect(listeners.size).toBe(3);

      hookResult.unmount();

      expect(listeners.size).toBe(0);
    });

    it("returns connected state initially", async () => {
      const { result } = await setupHook("/project");

      expect(result.current.isConnected).toBe(true);
      expect(result.current.lastError).toBeNull();
    });
  });

  describe("create events", () => {
    it("adds a new task to the store when file is created", async () => {
      mockGet.mockResolvedValueOnce({
        type: "ok",
        task: {
          id: 1,
          title: "New Task",
          description: "Created via watcher",
          status: "pending",
        },
        file_path: "/project/.agents/tasks/pending/group/1.json",
      });

      await setupHook("/project");

      emitEvent("task-file-change", {
        events: [
          {
            kind: "create",
            path: "/project/.agents/tasks/pending/group/1.json",
            project_path: "/project",
          },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.tasks?.pending[0].task.title).toBe("New Task");
    });
  });

  describe("modify events", () => {
    it("updates an existing task when file is modified", async () => {
      const fp = "/project/.agents/tasks/pending/group/1.json";
      const tasks = emptyTasks();
      tasks.pending = [
        {
          task: {
            id: 1,
            title: "Original Title",
            description: "Original",
            status: "pending",
          },
          filePath: fp,
        },
      ];
      useTaskStore.setState({ tasks });

      mockGet.mockResolvedValueOnce({
        type: "ok",
        task: {
          id: 1,
          title: "Updated Title",
          description: "Updated",
          status: "pending",
        },
        file_path: fp,
      });

      await setupHook("/project");

      emitEvent("task-file-change", {
        events: [
          { kind: "modify", path: fp, project_path: "/project" },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.tasks?.pending[0].task.title).toBe("Updated Title");
    });

    it("marks task as stale when re-read fails on modify", async () => {
      const fp = "/project/.agents/tasks/pending/group/1.json";
      const tasks = emptyTasks();
      tasks.pending = [
        {
          task: { id: 1, title: "Task", description: "Desc", status: "pending" },
          filePath: fp,
        },
      ];
      useTaskStore.setState({ tasks });

      mockGet.mockRejectedValueOnce(new Error("Read failed"));

      await setupHook("/project");

      emitEvent("task-file-change", {
        events: [
          { kind: "modify", path: fp, project_path: "/project" },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      expect(useTaskStore.getState().stalePaths.has(fp)).toBe(true);
    });
  });

  describe("delete events", () => {
    it("removes a task from the store when file is deleted", async () => {
      const fp = "/project/.agents/tasks/pending/group/1.json";
      const tasks = emptyTasks();
      tasks.pending = [
        {
          task: { id: 1, title: "Task", description: "Desc", status: "pending" },
          filePath: fp,
        },
      ];
      useTaskStore.setState({ tasks });

      await setupHook("/project");

      emitEvent("task-file-change", {
        events: [
          { kind: "delete", path: fp, project_path: "/project" },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      expect(useTaskStore.getState().tasks?.pending).toHaveLength(0);
    });
  });

  describe("status moves (file events for moves)", () => {
    it("moves a task between columns when status changes in JSON", async () => {
      const fp = "/project/.agents/tasks/pending/group/1.json";
      const tasks = emptyTasks();
      tasks.pending = [
        {
          task: { id: 1, title: "Task", description: "Desc", status: "pending" },
          filePath: fp,
        },
      ];
      useTaskStore.setState({ tasks });

      const newFp = "/project/.agents/tasks/in-progress/group/1.json";
      mockGet.mockResolvedValueOnce({
        type: "ok",
        task: {
          id: 1,
          title: "Task",
          description: "Desc",
          status: "in_progress",
        },
        file_path: newFp,
      });

      await setupHook("/project");

      // The watcher emits a delete for the old path and a create for the new path
      emitEvent("task-file-change", {
        events: [
          { kind: "delete", path: fp, project_path: "/project" },
          { kind: "create", path: newFp, project_path: "/project" },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(0);
      expect(state.tasks?.in_progress).toHaveLength(1);
    });
  });

  describe("event filtering", () => {
    it("ignores events for a different project path", async () => {
      await setupHook("/project");

      emitEvent("task-file-change", {
        events: [
          {
            kind: "create",
            path: "/other/.agents/tasks/pending/group/1.json",
            project_path: "/other",
          },
        ],
        project_path: "/other",
      });

      await triggerFlush();

      // invoke should not have been called since we filter by project_path
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe("deduplication", () => {
    it("deduplicates events for the same file within a batch", async () => {
      const fp = "/project/.agents/tasks/pending/group/1.json";
      mockGet.mockResolvedValueOnce({
        type: "ok",
        task: { id: 1, title: "Task", description: "Desc", status: "pending" },
        file_path: fp,
      });

      await setupHook("/project");

      // Emit the same event twice in one batch
      emitEvent("task-file-change", {
        events: [
          { kind: "modify", path: fp, project_path: "/project" },
          { kind: "modify", path: fp, project_path: "/project" },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      // Should only invoke read_task once due to dedup in the hook
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe("debouncing", () => {
    it("batches multiple event emissions within the debounce window", async () => {
      const fp1 = "/project/.agents/tasks/pending/group/1.json";
      const fp2 = "/project/.agents/tasks/pending/group/2.json";

      mockGet
        .mockResolvedValueOnce({
          type: "ok",
          task: { id: 1, title: "Task 1", description: "Desc", status: "pending" },
          file_path: fp1,
        })
        .mockResolvedValueOnce({
          type: "ok",
          task: { id: 2, title: "Task 2", description: "Desc", status: "pending" },
          file_path: fp2,
        });

      await setupHook("/project");

      // Track store updates
      let updateCount = 0;
      const unsub = useTaskStore.subscribe(() => {
        updateCount++;
      });

      // Emit two separate batches quickly (within the debounce window)
      emitEvent("task-file-change", {
        events: [
          { kind: "create", path: fp1, project_path: "/project" },
        ],
        project_path: "/project",
      });

      emitEvent("task-file-change", {
        events: [
          { kind: "create", path: fp2, project_path: "/project" },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      unsub();

      // Both events should be processed in a single applyBatch call
      expect(updateCount).toBe(1);
      expect(useTaskStore.getState().tasks?.pending).toHaveLength(2);
    });
  });

  describe("disconnection handling", () => {
    it("attempts reconnection after watch disconnection", async () => {
      const { ws } = await import("../../services/api-client");
      const mockWsSend = vi.mocked(ws.send);

      await setupHook("/project");

      emitEvent("task-watch-disconnected", {
        message: "Watched directory removed",
        project_path: "/project",
      });

      // Advance past the reconnection delay (2000ms)
      vi.advanceTimersByTime(2100);

      expect(mockWsSend).toHaveBeenCalledWith("watch:start", {
        projectPaths: ["/project"],
      });
    });
  });

  describe("consistency after burst", () => {
    it("produces consistent state after a burst of 20 events", async () => {
      const taskData: Array<{ id: number; fp: string }> = [];
      for (let i = 1; i <= 20; i++) {
        taskData.push({
          id: i,
          fp: `/project/.agents/tasks/pending/group/${i}.json`,
        });
      }

      // Set up mock responses for all 20 re-reads
      for (const t of taskData) {
        mockGet.mockResolvedValueOnce({
          type: "ok",
          task: {
            id: t.id,
            title: `Task ${t.id}`,
            description: `Desc ${t.id}`,
            status: "pending",
          },
          file_path: t.fp,
        });
      }

      await setupHook("/project");

      // Emit all 20 events in one batch
      emitEvent("task-file-change", {
        events: taskData.map((t) => ({
          kind: "create" as const,
          path: t.fp,
          project_path: "/project",
        })),
        project_path: "/project",
      });

      await triggerFlush();

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(20);
    });
  });

  describe("out-of-order events", () => {
    it("handles delete before create for a rename scenario", async () => {
      const oldFp = "/project/.agents/tasks/pending/group/1.json";
      const newFp = "/project/.agents/tasks/in-progress/group/1.json";
      const tasks = emptyTasks();
      tasks.pending = [
        {
          task: { id: 1, title: "Task", description: "Desc", status: "pending" },
          filePath: oldFp,
        },
      ];
      useTaskStore.setState({ tasks });

      mockGet.mockResolvedValueOnce({
        type: "ok",
        task: { id: 1, title: "Task", description: "Desc", status: "in_progress" },
        file_path: newFp,
      });

      await setupHook("/project");

      // Delete event arrives before create (out of order)
      emitEvent("task-file-change", {
        events: [
          { kind: "delete", path: oldFp, project_path: "/project" },
          { kind: "create", path: newFp, project_path: "/project" },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(0);
      expect(state.tasks?.in_progress).toHaveLength(1);
    });
  });

  describe("stale events", () => {
    it("ignores create event for a file that fails to read (no task on disk)", async () => {
      mockGet.mockRejectedValueOnce(new Error("File not found"));

      await setupHook("/project");

      emitEvent("task-file-change", {
        events: [
          {
            kind: "create",
            path: "/project/.agents/tasks/pending/group/ghost.json",
            project_path: "/project",
          },
        ],
        project_path: "/project",
      });

      await triggerFlush();

      // No task should be added and no stale marker (create, not modify)
      expect(useTaskStore.getState().tasks?.pending).toHaveLength(0);
      expect(useTaskStore.getState().stalePaths.size).toBe(0);
    });
  });
});
