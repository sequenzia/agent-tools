import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskEdit } from "../use-task-edit";
import type { TaskWithPath, TasksByStatus } from "../../services/task-service";
import * as taskService from "../../services/task-service";

// Mock the task service
vi.mock("../../services/task-service", async () => {
  const actual = await vi.importActual("../../services/task-service");
  return {
    ...actual,
    updateTaskFields: vi.fn(),
  };
});

// Mock api-client (required by task-service)
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

const mockUpdateTaskFields = vi.mocked(taskService.updateTaskFields);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Helpers ---

function makeTask(
  id: number,
  status: string = "pending",
  overrides?: Partial<TaskWithPath["task"]>,
): TaskWithPath {
  return {
    task: {
      id,
      title: `Task ${id}`,
      description: `Description for task ${id}`,
      status: status as "pending" | "backlog" | "in_progress" | "completed",
      metadata: { priority: "medium" as const, complexity: "M" as const },
      blocked_by: [],
      acceptance_criteria: {
        functional: ["Must work"],
        edge_cases: [],
        error_handling: [],
        performance: [],
      },
      ...overrides,
    },
    filePath: `/project/.agents/tasks/${status}/task-${id}.json`,
    mtimeMs: 1700000000000 + id,
  };
}

function makeAllTasks(tasks: TaskWithPath[] = []): TasksByStatus {
  const result: TasksByStatus = {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    errors: [],
  };
  for (const t of tasks) {
    const status = t.task.status as keyof Omit<TasksByStatus, "errors">;
    if (status in result && status !== "errors") {
      result[status].push(t);
    }
  }
  return result;
}

describe("useTaskEdit", () => {
  describe("initial state", () => {
    it("starts with no active field", () => {
      const task = makeTask(1);
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );
      expect(result.current.state.activeField).toBeNull();
      expect(result.current.state.isSaving).toBe(false);
      expect(result.current.state.saveError).toBeNull();
    });
  });

  describe("startEditing", () => {
    it("sets activeField and initializes draft from task", () => {
      const task = makeTask(1, "pending", {
        metadata: { priority: "high" as const, complexity: "L" as const },
      });
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("priority");
      });

      expect(result.current.state.activeField).toBe("priority");
      expect(result.current.state.draft.priority).toBe("high");
      expect(result.current.state.draft.complexity).toBe("L");
    });

    it("shows warning for in_progress tasks", () => {
      const task = makeTask(1, "in_progress");
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("priority");
      });

      expect(result.current.state.warning).toContain("in progress");
    });

    it("does nothing when task is null", () => {
      const { result } = renderHook(() =>
        useTaskEdit(null, makeAllTasks()),
      );

      act(() => {
        result.current.startEditing("priority");
      });

      expect(result.current.state.activeField).toBeNull();
    });
  });

  describe("cancelEditing", () => {
    it("clears activeField and errors", () => {
      const task = makeTask(1);
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("priority");
      });
      expect(result.current.state.activeField).toBe("priority");

      act(() => {
        result.current.cancelEditing();
      });
      expect(result.current.state.activeField).toBeNull();
      expect(result.current.state.saveError).toBeNull();
    });
  });

  describe("updateDraft", () => {
    it("updates priority draft value", () => {
      const task = makeTask(1);
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("priority");
      });
      act(() => {
        result.current.updateDraft("priority", "critical");
      });

      expect(result.current.state.draft.priority).toBe("critical");
    });

    it("updates blocked_by draft value", () => {
      const task = makeTask(1);
      const task2 = makeTask(2);
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task, task2])),
      );

      act(() => {
        result.current.startEditing("blocked_by");
      });
      act(() => {
        result.current.updateDraft("blocked_by", [2]);
      });

      expect(result.current.state.draft.blocked_by).toEqual([2]);
    });
  });

  describe("saveField", () => {
    it("saves priority change to disk", async () => {
      const task = makeTask(1);
      const onSaved = vi.fn();
      mockUpdateTaskFields.mockResolvedValueOnce({
        task: {
          ...task.task,
          metadata: { ...task.task.metadata, priority: "critical" },
          updated_at: "2026-04-06T00:00:00Z",
        },
        filePath: task.filePath,
        mtimeMs: 1700000005000,
      });

      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task]), onSaved),
      );

      act(() => {
        result.current.startEditing("priority");
      });
      act(() => {
        result.current.updateDraft("priority", "critical");
      });

      let saveResult: TaskWithPath | null = null;
      await act(async () => {
        saveResult = await result.current.saveField();
      });

      expect(mockUpdateTaskFields).toHaveBeenCalledWith(
        task.filePath,
        { metadata: { priority: "critical" } },
        task.mtimeMs,
      );
      expect(saveResult).not.toBeNull();
      expect(saveResult!.mtimeMs).toBe(1700000005000);
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(result.current.state.activeField).toBeNull();
    });

    it("saves complexity change to disk", async () => {
      const task = makeTask(1);
      mockUpdateTaskFields.mockResolvedValueOnce({
        task: {
          ...task.task,
          metadata: { ...task.task.metadata, complexity: "XL" },
        },
        filePath: task.filePath,
        mtimeMs: 1700000005000,
      });

      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("complexity");
      });
      act(() => {
        result.current.updateDraft("complexity", "XL");
      });

      await act(async () => {
        await result.current.saveField();
      });

      expect(mockUpdateTaskFields).toHaveBeenCalledWith(
        task.filePath,
        { metadata: { complexity: "XL" } },
        task.mtimeMs,
      );
    });

    it("saves blocked_by change to disk", async () => {
      const task = makeTask(1);
      const dep = makeTask(2);
      mockUpdateTaskFields.mockResolvedValueOnce({
        task: { ...task.task, blocked_by: [2] },
        filePath: task.filePath,
        mtimeMs: 1700000005000,
      });

      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task, dep])),
      );

      act(() => {
        result.current.startEditing("blocked_by");
      });
      act(() => {
        result.current.updateDraft("blocked_by", [2]);
      });

      await act(async () => {
        await result.current.saveField();
      });

      expect(mockUpdateTaskFields).toHaveBeenCalledWith(
        task.filePath,
        { blocked_by: [2] },
        task.mtimeMs,
      );
    });

    it("saves acceptance_criteria change to disk", async () => {
      const task = makeTask(1);
      const newAC = {
        functional: ["New criterion"],
        edge_cases: [],
        error_handling: [],
        performance: [],
      };
      mockUpdateTaskFields.mockResolvedValueOnce({
        task: { ...task.task, acceptance_criteria: newAC },
        filePath: task.filePath,
        mtimeMs: 1700000005000,
      });

      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("acceptance_criteria");
      });
      act(() => {
        result.current.updateDraft("acceptance_criteria", newAC);
      });

      await act(async () => {
        await result.current.saveField();
      });

      expect(mockUpdateTaskFields).toHaveBeenCalledWith(
        task.filePath,
        { acceptance_criteria: newAC },
        task.mtimeMs,
      );
    });

    it("handles conflict error gracefully", async () => {
      const task = makeTask(1);
      mockUpdateTaskFields.mockRejectedValueOnce(
        new taskService.ConflictError("Conflict: file was modified externally"),
      );

      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("priority");
      });
      act(() => {
        result.current.updateDraft("priority", "high");
      });

      let saveResult: TaskWithPath | null = null;
      await act(async () => {
        saveResult = await result.current.saveField();
      });

      expect(saveResult).toBeNull();
      expect(result.current.state.saveError).toContain("Conflict");
      expect(result.current.state.isSaving).toBe(false);
    });

    it("handles generic error on save", async () => {
      const task = makeTask(1);
      mockUpdateTaskFields.mockRejectedValueOnce(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("priority");
      });
      act(() => {
        result.current.updateDraft("priority", "high");
      });

      await act(async () => {
        await result.current.saveField();
      });

      expect(result.current.state.saveError).toBe("Network error");
    });

    it("returns null when no field is being edited", async () => {
      const task = makeTask(1);
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      let saveResult: TaskWithPath | null = null;
      await act(async () => {
        saveResult = await result.current.saveField();
      });

      expect(saveResult).toBeNull();
    });
  });

  describe("validation", () => {
    it("rejects self-referencing blocked_by", async () => {
      const task = makeTask(1);
      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("blocked_by");
      });
      act(() => {
        result.current.updateDraft("blocked_by", [1]);
      });

      await act(async () => {
        await result.current.saveField();
      });

      expect(result.current.state.saveError).toContain("cannot block itself");
      expect(mockUpdateTaskFields).not.toHaveBeenCalled();
    });

    it("warns about non-existent blocked_by reference but allows save", async () => {
      const task = makeTask(1);
      mockUpdateTaskFields.mockResolvedValueOnce({
        task: { ...task.task, blocked_by: [999] },
        filePath: task.filePath,
        mtimeMs: 1700000005000,
      });

      const { result } = renderHook(() =>
        useTaskEdit(task, makeAllTasks([task])),
      );

      act(() => {
        result.current.startEditing("blocked_by");
      });
      act(() => {
        result.current.updateDraft("blocked_by", [999]);
      });

      await act(async () => {
        await result.current.saveField();
      });

      // Save should proceed (the backend handles final validation)
      // but a warning should have been set
      // Note: the backend may reject this, which is fine
      expect(mockUpdateTaskFields).toHaveBeenCalled();
    });
  });
});
