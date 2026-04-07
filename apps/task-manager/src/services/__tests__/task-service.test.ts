import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadTasks,
  getTotalTaskCount,
  isEmptyTaskList,
  moveTask,
  updateTaskFields,
  ConflictError,
  STATUS_ORDER,
  STATUS_LABELS,
} from "../task-service";

// Mock api-client
vi.mock("../api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../api-client";
const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadTasks", () => {
  it("returns empty task groups when project has no tasks", async () => {
    mockGet.mockResolvedValueOnce({
      backlog: [],
      pending: [],
      in_progress: [],
      completed: [],
    });

    const result = await loadTasks("/test/project");

    expect(mockGet).toHaveBeenCalledWith("/api/tasks", {
      projectPath: "/test/project",
    });
    expect(result.backlog).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(result.in_progress).toEqual([]);
    expect(result.completed).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses valid tasks and groups them by status", async () => {
    mockGet.mockResolvedValueOnce({
      backlog: [],
      pending: [
        {
          type: "ok",
          task: {
            id: 1,
            title: "Task One",
            description: "Description one",
            status: "pending",
            metadata: { priority: "high", complexity: "M" },
          },
          file_path: "/project/.agents/tasks/pending/group/task-001.json",
          mtime_ms: 1700000000000,
        },
      ],
      in_progress: [
        {
          type: "ok",
          task: {
            id: 2,
            title: "Task Two",
            description: "Description two",
            status: "in_progress",
          },
          file_path: "/project/.agents/tasks/in-progress/group/task-002.json",
          mtime_ms: 1700000001000,
        },
      ],
      completed: [],
    });

    const result = await loadTasks("/test/project");

    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].task.title).toBe("Task One");
    expect(result.pending[0].filePath).toBe(
      "/project/.agents/tasks/pending/group/task-001.json",
    );
    expect(result.pending[0].mtimeMs).toBe(1700000000000);
    expect(result.in_progress).toHaveLength(1);
    expect(result.in_progress[0].task.title).toBe("Task Two");
    expect(result.in_progress[0].mtimeMs).toBe(1700000001000);
    expect(result.errors).toEqual([]);
  });

  it("collects Rust-side errors as parse errors", async () => {
    mockGet.mockResolvedValueOnce({
      backlog: [],
      pending: [
        {
          type: "error",
          file_path: "/project/.agents/tasks/pending/group/task-bad.json",
          error: "Invalid JSON: expected value at line 1 column 1",
        },
      ],
      in_progress: [],
      completed: [],
    });

    const result = await loadTasks("/test/project");

    expect(result.pending).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].filePath).toBe(
      "/project/.agents/tasks/pending/group/task-bad.json",
    );
    expect(result.errors[0].error).toContain("Invalid JSON");
  });

  it("collects Zod validation failures as parse errors", async () => {
    mockGet.mockResolvedValueOnce({
      backlog: [],
      pending: [
        {
          type: "ok",
          task: {
            // Missing required fields: title, description, status
            id: 99,
          },
          file_path: "/project/.agents/tasks/pending/group/task-099.json",
        },
      ],
      in_progress: [],
      completed: [],
    });

    const result = await loadTasks("/test/project");

    expect(result.pending).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("Zod validation failed");
  });

  it("handles tasks with missing optional fields", async () => {
    mockGet.mockResolvedValueOnce({
      backlog: [
        {
          type: "ok",
          task: {
            id: "minimal",
            title: "Minimal task",
            description: "Just the required fields",
            status: "backlog",
            // No metadata, no acceptance_criteria, no blocked_by, etc.
          },
          file_path: "/project/.agents/tasks/backlog/group/task-min.json",
        },
      ],
      pending: [],
      in_progress: [],
      completed: [],
    });

    const result = await loadTasks("/test/project");

    expect(result.backlog).toHaveLength(1);
    expect(result.backlog[0].task.title).toBe("Minimal task");
    expect(result.backlog[0].task.metadata).toBeUndefined();
    expect(result.errors).toEqual([]);
  });

  it("throws when IPC call fails", async () => {
    mockGet.mockRejectedValueOnce("Backend not available");

    await expect(loadTasks("/test/project")).rejects.toBe(
      "Backend not available",
    );
  });
});

describe("getTotalTaskCount", () => {
  it("returns 0 for empty task groups", () => {
    const tasks = {
      backlog: [],
      pending: [],
      in_progress: [],
      completed: [],
      errors: [],
    };
    expect(getTotalTaskCount(tasks)).toBe(0);
  });

  it("sums all task groups", () => {
    const makeTasks = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        task: {
          id: i,
          title: `Task ${i}`,
          description: "",
          status: "pending" as const,
        },
        filePath: `/path/task-${i}.json`,
        mtimeMs: 1700000000000 + i,
      }));

    const tasks = {
      backlog: makeTasks(2),
      pending: makeTasks(3),
      in_progress: makeTasks(1),
      completed: makeTasks(5),
      errors: [],
    };
    expect(getTotalTaskCount(tasks)).toBe(11);
  });
});

describe("isEmptyTaskList", () => {
  it("returns true for empty tasks", () => {
    const tasks = {
      backlog: [],
      pending: [],
      in_progress: [],
      completed: [],
      errors: [],
    };
    expect(isEmptyTaskList(tasks)).toBe(true);
  });

  it("returns false when any group has tasks", () => {
    const tasks = {
      backlog: [],
      pending: [
        {
          task: {
            id: 1,
            title: "T",
            description: "",
            status: "pending" as const,
          },
          filePath: "/path/task.json",
          mtimeMs: 1700000000000,
        },
      ],
      in_progress: [],
      completed: [],
      errors: [],
    };
    expect(isEmptyTaskList(tasks)).toBe(false);
  });
});

describe("STATUS_ORDER", () => {
  it("contains all four statuses in display order", () => {
    expect(STATUS_ORDER).toEqual([
      "backlog",
      "pending",
      "in_progress",
      "completed",
    ]);
  });
});

describe("STATUS_LABELS", () => {
  it("has human-readable labels for all statuses", () => {
    expect(STATUS_LABELS.backlog).toBe("Backlog");
    expect(STATUS_LABELS.pending).toBe("Pending");
    expect(STATUS_LABELS.in_progress).toBe("In Progress");
    expect(STATUS_LABELS.completed).toBe("Completed");
  });
});

describe("moveTask", () => {
  it("calls move_task IPC with lastReadMtimeMs", async () => {
    mockPost.mockResolvedValueOnce({
      task: { id: 1, title: "Moved", description: "D", status: "in_progress" },
      file_path: "/project/.agents/tasks/in-progress/group/task-001.json",
      mtime_ms: 1700000002000,
    });

    const result = await moveTask(
      "/project/.agents/tasks/pending/group/task-001.json",
      "in_progress",
      1700000000000,
    );

    expect(mockPost).toHaveBeenCalledWith("/api/tasks/move", {
      filePath: "/project/.agents/tasks/pending/group/task-001.json",
      newStatus: "in_progress",
      lastReadMtimeMs: 1700000000000,
    });
    expect(result.filePath).toBe(
      "/project/.agents/tasks/in-progress/group/task-001.json",
    );
    expect(result.mtimeMs).toBe(1700000002000);
  });

  it("calls move_task with null when no mtime provided", async () => {
    mockPost.mockResolvedValueOnce({
      task: { id: 1, title: "Moved", description: "D", status: "completed" },
      file_path: "/project/.agents/tasks/completed/group/task-001.json",
      mtime_ms: 1700000003000,
    });

    await moveTask(
      "/project/.agents/tasks/pending/group/task-001.json",
      "completed",
    );

    expect(mockPost).toHaveBeenCalledWith("/api/tasks/move", {
      filePath: "/project/.agents/tasks/pending/group/task-001.json",
      newStatus: "completed",
      lastReadMtimeMs: null,
    });
  });

  it("throws ConflictError when file modified externally", async () => {
    mockPost.mockRejectedValueOnce(
      "Conflict: file was modified externally since last read. Expected mtime 100 but found 200.",
    );

    await expect(
      moveTask("/path/task.json", "in_progress", 100),
    ).rejects.toThrow(ConflictError);
  });

  it("throws ConflictError when file deleted externally", async () => {
    mockPost.mockRejectedValueOnce(
      "Conflict: task file was removed externally: /path/task.json",
    );

    await expect(
      moveTask("/path/task.json", "in_progress", 100),
    ).rejects.toThrow(ConflictError);
  });

  it("throws non-conflict errors normally", async () => {
    mockPost.mockRejectedValueOnce("Permission denied");

    await expect(
      moveTask("/path/task.json", "in_progress"),
    ).rejects.toBe("Permission denied");
  });
});

describe("updateTaskFields", () => {
  it("calls update_task_fields IPC with lastReadMtimeMs", async () => {
    mockPost.mockResolvedValueOnce({
      task: { id: 1, title: "Updated", description: "D", status: "pending" },
      mtime_ms: 1700000005000,
    });

    const result = await updateTaskFields(
      "/path/task.json",
      { title: "Updated" },
      1700000000000,
    );

    expect(mockPost).toHaveBeenCalledWith("/api/tasks/update", {
      filePath: "/path/task.json",
      fields: { title: "Updated" },
      lastReadMtimeMs: 1700000000000,
    });
    expect(result.mtimeMs).toBe(1700000005000);
  });

  it("throws ConflictError when conflict detected", async () => {
    mockPost.mockRejectedValueOnce(
      "Conflict: file was modified externally since last read.",
    );

    await expect(
      updateTaskFields("/path/task.json", { title: "X" }, 100),
    ).rejects.toThrow(ConflictError);
  });
});

describe("ConflictError", () => {
  it("is an instance of Error", () => {
    const err = new ConflictError("test conflict");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.name).toBe("ConflictError");
    expect(err.message).toBe("test conflict");
  });
});
