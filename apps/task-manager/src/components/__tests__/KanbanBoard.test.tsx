import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import {
  KanbanBoard,
  deriveBoardTasks,
  filterBoardTasksByGroups,
  isBlockedTask,
  isFailedTask,
  BOARD_COLUMNS,
  COLUMN_LABELS,
  type BoardTasks,
} from "../KanbanBoard";
import { useTaskStore } from "../../stores/task-store";
import { useProjectStore } from "../../stores/project-store";
import type { TasksByStatus, TaskWithPath } from "../../services/task-service";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({
    tasks: null,
    isLoading: false,
    error: null,
    parseErrors: [],
  });
  useProjectStore.setState({
    projects: [],
    activeProjectPath: null,
    activeTaskGroups: new Set<string>(),
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

// --- Unit tests for derivation logic ---

describe("isBlockedTask", () => {
  it("returns false when task has no blocked_by", () => {
    const task = makeTaskWithPath(1, "No deps", "pending");
    const allTasks = makeTasksByStatus();
    expect(isBlockedTask(task, allTasks)).toBe(false);
  });

  it("returns false when task has empty blocked_by array", () => {
    const task = makeTaskWithPath(1, "Empty deps", "pending", {
      blocked_by: [],
    });
    const allTasks = makeTasksByStatus();
    expect(isBlockedTask(task, allTasks)).toBe(false);
  });

  it("returns true when blocked_by references an incomplete task", () => {
    const task = makeTaskWithPath(2, "Blocked task", "pending", {
      blocked_by: [1],
    });
    const allTasks = makeTasksByStatus({
      pending: [makeTaskWithPath(1, "Blocker", "pending")],
    });
    expect(isBlockedTask(task, allTasks)).toBe(true);
  });

  it("returns false when all blocked_by tasks are completed", () => {
    const task = makeTaskWithPath(2, "Unblocked", "pending", {
      blocked_by: [1],
    });
    const allTasks = makeTasksByStatus({
      completed: [makeTaskWithPath(1, "Done", "completed")],
    });
    expect(isBlockedTask(task, allTasks)).toBe(false);
  });

  it("returns true when some blocked_by tasks are not completed", () => {
    const task = makeTaskWithPath(3, "Partially blocked", "pending", {
      blocked_by: [1, 2],
    });
    const allTasks = makeTasksByStatus({
      completed: [makeTaskWithPath(1, "Done", "completed")],
      pending: [makeTaskWithPath(2, "Still pending", "pending")],
    });
    expect(isBlockedTask(task, allTasks)).toBe(true);
  });

  it("handles string task IDs", () => {
    const task = makeTaskWithPath(2, "String deps", "pending", {
      blocked_by: ["task-1"],
    });
    const allTasks = makeTasksByStatus({
      completed: [makeTaskWithPath("task-1", "Done", "completed")],
    });
    expect(isBlockedTask(task, allTasks)).toBe(false);
  });
});

describe("isFailedTask", () => {
  it("returns false when task has no last_result", () => {
    const task = makeTaskWithPath(1, "Normal", "pending");
    expect(isFailedTask(task)).toBe(false);
  });

  it("returns true when last_result is FAIL", () => {
    const task = makeTaskWithPath(1, "Failed", "pending", {
      last_result: "FAIL",
    });
    expect(isFailedTask(task)).toBe(true);
  });

  it("returns true when last_result is PARTIAL", () => {
    const task = makeTaskWithPath(1, "Partial", "pending", {
      last_result: "PARTIAL",
    });
    expect(isFailedTask(task)).toBe(true);
  });

  it("returns false when last_result is PASS", () => {
    const task = makeTaskWithPath(1, "Passed", "pending", {
      last_result: "PASS",
    });
    expect(isFailedTask(task)).toBe(false);
  });

  it("handles case-insensitive last_result", () => {
    const task = makeTaskWithPath(1, "Lowercase", "pending", {
      last_result: "fail",
    });
    expect(isFailedTask(task)).toBe(true);
  });
});

describe("deriveBoardTasks", () => {
  it("places backlog, in_progress, and completed tasks in their columns", () => {
    const tasks = makeTasksByStatus({
      backlog: [makeTaskWithPath(1, "Backlog task", "backlog")],
      in_progress: [makeTaskWithPath(2, "Active task", "in_progress")],
      completed: [makeTaskWithPath(3, "Done task", "completed")],
    });

    const board = deriveBoardTasks(tasks);

    expect(board.backlog).toHaveLength(1);
    expect(board.in_progress).toHaveLength(1);
    expect(board.completed).toHaveLength(1);
    expect(board.pending).toHaveLength(0);
    expect(board.blocked).toHaveLength(0);
    expect(board.failed).toHaveLength(0);
  });

  it("separates pending tasks into pending, blocked, and failed columns", () => {
    const tasks = makeTasksByStatus({
      pending: [
        makeTaskWithPath(1, "Normal pending", "pending"),
        makeTaskWithPath(2, "Blocked pending", "pending", {
          blocked_by: [10],
        }),
        makeTaskWithPath(3, "Failed pending", "pending", {
          last_result: "FAIL",
        }),
      ],
    });

    const board = deriveBoardTasks(tasks);

    expect(board.pending).toHaveLength(1);
    expect(board.pending[0].task.title).toBe("Normal pending");

    expect(board.blocked).toHaveLength(1);
    expect(board.blocked[0].task.title).toBe("Blocked pending");

    expect(board.failed).toHaveLength(1);
    expect(board.failed[0].task.title).toBe("Failed pending");
  });

  it("prioritizes failed over blocked when both conditions apply", () => {
    const tasks = makeTasksByStatus({
      pending: [
        makeTaskWithPath(1, "Failed+blocked", "pending", {
          blocked_by: [10],
          last_result: "FAIL",
        }),
      ],
    });

    const board = deriveBoardTasks(tasks);

    expect(board.failed).toHaveLength(1);
    expect(board.blocked).toHaveLength(0);
  });

  it("moves pending task to pending column if blocked_by are all completed", () => {
    const tasks = makeTasksByStatus({
      pending: [
        makeTaskWithPath(2, "Resolved deps", "pending", {
          blocked_by: [1],
        }),
      ],
      completed: [makeTaskWithPath(1, "Completed dep", "completed")],
    });

    const board = deriveBoardTasks(tasks);

    expect(board.pending).toHaveLength(1);
    expect(board.blocked).toHaveLength(0);
  });
});

// --- Component tests ---

describe("KanbanBoard", () => {
  describe("column rendering", () => {
    it("displays all 6 columns", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Backlog task", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByTestId("column-backlog")).toBeDefined();
      });

      for (const column of BOARD_COLUMNS) {
        expect(screen.getByTestId(`column-${column}`)).toBeDefined();
      }
    });

    it("shows column headers with labels", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Task A", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Task A")).toBeDefined();
      });

      for (const column of BOARD_COLUMNS) {
        expect(screen.getByText(COLUMN_LABELS[column])).toBeDefined();
      }
    });

    it("shows task count in column headers", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [
          makeTaskResult(1, "Task A", "backlog"),
          makeTaskResult(2, "Task B", "backlog"),
          makeTaskResult(3, "Task C", "backlog"),
        ],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Task A")).toBeDefined();
      });

      // Count badge for backlog column showing "3"
      const backlogColumn = screen.getByTestId("column-backlog");
      expect(backlogColumn.textContent).toContain("3");
    });
  });

  describe("derived states", () => {
    it("places blocked tasks in the Blocked column", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(2, "Blocked task", "pending", {
            blocked_by: [1],
          }),
        ],
        in_progress: [makeTaskResult(1, "Active blocker", "in_progress")],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Blocked task")).toBeDefined();
      });

      const blockedColumn = screen.getByTestId("column-blocked");
      expect(blockedColumn.textContent).toContain("Blocked task");
    });

    it("places failed tasks in the Failed column", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Failed task", "pending", {
            last_result: "FAIL",
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Failed task")).toBeDefined();
      });

      const failedColumn = screen.getByTestId("column-failed");
      expect(failedColumn.textContent).toContain("Failed task");
    });

    it("keeps unblocked pending tasks in the Pending column", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Normal pending", "pending"),
          makeTaskResult(2, "Resolved deps", "pending", {
            blocked_by: [3],
          }),
        ],
        in_progress: [],
        completed: [makeTaskResult(3, "Completed dep", "completed")],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Normal pending")).toBeDefined();
      });

      const pendingColumn = screen.getByTestId("column-pending");
      expect(pendingColumn.textContent).toContain("Normal pending");
      expect(pendingColumn.textContent).toContain("Resolved deps");
    });
  });

  describe("empty state and overflow", () => {
    it("shows empty placeholder in columns with no tasks", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Only backlog", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Only backlog")).toBeDefined();
      });

      // Empty columns should show placeholder
      expect(screen.getByTestId("empty-pending")).toBeDefined();
      expect(screen.getByTestId("empty-blocked")).toBeDefined();
      expect(screen.getByTestId("empty-in_progress")).toBeDefined();
      expect(screen.getByTestId("empty-failed")).toBeDefined();
      expect(screen.getByTestId("empty-completed")).toBeDefined();

      // The backlog column should NOT have empty placeholder
      expect(screen.queryByTestId("empty-backlog")).toBeNull();
    });

    it("displays empty board state when no tasks exist", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("No tasks found")).toBeDefined();
      });
    });

    it("renders many tasks in a column with virtual scrolling", async () => {
      const manyTasks = Array.from({ length: 55 }, (_, i) =>
        makeTaskResult(i + 1, `Task ${i + 1}`, "pending"),
      );

      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: manyTasks,
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Task 1")).toBeDefined();
      });

      // Virtual scrolling is active for 55 tasks (threshold: 50)
      const pendingColumn = screen.getByTestId("column-pending");
      const cardsArea = pendingColumn.querySelector("[data-virtual='true']");
      expect(cardsArea).not.toBeNull();

      // Not all tasks are rendered due to virtual scrolling — only a subset
      // Task 1 should be visible (near the top)
      expect(screen.getByText("Task 1")).toBeDefined();

      // Column should have overflow-y-auto class for scrolling
      const scrollArea = pendingColumn.querySelector(".overflow-y-auto");
      expect(scrollArea).not.toBeNull();
    });
  });

  describe("loading and error states", () => {
    it("shows loading spinner while tasks are being fetched", () => {
      mockInvoke.mockReturnValue(new Promise(() => {}));

      render(<KanbanBoard projectPath="/test/project" />);

      expect(screen.getByText("Loading tasks...")).toBeDefined();
      expect(screen.getByRole("status")).toBeDefined();
    });

    it("displays error state when IPC call fails", async () => {
      mockInvoke.mockRejectedValueOnce("Backend connection lost");

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load tasks")).toBeDefined();
      });

      expect(screen.getByText("Backend connection lost")).toBeDefined();
    });
  });

  describe("store reactivity", () => {
    it("updates board when task store changes", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Initial task", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Initial task")).toBeDefined();
      });

      // Simulate store update (e.g., from file watcher)
      mockInvoke.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Initial task", "backlog")],
        pending: [makeTaskResult(2, "New task", "pending")],
        in_progress: [],
        completed: [],
      });

      // Trigger refetch
      await useTaskStore.getState().fetchTasks("/test/project");

      await waitFor(() => {
        expect(screen.getByText("New task")).toBeDefined();
      });
    });
  });

  describe("task card content", () => {
    it("renders task card with priority, complexity, and dependency count", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Full card", "pending", {
            metadata: { priority: "high", complexity: "L", task_group: "auth" },
            blocked_by: [10, 11],
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Full card")).toBeDefined();
      });

      // Note: task has 2 unresolved deps so it goes to blocked column
      expect(screen.getByText("high")).toBeDefined();
      expect(screen.getByText("L")).toBeDefined();
      // "auth" appears both in the task card and the filter bar
      expect(screen.getAllByText("auth").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("2 deps")).toBeDefined();
    });

    it("renders task card with single dependency count", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Single dep", "pending", {
            blocked_by: [10],
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Single dep")).toBeDefined();
      });

      expect(screen.getByText("1 dep")).toBeDefined();
    });
  });

  describe("task group filtering", () => {
    it("shows all tasks when no filter is active", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Auth task", "pending", {
            metadata: { task_group: "auth" },
          }),
          makeTaskResult(2, "UI task", "pending", {
            metadata: { task_group: "ui" },
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Auth task")).toBeDefined();
      });

      expect(screen.getByText("UI task")).toBeDefined();
    });

    it("filters to a single group when group filter is active", async () => {
      useProjectStore.setState({
        activeTaskGroups: new Set(["auth"]),
      });

      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Auth task", "pending", {
            metadata: { task_group: "auth" },
          }),
          makeTaskResult(2, "UI task", "pending", {
            metadata: { task_group: "ui" },
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Auth task")).toBeDefined();
      });

      expect(screen.queryByText("UI task")).toBeNull();
    });

    it("filters to multiple groups simultaneously", async () => {
      useProjectStore.setState({
        activeTaskGroups: new Set(["auth", "payments"]),
      });

      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Auth task", "pending", {
            metadata: { task_group: "auth" },
          }),
          makeTaskResult(2, "UI task", "pending", {
            metadata: { task_group: "ui" },
          }),
          makeTaskResult(3, "Pay task", "pending", {
            metadata: { task_group: "payments" },
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Auth task")).toBeDefined();
      });

      expect(screen.getByText("Pay task")).toBeDefined();
      expect(screen.queryByText("UI task")).toBeNull();
    });

    it("updates column counts when filter is active", async () => {
      useProjectStore.setState({
        activeTaskGroups: new Set(["auth"]),
      });

      mockInvoke.mockResolvedValueOnce({
        backlog: [
          makeTaskResult(1, "Auth backlog", "backlog", {
            metadata: { task_group: "auth" },
          }),
          makeTaskResult(2, "UI backlog", "backlog", {
            metadata: { task_group: "ui" },
          }),
          makeTaskResult(3, "Auth backlog 2", "backlog", {
            metadata: { task_group: "auth" },
          }),
        ],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Auth backlog")).toBeDefined();
      });

      // Column count should show 2 (filtered) not 3 (total)
      const backlogColumn = screen.getByTestId("column-backlog");
      expect(backlogColumn.textContent).toContain("2");
      expect(screen.queryByText("UI backlog")).toBeNull();
    });

    it("shows board filter bar with available groups", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Auth task", "pending", {
            metadata: { task_group: "auth" },
          }),
          makeTaskResult(2, "UI task", "pending", {
            metadata: { task_group: "ui" },
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByTestId("board-filter-bar")).toBeDefined();
      });

      expect(screen.getByTestId("filter-all")).toBeDefined();
      expect(screen.getByTestId("filter-group-auth")).toBeDefined();
      expect(screen.getByTestId("filter-group-ui")).toBeDefined();
    });

    it("does not show filter bar when no groups exist", async () => {
      mockInvoke.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Plain task", "backlog")],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<KanbanBoard projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Plain task")).toBeDefined();
      });

      expect(screen.queryByTestId("board-filter-bar")).toBeNull();
    });
  });
});

// --- Unit tests for filterBoardTasksByGroups ---

describe("filterBoardTasksByGroups", () => {
  function makeBoardTasks(tasks: Partial<BoardTasks>): BoardTasks {
    return {
      backlog: [],
      pending: [],
      blocked: [],
      in_progress: [],
      failed: [],
      completed: [],
      unknown: [],
      ...tasks,
    };
  }

  it("returns all tasks when groups set is empty", () => {
    const board = makeBoardTasks({
      pending: [
        makeTaskWithPath(1, "Task A", "pending", {
          metadata: { task_group: "auth" },
        }),
        makeTaskWithPath(2, "Task B", "pending", {
          metadata: { task_group: "ui" },
        }),
      ],
    });

    const filtered = filterBoardTasksByGroups(board, new Set());
    expect(filtered.pending).toHaveLength(2);
  });

  it("filters tasks to matching group", () => {
    const board = makeBoardTasks({
      pending: [
        makeTaskWithPath(1, "Task A", "pending", {
          metadata: { task_group: "auth" },
        }),
        makeTaskWithPath(2, "Task B", "pending", {
          metadata: { task_group: "ui" },
        }),
      ],
    });

    const filtered = filterBoardTasksByGroups(board, new Set(["auth"]));
    expect(filtered.pending).toHaveLength(1);
    expect(filtered.pending[0].task.title).toBe("Task A");
  });

  it("filters across multiple columns", () => {
    const board = makeBoardTasks({
      backlog: [
        makeTaskWithPath(1, "Auth backlog", "backlog", {
          metadata: { task_group: "auth" },
        }),
      ],
      in_progress: [
        makeTaskWithPath(2, "UI active", "in_progress", {
          metadata: { task_group: "ui" },
        }),
      ],
      completed: [
        makeTaskWithPath(3, "Auth done", "completed", {
          metadata: { task_group: "auth" },
        }),
      ],
    });

    const filtered = filterBoardTasksByGroups(board, new Set(["auth"]));
    expect(filtered.backlog).toHaveLength(1);
    expect(filtered.in_progress).toHaveLength(0);
    expect(filtered.completed).toHaveLength(1);
  });

  it("supports multiple groups", () => {
    const board = makeBoardTasks({
      pending: [
        makeTaskWithPath(1, "Auth task", "pending", {
          metadata: { task_group: "auth" },
        }),
        makeTaskWithPath(2, "UI task", "pending", {
          metadata: { task_group: "ui" },
        }),
        makeTaskWithPath(3, "Pay task", "pending", {
          metadata: { task_group: "payments" },
        }),
      ],
    });

    const filtered = filterBoardTasksByGroups(
      board,
      new Set(["auth", "payments"]),
    );
    expect(filtered.pending).toHaveLength(2);
    expect(filtered.pending.map((t) => t.task.title)).toEqual([
      "Auth task",
      "Pay task",
    ]);
  });

  it("excludes tasks without task_group when filter is active", () => {
    const board = makeBoardTasks({
      pending: [
        makeTaskWithPath(1, "Grouped", "pending", {
          metadata: { task_group: "auth" },
        }),
        makeTaskWithPath(2, "Ungrouped", "pending"),
      ],
    });

    const filtered = filterBoardTasksByGroups(board, new Set(["auth"]));
    expect(filtered.pending).toHaveLength(1);
    expect(filtered.pending[0].task.title).toBe("Grouped");
  });

  it("returns empty columns when no tasks match filter", () => {
    const board = makeBoardTasks({
      pending: [
        makeTaskWithPath(1, "UI task", "pending", {
          metadata: { task_group: "ui" },
        }),
      ],
    });

    const filtered = filterBoardTasksByGroups(
      board,
      new Set(["nonexistent"]),
    );
    expect(filtered.pending).toHaveLength(0);
  });
});
