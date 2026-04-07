import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTaskStore } from "../task-store";

// Mock the task service
vi.mock("../../services/task-service", () => ({
  loadTasks: vi.fn(),
  STATUS_ORDER: ["backlog", "pending", "in_progress", "completed"],
}));

import { loadTasks } from "../../services/task-service";
import type { TasksByStatus, TaskWithPath } from "../../services/task-service";

const mockLoadTasks = vi.mocked(loadTasks);

function emptyTasks(): TasksByStatus {
  return { backlog: [], pending: [], in_progress: [], completed: [], errors: [] };
}

function makeTaskWithPath(
  id: number | string,
  status: string,
  filePath: string,
  title = `Task ${id}`,
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: `Description for ${id}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
    },
    filePath,
    mtimeMs: 1700000000000 + (typeof id === "number" ? id : 0),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({
    tasks: null,
    isLoading: false,
    error: null,
    parseErrors: [],
    stalePaths: new Set(),
  });
});

describe("useTaskStore", () => {
  describe("initial state", () => {
    it("has null tasks by default", () => {
      const state = useTaskStore.getState();
      expect(state.tasks).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.parseErrors).toEqual([]);
      expect(state.stalePaths.size).toBe(0);
    });
  });

  describe("fetchTasks", () => {
    it("loads tasks and updates state", async () => {
      const result = emptyTasks();
      result.pending = [makeTaskWithPath(1, "pending", "/project/.agents/tasks/pending/group/1.json")];
      mockLoadTasks.mockResolvedValueOnce(result);

      await useTaskStore.getState().fetchTasks("/project");

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.stalePaths.size).toBe(0);
    });

    it("clears stale paths on full load", async () => {
      useTaskStore.setState({ stalePaths: new Set(["/some/path.json"]) });
      mockLoadTasks.mockResolvedValueOnce(emptyTasks());

      await useTaskStore.getState().fetchTasks("/project");

      expect(useTaskStore.getState().stalePaths.size).toBe(0);
    });

    it("sets error on failure", async () => {
      mockLoadTasks.mockRejectedValueOnce(new Error("IPC failed"));

      await useTaskStore.getState().fetchTasks("/project");

      const state = useTaskStore.getState();
      expect(state.error).toBe("IPC failed");
      expect(state.tasks).toBeNull();
    });

    it("handles string errors", async () => {
      mockLoadTasks.mockRejectedValueOnce("Network timeout");

      await useTaskStore.getState().fetchTasks("/project");

      expect(useTaskStore.getState().error).toBe("Network timeout");
    });

    it("handles unknown error types", async () => {
      mockLoadTasks.mockRejectedValueOnce(42);

      await useTaskStore.getState().fetchTasks("/project");

      expect(useTaskStore.getState().error).toBe("Failed to load tasks");
    });
  });

  describe("clearTasks", () => {
    it("resets all task state", () => {
      useTaskStore.setState({
        tasks: emptyTasks(),
        isLoading: true,
        error: "old error",
        parseErrors: [{ filePath: "/f.json", error: "bad" }],
        stalePaths: new Set(["/stale.json"]),
      });

      useTaskStore.getState().clearTasks();

      const state = useTaskStore.getState();
      expect(state.tasks).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.parseErrors).toEqual([]);
      expect(state.stalePaths.size).toBe(0);
    });
  });

  describe("upsertTask", () => {
    it("adds a new task to the correct status group", () => {
      useTaskStore.setState({ tasks: emptyTasks() });
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");

      useTaskStore.getState().upsertTask(twp);

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.tasks?.pending[0].task.id).toBe(1);
    });

    it("initializes tasks if null", () => {
      expect(useTaskStore.getState().tasks).toBeNull();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");

      useTaskStore.getState().upsertTask(twp);

      expect(useTaskStore.getState().tasks?.pending).toHaveLength(1);
    });

    it("moves task between status groups on status change", () => {
      const tasks = emptyTasks();
      tasks.pending = [makeTaskWithPath(1, "pending", "/project/pending/group/1.json")];
      useTaskStore.setState({ tasks });

      // Task moved to in_progress
      const updated = makeTaskWithPath(1, "in_progress", "/project/pending/group/1.json");
      useTaskStore.getState().upsertTask(updated);

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(0);
      expect(state.tasks?.in_progress).toHaveLength(1);
    });

    it("updates existing task in place", () => {
      const tasks = emptyTasks();
      tasks.pending = [makeTaskWithPath(1, "pending", "/project/pending/group/1.json")];
      useTaskStore.setState({ tasks });

      const updated = makeTaskWithPath(1, "pending", "/project/pending/group/1.json", "Updated Title");
      useTaskStore.getState().upsertTask(updated);

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.tasks?.pending[0].task.title).toBe("Updated Title");
    });

    it("clears stale indicator for the upserted file path", () => {
      const fp = "/project/pending/group/1.json";
      useTaskStore.setState({
        tasks: emptyTasks(),
        stalePaths: new Set([fp]),
      });

      useTaskStore.getState().upsertTask(makeTaskWithPath(1, "pending", fp));

      expect(useTaskStore.getState().stalePaths.has(fp)).toBe(false);
    });
  });

  describe("removeTaskByPath", () => {
    it("removes a task from its status group", () => {
      const tasks = emptyTasks();
      const fp = "/project/pending/group/1.json";
      tasks.pending = [makeTaskWithPath(1, "pending", fp)];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().removeTaskByPath(fp);

      expect(useTaskStore.getState().tasks?.pending).toHaveLength(0);
    });

    it("is a no-op when tasks are null", () => {
      useTaskStore.getState().removeTaskByPath("/nonexistent.json");
      expect(useTaskStore.getState().tasks).toBeNull();
    });

    it("is a no-op when file path not found", () => {
      const tasks = emptyTasks();
      tasks.pending = [makeTaskWithPath(1, "pending", "/project/pending/group/1.json")];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().removeTaskByPath("/nonexistent.json");

      expect(useTaskStore.getState().tasks?.pending).toHaveLength(1);
    });

    it("clears stale indicator for the removed file path", () => {
      const fp = "/project/pending/group/1.json";
      const tasks = emptyTasks();
      tasks.pending = [makeTaskWithPath(1, "pending", fp)];
      useTaskStore.setState({ tasks, stalePaths: new Set([fp]) });

      useTaskStore.getState().removeTaskByPath(fp);

      expect(useTaskStore.getState().stalePaths.has(fp)).toBe(false);
    });
  });

  describe("markStale", () => {
    it("adds a file path to stalePaths", () => {
      const fp = "/project/pending/group/1.json";
      useTaskStore.getState().markStale(fp);
      expect(useTaskStore.getState().stalePaths.has(fp)).toBe(true);
    });

    it("is idempotent", () => {
      const fp = "/project/pending/group/1.json";
      useTaskStore.getState().markStale(fp);
      useTaskStore.getState().markStale(fp);
      expect(useTaskStore.getState().stalePaths.size).toBe(1);
    });
  });

  describe("clearStale", () => {
    it("removes a file path from stalePaths", () => {
      const fp = "/project/pending/group/1.json";
      useTaskStore.setState({ stalePaths: new Set([fp]) });

      useTaskStore.getState().clearStale(fp);

      expect(useTaskStore.getState().stalePaths.has(fp)).toBe(false);
    });

    it("is a no-op when path not stale", () => {
      useTaskStore.getState().clearStale("/nonexistent.json");
      expect(useTaskStore.getState().stalePaths.size).toBe(0);
    });
  });

  describe("applyBatch", () => {
    it("applies multiple mutations in a single state update", () => {
      useTaskStore.setState({ tasks: emptyTasks() });

      const twp1 = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      const twp2 = makeTaskWithPath(2, "in_progress", "/project/in-progress/group/2.json");

      useTaskStore.getState().applyBatch([
        { type: "upsert", taskWithPath: twp1 },
        { type: "upsert", taskWithPath: twp2 },
      ]);

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.tasks?.in_progress).toHaveLength(1);
    });

    it("handles mixed upsert and remove in one batch", () => {
      const tasks = emptyTasks();
      const fpRemove = "/project/pending/group/1.json";
      tasks.pending = [makeTaskWithPath(1, "pending", fpRemove)];
      useTaskStore.setState({ tasks });

      const twpAdd = makeTaskWithPath(2, "completed", "/project/completed/group/2.json");

      useTaskStore.getState().applyBatch([
        { type: "remove", filePath: fpRemove },
        { type: "upsert", taskWithPath: twpAdd },
      ]);

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(0);
      expect(state.tasks?.completed).toHaveLength(1);
    });

    it("handles stale mutations in batch", () => {
      useTaskStore.setState({ tasks: emptyTasks() });
      const fp = "/project/pending/group/1.json";

      useTaskStore.getState().applyBatch([{ type: "stale", filePath: fp }]);

      expect(useTaskStore.getState().stalePaths.has(fp)).toBe(true);
    });

    it("upsert clears stale for the same path in batch", () => {
      const fp = "/project/pending/group/1.json";
      useTaskStore.setState({ tasks: emptyTasks(), stalePaths: new Set([fp]) });

      const twp = makeTaskWithPath(1, "pending", fp);
      useTaskStore.getState().applyBatch([{ type: "upsert", taskWithPath: twp }]);

      expect(useTaskStore.getState().stalePaths.has(fp)).toBe(false);
    });

    it("initializes tasks if null", () => {
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");

      useTaskStore.getState().applyBatch([{ type: "upsert", taskWithPath: twp }]);

      expect(useTaskStore.getState().tasks?.pending).toHaveLength(1);
    });

    it("handles empty batch", () => {
      const tasks = emptyTasks();
      useTaskStore.setState({ tasks });

      useTaskStore.getState().applyBatch([]);

      expect(useTaskStore.getState().tasks).toEqual(tasks);
    });

    it("processes 20 events into a single state update", () => {
      useTaskStore.setState({ tasks: emptyTasks() });

      const mutations: Array<{ type: "upsert"; taskWithPath: TaskWithPath }> = [];
      for (let i = 1; i <= 20; i++) {
        mutations.push({
          type: "upsert",
          taskWithPath: makeTaskWithPath(
            i,
            "pending",
            `/project/pending/group/${i}.json`,
          ),
        });
      }

      // Track how many times the store is updated
      let updateCount = 0;
      const unsub = useTaskStore.subscribe(() => {
        updateCount++;
      });

      useTaskStore.getState().applyBatch(mutations);

      unsub();

      // applyBatch calls set() once, so only 1 update
      expect(updateCount).toBe(1);
      expect(useTaskStore.getState().tasks?.pending).toHaveLength(20);
    });
  });
});
