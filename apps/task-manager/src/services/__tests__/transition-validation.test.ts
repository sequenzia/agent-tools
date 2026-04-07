import { describe, it, expect } from "vitest";
import {
  validateTransition,
  getTaskBoardColumn,
  COLUMN_TO_STATUS,
} from "../transition-validation";
import type { TaskWithPath, TasksByStatus } from "../task-service";

// --- Test helpers ---

function makeTaskWithPath(
  id: number | string,
  status: string,
  extra?: {
    blocked_by?: (number | string)[];
    last_result?: string;
  },
): TaskWithPath {
  return {
    task: {
      id,
      title: `Task ${id}`,
      description: `Description for task ${id}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
      blocked_by: extra?.blocked_by,
      ...(extra?.last_result !== undefined
        ? { last_result: extra.last_result }
        : {}),
    },
    filePath: `/project/.agents/tasks/${status}/group/task-${id}.json`,
    mtimeMs: 1700000000000 + id,
  };
}

function makeTasksByStatus(overrides?: Partial<TasksByStatus>): TasksByStatus {
  return {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    errors: [],
    ...overrides,
  };
}

// --- validateTransition tests ---

describe("validateTransition", () => {
  it("allows same-column as no-op", () => {
    const task = makeTaskWithPath(1, "pending");
    const allTasks = makeTasksByStatus();
    const result = validateTransition(task, "pending", "pending", allTasks);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("Same column");
  });

  it("rejects move to blocked column (derived state)", () => {
    const task = makeTaskWithPath(1, "pending");
    const allTasks = makeTasksByStatus();
    const result = validateTransition(task, "pending", "blocked", allTasks);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("derived state");
  });

  it("rejects move to failed column (derived state)", () => {
    const task = makeTaskWithPath(1, "pending");
    const allTasks = makeTasksByStatus();
    const result = validateTransition(task, "pending", "failed", allTasks);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("derived state");
  });

  it("rejects move to in_progress when blocked_by tasks are not all completed", () => {
    const task = makeTaskWithPath(2, "pending", { blocked_by: [1] });
    const allTasks = makeTasksByStatus({
      pending: [makeTaskWithPath(1, "pending")],
    });
    const result = validateTransition(
      task,
      "pending",
      "in_progress",
      allTasks,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Blocked by unresolved dependencies");
    expect(result.reason).toContain("1");
  });

  it("allows move to in_progress when all blocked_by tasks are completed", () => {
    const task = makeTaskWithPath(2, "pending", { blocked_by: [1] });
    const allTasks = makeTasksByStatus({
      completed: [makeTaskWithPath(1, "completed")],
    });
    const result = validateTransition(
      task,
      "pending",
      "in_progress",
      allTasks,
    );
    expect(result.allowed).toBe(true);
  });

  it("allows move to in_progress when task has no blocked_by", () => {
    const task = makeTaskWithPath(1, "pending");
    const allTasks = makeTasksByStatus();
    const result = validateTransition(
      task,
      "pending",
      "in_progress",
      allTasks,
    );
    expect(result.allowed).toBe(true);
  });

  it("allows valid transition from backlog to pending", () => {
    const task = makeTaskWithPath(1, "backlog");
    const allTasks = makeTasksByStatus();
    const result = validateTransition(task, "backlog", "pending", allTasks);
    expect(result.allowed).toBe(true);
  });

  it("allows valid transition from in_progress to completed", () => {
    const task = makeTaskWithPath(1, "in_progress");
    const allTasks = makeTasksByStatus();
    const result = validateTransition(
      task,
      "in_progress",
      "completed",
      allTasks,
    );
    expect(result.allowed).toBe(true);
  });

  it("rejects move to in_progress with multiple unresolved deps", () => {
    const task = makeTaskWithPath(3, "pending", { blocked_by: [1, 2] });
    const allTasks = makeTasksByStatus({
      completed: [makeTaskWithPath(1, "completed")],
      pending: [makeTaskWithPath(2, "pending")],
    });
    const result = validateTransition(
      task,
      "pending",
      "in_progress",
      allTasks,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("2");
  });

  it("handles string task IDs in blocked_by check", () => {
    const task = makeTaskWithPath("task-B", "pending", {
      blocked_by: ["task-A"],
    });
    const allTasks = makeTasksByStatus({
      completed: [makeTaskWithPath("task-A", "completed")],
    });
    const result = validateTransition(
      task,
      "pending",
      "in_progress",
      allTasks,
    );
    expect(result.allowed).toBe(true);
  });
});

// --- getTaskBoardColumn tests ---

describe("getTaskBoardColumn", () => {
  it("returns backlog for backlog tasks", () => {
    const task = makeTaskWithPath(1, "backlog");
    const allTasks = makeTasksByStatus();
    expect(getTaskBoardColumn(task, allTasks)).toBe("backlog");
  });

  it("returns in_progress for in_progress tasks", () => {
    const task = makeTaskWithPath(1, "in_progress");
    const allTasks = makeTasksByStatus();
    expect(getTaskBoardColumn(task, allTasks)).toBe("in_progress");
  });

  it("returns completed for completed tasks", () => {
    const task = makeTaskWithPath(1, "completed");
    const allTasks = makeTasksByStatus();
    expect(getTaskBoardColumn(task, allTasks)).toBe("completed");
  });

  it("returns pending for unblocked pending tasks", () => {
    const task = makeTaskWithPath(1, "pending");
    const allTasks = makeTasksByStatus();
    expect(getTaskBoardColumn(task, allTasks)).toBe("pending");
  });

  it("returns blocked for pending tasks with unresolved deps", () => {
    const task = makeTaskWithPath(2, "pending", { blocked_by: [1] });
    const allTasks = makeTasksByStatus({
      pending: [makeTaskWithPath(1, "pending")],
    });
    expect(getTaskBoardColumn(task, allTasks)).toBe("blocked");
  });

  it("returns failed for pending tasks with FAIL last_result", () => {
    const task = makeTaskWithPath(1, "pending", { last_result: "FAIL" });
    const allTasks = makeTasksByStatus();
    expect(getTaskBoardColumn(task, allTasks)).toBe("failed");
  });

  it("returns failed for pending tasks with PARTIAL last_result", () => {
    const task = makeTaskWithPath(1, "pending", { last_result: "PARTIAL" });
    const allTasks = makeTasksByStatus();
    expect(getTaskBoardColumn(task, allTasks)).toBe("failed");
  });

  it("returns pending for pending tasks with PASS last_result", () => {
    const task = makeTaskWithPath(1, "pending", { last_result: "PASS" });
    const allTasks = makeTasksByStatus();
    expect(getTaskBoardColumn(task, allTasks)).toBe("pending");
  });

  it("prioritizes failed over blocked", () => {
    const task = makeTaskWithPath(2, "pending", {
      blocked_by: [1],
      last_result: "FAIL",
    });
    const allTasks = makeTasksByStatus({
      pending: [makeTaskWithPath(1, "pending")],
    });
    expect(getTaskBoardColumn(task, allTasks)).toBe("failed");
  });
});

// --- COLUMN_TO_STATUS mapping tests ---

describe("COLUMN_TO_STATUS", () => {
  it("maps backlog to backlog", () => {
    expect(COLUMN_TO_STATUS.backlog).toBe("backlog");
  });

  it("maps pending to pending", () => {
    expect(COLUMN_TO_STATUS.pending).toBe("pending");
  });

  it("maps in_progress to in_progress", () => {
    expect(COLUMN_TO_STATUS.in_progress).toBe("in_progress");
  });

  it("maps completed to completed", () => {
    expect(COLUMN_TO_STATUS.completed).toBe("completed");
  });

  it("does not map derived columns", () => {
    expect(COLUMN_TO_STATUS.blocked).toBeUndefined();
    expect(COLUMN_TO_STATUS.failed).toBeUndefined();
  });
});
