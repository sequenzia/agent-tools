import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import {
  KanbanBoard,
  BOARD_COLUMNS,
  COLUMN_LABELS,
} from "../KanbanBoard";
import { useTaskStore } from "../../stores/task-store";
import type { TasksByStatus, TaskWithPath } from "../../services/task-service";
import {
  validateTransition,
  COLUMN_TO_STATUS,
} from "../../services/transition-validation";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../../services/api-client";
const mockGet = vi.mocked(api.get);

// Mock TaskDetailPanel to avoid pulling in react-markdown
vi.mock("../TaskDetailPanel", () => ({
  TaskDetailPanel: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({
    tasks: null,
    isLoading: false,
    error: null,
    parseErrors: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- Test helpers ---

function makeTaskResult(
  id: number | string,
  title: string,
  status: string,
  extra?: {
    metadata?: Record<string, unknown>;
    blocked_by?: (number | string)[];
    last_result?: string;
  },
) {
  return {
    type: "ok" as const,
    task: {
      id,
      title,
      description: `Description for ${title}`,
      status,
      metadata: extra?.metadata,
      blocked_by: extra?.blocked_by,
      ...(extra?.last_result !== undefined
        ? { last_result: extra.last_result }
        : {}),
    },
    file_path: `/project/.agents/tasks/${status}/group/task-${id}.json`,
  };
}

function makeTaskWithPath(
  id: number | string,
  title: string,
  status: string,
  extra?: {
    metadata?: Record<string, unknown>;
    blocked_by?: (number | string)[];
    last_result?: string;
  },
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: `Description for ${title}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
      metadata: extra?.metadata,
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

// --- Drag-and-drop integration tests ---

describe("KanbanBoard drag-and-drop", () => {
  describe("draggable cards", () => {
    it("renders task cards with draggable attributes", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Draggable task", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Draggable task")).toBeDefined();
      });

      const card = screen.getByTestId("task-card-1");
      expect(card).toBeDefined();
      // dnd-kit adds role="button" and tabIndex for accessibility
      expect(card.getAttribute("role")).toBe("button");
      expect(card.getAttribute("tabindex")).toBe("0");
      expect(card.getAttribute("aria-roledescription")).toBe(
        "draggable task card",
      );
    });

    it("renders cards in multiple columns with drag support", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Backlog card", "backlog")],
        pending: [makeTaskResult(2, "Pending card", "pending")],
        in_progress: [makeTaskResult(3, "Active card", "in_progress")],
        completed: [makeTaskResult(4, "Done card", "completed")],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Backlog card")).toBeDefined();
      });

      // All cards should have drag attributes
      for (const id of [1, 2, 3, 4]) {
        const card = screen.getByTestId(`task-card-${id}`);
        expect(card.getAttribute("aria-roledescription")).toBe(
          "draggable task card",
        );
      }
    });
  });

  describe("droppable columns", () => {
    it("renders all 6 columns as drop targets", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Test task", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Test task")).toBeDefined();
      });

      for (const column of BOARD_COLUMNS) {
        const col = screen.getByTestId(`column-${column}`);
        expect(col).toBeDefined();
        // Column should have the label
        expect(col.textContent).toContain(COLUMN_LABELS[column]);
      }
    });
  });

  describe("transition validation integration", () => {
    it("validates same-column as no-op", () => {
      const task = makeTaskWithPath(1, "Task", "pending");
      const allTasks = makeTasksByStatus();
      const result = validateTransition(task, "pending", "pending", allTasks);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("Same column");
    });

    it("prevents dropping into blocked column", () => {
      const task = makeTaskWithPath(1, "Task", "pending");
      const allTasks = makeTasksByStatus();
      const result = validateTransition(task, "pending", "blocked", allTasks);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("derived state");
    });

    it("prevents dropping into failed column", () => {
      const task = makeTaskWithPath(1, "Task", "in_progress");
      const allTasks = makeTasksByStatus();
      const result = validateTransition(
        task,
        "in_progress",
        "failed",
        allTasks,
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("derived state");
    });

    it("prevents move to in_progress with unresolved dependencies", () => {
      const task = makeTaskWithPath(2, "Blocked", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        pending: [makeTaskWithPath(1, "Blocker", "pending")],
      });
      const result = validateTransition(
        task,
        "blocked",
        "in_progress",
        allTasks,
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("unresolved dependencies");
    });

    it("allows valid transition when deps are resolved", () => {
      const task = makeTaskWithPath(2, "Ready", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [makeTaskWithPath(1, "Done", "completed")],
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

  describe("keyboard accessibility", () => {
    it("cards are keyboard focusable", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Keyboard task", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Keyboard task")).toBeDefined();
      });

      const card = screen.getByTestId("task-card-1");
      expect(card.getAttribute("tabindex")).toBe("0");
    });

    it("cards have accessible labels", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [makeTaskResult(1, "Accessible task", "pending")],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Accessible task")).toBeDefined();
      });

      const card = screen.getByTestId("task-card-1");
      expect(card.getAttribute("aria-label")).toBe("Task Accessible task");
    });
  });

  describe("column-to-status mapping", () => {
    it("maps board columns to filesystem statuses", () => {
      expect(COLUMN_TO_STATUS.backlog).toBe("backlog");
      expect(COLUMN_TO_STATUS.pending).toBe("pending");
      expect(COLUMN_TO_STATUS.in_progress).toBe("in_progress");
      expect(COLUMN_TO_STATUS.completed).toBe("completed");
    });

    it("does not map derived columns to statuses", () => {
      expect(COLUMN_TO_STATUS.blocked).toBeUndefined();
      expect(COLUMN_TO_STATUS.failed).toBeUndefined();
    });
  });

  describe("board with derived state tasks", () => {
    it("correctly categorizes blocked and failed tasks for drag", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Normal task", "pending"),
          makeTaskResult(2, "Blocked task", "pending", {
            blocked_by: [10],
          }),
          makeTaskResult(3, "Failed task", "pending", {
            last_result: "FAIL",
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Normal task")).toBeDefined();
      });

      // Normal task in pending column
      const pendingCol = screen.getByTestId("column-pending");
      expect(pendingCol.textContent).toContain("Normal task");

      // Blocked task in blocked column
      const blockedCol = screen.getByTestId("column-blocked");
      expect(blockedCol.textContent).toContain("Blocked task");

      // Failed task in failed column
      const failedCol = screen.getByTestId("column-failed");
      expect(failedCol.textContent).toContain("Failed task");
    });
  });
});
