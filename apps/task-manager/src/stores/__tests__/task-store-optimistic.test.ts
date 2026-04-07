import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTaskStore } from "../task-store";
import type { MoveSnapshot } from "../task-store";

// Mock the task service
vi.mock("../../services/task-service", () => ({
  loadTasks: vi.fn(),
  STATUS_ORDER: ["backlog", "pending", "in_progress", "completed"],
}));

import type { TasksByStatus, TaskWithPath } from "../../services/task-service";

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
    lockedTaskIds: new Set(),
    pendingMoves: new Map(),
  });
});

describe("useTaskStore optimistic moves", () => {
  describe("moveTaskOptimistic", () => {
    it("moves task to new status group immediately", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(0);
      expect(state.tasks?.in_progress).toHaveLength(1);
      expect(state.tasks?.in_progress[0].task.status).toBe("in_progress");
    });

    it("locks the task ID", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");

      expect(useTaskStore.getState().lockedTaskIds.has("1")).toBe(true);
    });

    it("stores a snapshot for rollback", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      const snapshot = useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");

      expect(snapshot.taskId).toBe("1");
      expect(snapshot.originalStatus).toBe("pending");
      expect(snapshot.targetStatus).toBe("in_progress");
      expect(snapshot.originalTask).toEqual(twp);
      expect(snapshot.originalFilePath).toBe("/project/pending/group/1.json");
      expect(typeof snapshot.timestamp).toBe("number");

      expect(useTaskStore.getState().pendingMoves.has("1")).toBe(true);
    });

    it("returns a valid MoveSnapshot", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(42, "backlog", "/project/backlog/group/42.json");
      tasks.backlog = [twp];
      useTaskStore.setState({ tasks });

      const snapshot: MoveSnapshot = useTaskStore.getState().moveTaskOptimistic(twp, "pending");

      expect(snapshot.taskId).toBe("42");
      expect(snapshot.originalStatus).toBe("backlog");
      expect(snapshot.targetStatus).toBe("pending");
    });

    it("performs optimistic update in a single state update", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      let updateCount = 0;
      const unsub = useTaskStore.subscribe(() => { updateCount++; });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");

      unsub();
      expect(updateCount).toBe(1);
    });
  });

  describe("confirmMove", () => {
    it("updates task with real data and unlocks", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");

      // Simulate IPC success with updated filePath and mtime
      const updatedTask: TaskWithPath = {
        task: { ...twp.task, status: "in_progress" },
        filePath: "/project/in_progress/group/1.json",
        mtimeMs: 1700000001000,
      };

      useTaskStore.getState().confirmMove("1", updatedTask);

      const state = useTaskStore.getState();
      expect(state.tasks?.in_progress).toHaveLength(1);
      expect(state.tasks?.in_progress[0].filePath).toBe("/project/in_progress/group/1.json");
      expect(state.tasks?.in_progress[0].mtimeMs).toBe(1700000001000);
      expect(state.lockedTaskIds.has("1")).toBe(false);
      expect(state.pendingMoves.has("1")).toBe(false);
    });

    it("clears pending move entry", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "completed");
      expect(useTaskStore.getState().pendingMoves.size).toBe(1);

      useTaskStore.getState().confirmMove("1", {
        task: { ...twp.task, status: "completed" },
        filePath: "/project/completed/group/1.json",
        mtimeMs: 1700000002000,
      });

      expect(useTaskStore.getState().pendingMoves.size).toBe(0);
    });
  });

  describe("rollbackMove", () => {
    it("restores task to original status and unlocks", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");

      // Verify task moved optimistically
      expect(useTaskStore.getState().tasks?.in_progress).toHaveLength(1);
      expect(useTaskStore.getState().tasks?.pending).toHaveLength(0);

      // Rollback
      useTaskStore.getState().rollbackMove("1");

      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.tasks?.pending[0].task.status).toBe("pending");
      expect(state.tasks?.in_progress).toHaveLength(0);
      expect(state.lockedTaskIds.has("1")).toBe(false);
      expect(state.pendingMoves.has("1")).toBe(false);
    });

    it("handles rollback when no snapshot exists (just unlocks)", () => {
      useTaskStore.setState({
        tasks: emptyTasks(),
        lockedTaskIds: new Set(["99"]),
      });

      useTaskStore.getState().rollbackMove("99");

      expect(useTaskStore.getState().lockedTaskIds.has("99")).toBe(false);
    });

    it("restores original task data exactly", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "backlog", "/project/backlog/group/1.json", "Original Title");
      tasks.backlog = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "pending");
      useTaskStore.getState().rollbackMove("1");

      const state = useTaskStore.getState();
      expect(state.tasks?.backlog).toHaveLength(1);
      expect(state.tasks?.backlog[0].task.title).toBe("Original Title");
      expect(state.tasks?.backlog[0].filePath).toBe("/project/backlog/group/1.json");
    });
  });

  describe("isTaskLocked", () => {
    it("returns true when task is locked", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");

      expect(useTaskStore.getState().isTaskLocked("1")).toBe(true);
    });

    it("returns false when task is not locked", () => {
      expect(useTaskStore.getState().isTaskLocked("1")).toBe(false);
    });

    it("returns false after confirm", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");
      useTaskStore.getState().confirmMove("1", {
        task: { ...twp.task, status: "in_progress" },
        filePath: "/project/in_progress/group/1.json",
        mtimeMs: 1700000001000,
      });

      expect(useTaskStore.getState().isTaskLocked("1")).toBe(false);
    });

    it("returns false after rollback", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");
      useTaskStore.getState().rollbackMove("1");

      expect(useTaskStore.getState().isTaskLocked("1")).toBe(false);
    });
  });

  describe("full optimistic cycle", () => {
    it("optimistic move -> IPC success -> confirm", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      // Step 1: Optimistic move
      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");
      let state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(0);
      expect(state.tasks?.in_progress).toHaveLength(1);
      expect(state.lockedTaskIds.has("1")).toBe(true);

      // Step 2: IPC succeeds, confirm
      useTaskStore.getState().confirmMove("1", {
        task: { ...twp.task, status: "in_progress" },
        filePath: "/project/in_progress/group/1.json",
        mtimeMs: 1700000099000,
      });
      state = useTaskStore.getState();
      expect(state.tasks?.in_progress).toHaveLength(1);
      expect(state.tasks?.in_progress[0].mtimeMs).toBe(1700000099000);
      expect(state.lockedTaskIds.has("1")).toBe(false);
      expect(state.pendingMoves.size).toBe(0);
    });

    it("optimistic move -> IPC failure -> rollback", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      // Step 1: Optimistic move
      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");
      expect(useTaskStore.getState().tasks?.in_progress).toHaveLength(1);

      // Step 2: IPC fails, rollback
      useTaskStore.getState().rollbackMove("1");
      const state = useTaskStore.getState();
      expect(state.tasks?.pending).toHaveLength(1);
      expect(state.tasks?.in_progress).toHaveLength(0);
      expect(state.lockedTaskIds.has("1")).toBe(false);
    });

    it("multiple concurrent optimistic moves on different tasks", () => {
      const tasks = emptyTasks();
      const twp1 = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      const twp2 = makeTaskWithPath(2, "backlog", "/project/backlog/group/2.json");
      tasks.pending = [twp1];
      tasks.backlog = [twp2];
      useTaskStore.setState({ tasks });

      // Move both tasks optimistically
      useTaskStore.getState().moveTaskOptimistic(twp1, "in_progress");
      useTaskStore.getState().moveTaskOptimistic(twp2, "pending");

      let state = useTaskStore.getState();
      expect(state.lockedTaskIds.size).toBe(2);
      expect(state.pendingMoves.size).toBe(2);
      expect(state.tasks?.in_progress).toHaveLength(1);

      // Confirm first, rollback second
      useTaskStore.getState().confirmMove("1", {
        task: { ...twp1.task, status: "in_progress" },
        filePath: "/project/in_progress/group/1.json",
        mtimeMs: 1700000099000,
      });
      useTaskStore.getState().rollbackMove("2");

      state = useTaskStore.getState();
      expect(state.lockedTaskIds.size).toBe(0);
      expect(state.pendingMoves.size).toBe(0);
      expect(state.tasks?.in_progress).toHaveLength(1);
      expect(state.tasks?.backlog).toHaveLength(1);
      expect(state.tasks?.backlog[0].task.id).toBe(2);
    });
  });

  describe("clearTasks resets optimistic state", () => {
    it("clears lockedTaskIds and pendingMoves", () => {
      const tasks = emptyTasks();
      const twp = makeTaskWithPath(1, "pending", "/project/pending/group/1.json");
      tasks.pending = [twp];
      useTaskStore.setState({ tasks });

      useTaskStore.getState().moveTaskOptimistic(twp, "in_progress");
      expect(useTaskStore.getState().lockedTaskIds.size).toBe(1);
      expect(useTaskStore.getState().pendingMoves.size).toBe(1);

      useTaskStore.getState().clearTasks();

      expect(useTaskStore.getState().lockedTaskIds.size).toBe(0);
      expect(useTaskStore.getState().pendingMoves.size).toBe(0);
    });
  });
});
