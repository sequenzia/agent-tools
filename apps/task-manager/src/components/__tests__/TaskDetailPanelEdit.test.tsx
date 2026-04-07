import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { TaskDetailPanel } from "../TaskDetailPanel";
import type { TaskWithPath, TasksByStatus } from "../../services/task-service";
import * as taskService from "../../services/task-service";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

// Mock updateTaskFields
vi.mock("../../services/task-service", async () => {
  const actual = await vi.importActual("../../services/task-service");
  return {
    ...actual,
    updateTaskFields: vi.fn(),
  };
});

const mockUpdateTaskFields = vi.mocked(taskService.updateTaskFields);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- Test helpers ---

function makeTaskWithPath(
  id: number | string,
  title: string,
  status: string,
  extra?: {
    description?: string;
    metadata?: Record<string, unknown>;
    blocked_by?: (number | string)[];
    acceptance_criteria?: Record<string, string[]>;
    testing_requirements?: string[];
  },
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: extra?.description ?? `Description for ${title}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
      metadata: extra?.metadata,
      blocked_by: extra?.blocked_by,
      acceptance_criteria: extra?.acceptance_criteria,
      testing_requirements: extra?.testing_requirements,
    },
    filePath: `/project/.agents/tasks/${status}/group/task-${id}.json`,
    mtimeMs: 1700000000000,
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

const defaultOnClose = vi.fn();
const defaultOnTaskUpdated = vi.fn();

describe("TaskDetailPanel inline editing", () => {
  describe("edit buttons", () => {
    it("shows edit buttons for priority, complexity, blocked_by, and acceptance_criteria", () => {
      const task = makeTaskWithPath(1, "Test task", "pending", {
        metadata: { priority: "medium", complexity: "M" },
        acceptance_criteria: { functional: ["Works"] },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
          onTaskUpdated={defaultOnTaskUpdated}
        />,
      );

      expect(screen.getByTestId("edit-priority-button")).toBeDefined();
      expect(screen.getByTestId("edit-complexity-button")).toBeDefined();
      expect(screen.getByTestId("edit-blocked_by-button")).toBeDefined();
      expect(screen.getByTestId("edit-acceptance_criteria-button")).toBeDefined();
    });
  });

  describe("priority editing", () => {
    it("shows priority dropdown when edit is clicked", () => {
      const task = makeTaskWithPath(1, "Test task", "pending", {
        metadata: { priority: "medium" },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
        />,
      );

      fireEvent.click(screen.getByTestId("edit-priority-button"));

      expect(screen.getByTestId("priority-select")).toBeDefined();
      expect(screen.getByTestId("field-save-button")).toBeDefined();
      expect(screen.getByTestId("field-cancel-button")).toBeDefined();
    });

    it("saves priority change to disk and calls onTaskUpdated", async () => {
      const task = makeTaskWithPath(1, "Test task", "pending", {
        metadata: { priority: "medium" },
      });
      const onTaskUpdated = vi.fn();

      mockUpdateTaskFields.mockResolvedValueOnce({
        task: {
          ...task.task,
          metadata: { priority: "critical" },
          updated_at: "2026-04-06T00:00:00Z",
        },
        filePath: task.filePath,
        mtimeMs: 1700000005000,
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
          onTaskUpdated={onTaskUpdated}
        />,
      );

      // Click edit
      fireEvent.click(screen.getByTestId("edit-priority-button"));

      // Change value
      fireEvent.change(screen.getByTestId("priority-select"), {
        target: { value: "critical" },
      });

      // Click save
      fireEvent.click(screen.getByTestId("field-save-button"));

      await waitFor(() => {
        expect(mockUpdateTaskFields).toHaveBeenCalledWith(
          task.filePath,
          { metadata: { priority: "critical" } },
          task.mtimeMs,
        );
      });

      await waitFor(() => {
        expect(onTaskUpdated).toHaveBeenCalledTimes(1);
      });
    });

    it("cancels priority editing on cancel button click", () => {
      const task = makeTaskWithPath(1, "Test task", "pending", {
        metadata: { priority: "medium" },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
        />,
      );

      fireEvent.click(screen.getByTestId("edit-priority-button"));
      expect(screen.getByTestId("priority-select")).toBeDefined();

      fireEvent.click(screen.getByTestId("field-cancel-button"));

      // Editor should be gone
      expect(screen.queryByTestId("priority-select")).toBeNull();
    });
  });

  describe("complexity editing", () => {
    it("shows complexity dropdown when edit is clicked", () => {
      const task = makeTaskWithPath(1, "Test task", "pending", {
        metadata: { complexity: "M" },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
        />,
      );

      fireEvent.click(screen.getByTestId("edit-complexity-button"));
      expect(screen.getByTestId("complexity-select")).toBeDefined();
    });
  });

  describe("blocked_by editing", () => {
    it("shows blocked_by multi-select editor when edit is clicked", () => {
      const task = makeTaskWithPath(1, "Test task", "pending");
      const dep = makeTaskWithPath(2, "Dep task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task, dep] })}
          onClose={defaultOnClose}
        />,
      );

      fireEvent.click(screen.getByTestId("edit-blocked_by-button"));
      expect(screen.getByTestId("blocked-by-search")).toBeDefined();
    });
  });

  describe("acceptance_criteria editing", () => {
    it("shows text areas when edit is clicked", () => {
      const task = makeTaskWithPath(1, "Test task", "pending", {
        acceptance_criteria: {
          functional: ["Must work"],
          edge_cases: [],
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
        />,
      );

      fireEvent.click(screen.getByTestId("edit-acceptance_criteria-button"));
      expect(screen.getByTestId("ac-editor")).toBeDefined();
      expect(screen.getByTestId("ac-textarea-functional")).toBeDefined();
    });
  });

  describe("in_progress warning", () => {
    it("shows warning when editing an in_progress task", () => {
      const task = makeTaskWithPath(1, "Running task", "in_progress", {
        metadata: { priority: "medium" },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ in_progress: [task] })}
          onClose={defaultOnClose}
        />,
      );

      fireEvent.click(screen.getByTestId("edit-priority-button"));

      expect(screen.getByTestId("field-warning")).toBeDefined();
      expect(screen.getByTestId("field-warning").textContent).toContain(
        "in progress",
      );
    });
  });

  describe("error handling", () => {
    it("shows error on conflict", async () => {
      const task = makeTaskWithPath(1, "Test task", "pending", {
        metadata: { priority: "medium" },
      });

      mockUpdateTaskFields.mockRejectedValueOnce(
        new taskService.ConflictError(
          "Conflict: file was modified externally",
        ),
      );

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
        />,
      );

      fireEvent.click(screen.getByTestId("edit-priority-button"));
      fireEvent.change(screen.getByTestId("priority-select"), {
        target: { value: "high" },
      });
      fireEvent.click(screen.getByTestId("field-save-button"));

      await waitFor(() => {
        expect(screen.getByTestId("field-error")).toBeDefined();
        expect(screen.getByTestId("field-error").textContent).toContain(
          "Conflict",
        );
      });
    });
  });
});
