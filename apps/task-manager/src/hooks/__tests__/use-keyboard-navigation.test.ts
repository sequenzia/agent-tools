import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardNavigation } from "../use-keyboard-navigation";
import type { BoardTasks } from "../../components/KanbanBoard";
import type { TaskWithPath, TasksByStatus } from "../../services/task-service";

// --- Test helpers ---

function makeTaskWithPath(
  id: number | string,
  title: string,
  status: string,
  extra?: {
    metadata?: Record<string, unknown>;
    blocked_by?: (number | string)[];
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

function makeBoardTasks(overrides?: Partial<BoardTasks>): BoardTasks {
  return {
    backlog: [],
    pending: [],
    blocked: [],
    in_progress: [],
    failed: [],
    completed: [],
    unknown: [],
    ...overrides,
  };
}

function makeKeyboardEvent(key: string, extra?: Partial<KeyboardEvent>): KeyboardEvent {
  const prevented = { value: false };
  return {
    key,
    preventDefault: () => { prevented.value = true; },
    stopPropagation: () => {},
    ...extra,
  } as unknown as KeyboardEvent;
}

// --- Tests ---

describe("useKeyboardNavigation", () => {
  let onOpenDetail: ReturnType<typeof vi.fn>;
  let onMoveTask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenDetail = vi.fn();
    onMoveTask = vi.fn();
  });

  function renderNav(boardTasks: BoardTasks | null, allTasks: TasksByStatus | null = null) {
    return renderHook(
      ({ bt, at }) =>
        useKeyboardNavigation(bt, at, { onOpenDetail, onMoveTask }),
      { initialProps: { bt: boardTasks, at: allTasks ?? makeTasksByStatus() } },
    );
  }

  describe("arrow key navigation", () => {
    it("activates on first arrow key press and focuses first card", () => {
      const board = makeBoardTasks({
        backlog: [makeTaskWithPath(1, "Task A", "backlog")],
      });

      const { result } = renderNav(board);

      // Initially not active
      expect(result.current[0].isActive).toBe(false);

      // Press ArrowRight to activate
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });

      expect(result.current[0].isActive).toBe(true);
      expect(result.current[0].focusedColumnIndex).toBe(0);
      expect(result.current[0].focusedCardIndex).toBe(0);
    });

    it("navigates right between columns, skipping empty ones", () => {
      const board = makeBoardTasks({
        backlog: [makeTaskWithPath(1, "Task A", "backlog")],
        // pending: empty
        // blocked: empty
        in_progress: [makeTaskWithPath(2, "Task B", "in_progress")],
      });

      const { result } = renderNav(board);

      // Activate at column 0
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].focusedColumnIndex).toBe(0);

      // Press ArrowRight - should skip empty pending/blocked and go to in_progress (index 3)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].focusedColumnIndex).toBe(3);
    });

    it("navigates left between columns, skipping empty ones", () => {
      const board = makeBoardTasks({
        backlog: [makeTaskWithPath(1, "Task A", "backlog")],
        completed: [makeTaskWithPath(2, "Task B", "completed")],
      });

      const { result } = renderNav(board);

      // Activate at column 0
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].focusedColumnIndex).toBe(0);

      // Press ArrowLeft - should wrap to completed (index 5)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowLeft"));
      });
      expect(result.current[0].focusedColumnIndex).toBe(5);
    });

    it("wraps around from last column to first on ArrowRight", () => {
      const board = makeBoardTasks({
        backlog: [makeTaskWithPath(1, "Task A", "backlog")],
        completed: [makeTaskWithPath(2, "Task B", "completed")],
      });

      const { result } = renderNav(board);

      // Activate and go to completed column
      act(() => {
        result.current[1].focusCard(5, 0);
      });
      expect(result.current[0].focusedColumnIndex).toBe(5);

      // Press ArrowRight - should wrap to backlog (index 0)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].focusedColumnIndex).toBe(0);
    });

    it("navigates down through cards in a column", () => {
      const board = makeBoardTasks({
        backlog: [
          makeTaskWithPath(1, "Task A", "backlog"),
          makeTaskWithPath(2, "Task B", "backlog"),
          makeTaskWithPath(3, "Task C", "backlog"),
        ],
      });

      const { result } = renderNav(board);

      // Activate at first card
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowDown"));
      });
      expect(result.current[0].focusedCardIndex).toBe(0);

      // Move down
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowDown"));
      });
      expect(result.current[0].focusedCardIndex).toBe(1);

      // Move down again
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowDown"));
      });
      expect(result.current[0].focusedCardIndex).toBe(2);

      // Move down at bottom - stays at last card
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowDown"));
      });
      expect(result.current[0].focusedCardIndex).toBe(2);
    });

    it("navigates up through cards in a column", () => {
      const board = makeBoardTasks({
        backlog: [
          makeTaskWithPath(1, "Task A", "backlog"),
          makeTaskWithPath(2, "Task B", "backlog"),
        ],
      });

      const { result } = renderNav(board);

      // Start at card index 1
      act(() => {
        result.current[1].focusCard(0, 1);
      });
      expect(result.current[0].focusedCardIndex).toBe(1);

      // Move up
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowUp"));
      });
      expect(result.current[0].focusedCardIndex).toBe(0);

      // Move up at top - stays at first card
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowUp"));
      });
      expect(result.current[0].focusedCardIndex).toBe(0);
    });

    it("preserves card index when moving between columns with enough cards", () => {
      const board = makeBoardTasks({
        backlog: [
          makeTaskWithPath(1, "Task A", "backlog"),
          makeTaskWithPath(2, "Task B", "backlog"),
          makeTaskWithPath(3, "Task C", "backlog"),
        ],
        pending: [
          makeTaskWithPath(4, "Task D", "pending"),
          makeTaskWithPath(5, "Task E", "pending"),
          makeTaskWithPath(6, "Task F", "pending"),
        ],
      });

      const { result } = renderNav(board);

      // Start at card index 2 in backlog
      act(() => {
        result.current[1].focusCard(0, 2);
      });
      expect(result.current[0].focusedCardIndex).toBe(2);

      // Move right to pending - card index should stay at 2
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].focusedColumnIndex).toBe(1);
      expect(result.current[0].focusedCardIndex).toBe(2);
    });

    it("clamps card index when moving to column with fewer cards", () => {
      const board = makeBoardTasks({
        backlog: [
          makeTaskWithPath(1, "Task A", "backlog"),
          makeTaskWithPath(2, "Task B", "backlog"),
          makeTaskWithPath(3, "Task C", "backlog"),
        ],
        pending: [makeTaskWithPath(4, "Task D", "pending")],
      });

      const { result } = renderNav(board);

      // Start at card index 2 in backlog
      act(() => {
        result.current[1].focusCard(0, 2);
      });

      // Move right to pending - card index should clamp to 0
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].focusedColumnIndex).toBe(1);
      expect(result.current[0].focusedCardIndex).toBe(0);
    });
  });

  describe("Enter to open detail", () => {
    it("calls onOpenDetail with the focused task", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });

      const { result } = renderNav(board);

      // Focus the card
      act(() => {
        result.current[1].focusCard(0, 0);
      });

      // Press Enter
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("Enter"));
      });

      expect(onOpenDetail).toHaveBeenCalledWith(task);
    });

    it("does not call onOpenDetail when no card is focused", () => {
      const board = makeBoardTasks({ backlog: [makeTaskWithPath(1, "Task A", "backlog")] });

      const { result } = renderNav(board);

      // Not active, press Enter
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("Enter"));
      });

      expect(onOpenDetail).not.toHaveBeenCalled();
    });
  });

  describe("keyboard drag-and-drop", () => {
    it("enters DnD mode on Space press", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });
      const allTasks = makeTasksByStatus({ backlog: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus the card
      act(() => {
        result.current[1].focusCard(0, 0);
      });

      // Press Space to enter DnD mode
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });

      expect(result.current[0].dndState).not.toBeNull();
      expect(result.current[0].dndState?.task).toBe(task);
      expect(result.current[0].dndState?.fromColumn).toBe("backlog");
      expect(result.current[0].dndState?.targetColumn).toBe("backlog");
    });

    it("navigates target column with arrows in DnD mode", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });
      const allTasks = makeTasksByStatus({ backlog: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus and enter DnD
      act(() => {
        result.current[1].focusCard(0, 0);
      });
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });

      // ArrowRight should move target to pending
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].dndState?.targetColumn).toBe("pending");

      // ArrowRight again to blocked
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].dndState?.targetColumn).toBe("blocked");
    });

    it("executes move on Enter in DnD mode with valid target", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });
      const allTasks = makeTasksByStatus({ backlog: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus and enter DnD
      act(() => {
        result.current[1].focusCard(0, 0);
      });
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });

      // Navigate to pending
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });

      // Press Enter to confirm drop
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("Enter"));
      });

      expect(onMoveTask).toHaveBeenCalledWith(task, "backlog", "pending");
      expect(result.current[0].dndState).toBeNull();
    });

    it("cancels DnD mode on Escape", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });
      const allTasks = makeTasksByStatus({ backlog: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus and enter DnD
      act(() => {
        result.current[1].focusCard(0, 0);
      });
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });
      expect(result.current[0].dndState).not.toBeNull();

      // Press Escape
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("Escape"));
      });

      expect(result.current[0].dndState).toBeNull();
      expect(onMoveTask).not.toHaveBeenCalled();
    });

    it("does not execute move when target is same as source", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });
      const allTasks = makeTasksByStatus({ backlog: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus and enter DnD
      act(() => {
        result.current[1].focusCard(0, 0);
      });
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });

      // Press Enter without moving (target === source)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("Enter"));
      });

      expect(onMoveTask).not.toHaveBeenCalled();
      expect(result.current[0].dndState).toBeNull();
    });

    it("does not execute move when transition is invalid", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });
      const allTasks = makeTasksByStatus({ backlog: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus and enter DnD
      act(() => {
        result.current[1].focusCard(0, 0);
      });
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });

      // Navigate to "blocked" (derived column, invalid target)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].dndState?.targetColumn).toBe("blocked");

      // Press Enter - should NOT call onMoveTask (blocked is invalid)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("Enter"));
      });

      expect(onMoveTask).not.toHaveBeenCalled();
    });

    it("validates transition at each target column during DnD", () => {
      const task = makeTaskWithPath(1, "Task A", "backlog");
      const board = makeBoardTasks({ backlog: [task] });
      const allTasks = makeTasksByStatus({ backlog: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus and enter DnD
      act(() => {
        result.current[1].focusCard(0, 0);
      });
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });

      // Navigate to pending (valid)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].dndState?.transitionResult.allowed).toBe(true);

      // Navigate to blocked (invalid - derived column)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].dndState?.transitionResult.allowed).toBe(false);
    });

    it("wraps DnD target column navigation around", () => {
      const task = makeTaskWithPath(1, "Task A", "completed");
      const board = makeBoardTasks({ completed: [task] });
      const allTasks = makeTasksByStatus({ completed: [task] });

      const { result } = renderNav(board, allTasks);

      // Focus card at completed (index 5)
      act(() => {
        result.current[1].focusCard(5, 0);
      });

      // Enter DnD
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      });

      // Press ArrowRight should wrap to backlog (index 0)
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].dndState?.targetColumn).toBe("backlog");
    });
  });

  describe("focus management", () => {
    it("reset() clears all navigation state", () => {
      const board = makeBoardTasks({ backlog: [makeTaskWithPath(1, "Task", "backlog")] });
      const { result } = renderNav(board);

      // Activate
      act(() => {
        result.current[1].focusCard(0, 0);
      });
      expect(result.current[0].isActive).toBe(true);

      // Reset
      act(() => {
        result.current[1].reset();
      });
      expect(result.current[0].isActive).toBe(false);
      expect(result.current[0].focusedColumnIndex).toBe(0);
      expect(result.current[0].focusedCardIndex).toBe(-1);
      expect(result.current[0].dndState).toBeNull();
    });

    it("focusCard() activates navigation at a specific position", () => {
      const board = makeBoardTasks({
        pending: [makeTaskWithPath(1, "Task", "pending")],
      });

      const { result } = renderNav(board);

      act(() => {
        result.current[1].focusCard(1, 0);
      });

      expect(result.current[0].isActive).toBe(true);
      expect(result.current[0].focusedColumnIndex).toBe(1);
      expect(result.current[0].focusedCardIndex).toBe(0);
    });

    it("getFocusedTask() returns the correct task", () => {
      const taskA = makeTaskWithPath(1, "Task A", "backlog");
      const taskB = makeTaskWithPath(2, "Task B", "backlog");
      const board = makeBoardTasks({ backlog: [taskA, taskB] });

      const { result } = renderNav(board);

      act(() => {
        result.current[1].focusCard(0, 1);
      });

      expect(result.current[1].getFocusedTask()).toBe(taskB);
    });

    it("getFocusedTask() returns null when no card is focused", () => {
      const board = makeBoardTasks({ backlog: [makeTaskWithPath(1, "Task", "backlog")] });
      const { result } = renderNav(board);

      expect(result.current[1].getFocusedTask()).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles empty board gracefully", () => {
      const board = makeBoardTasks();
      const { result } = renderNav(board);

      // Arrow keys should activate but not crash
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      expect(result.current[0].isActive).toBe(true);
      expect(result.current[0].focusedCardIndex).toBe(-1);
    });

    it("handles null boardTasks gracefully", () => {
      const { result } = renderNav(null);

      // Should not crash or activate
      const handled = result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      expect(handled).toBe(false);
      expect(result.current[0].isActive).toBe(false);
    });

    it("unhandled keys return false", () => {
      const board = makeBoardTasks({ backlog: [makeTaskWithPath(1, "Task", "backlog")] });
      const { result } = renderNav(board);

      act(() => {
        result.current[1].focusCard(0, 0);
      });

      const handled = result.current[1].handleKeyDown(makeKeyboardEvent("a"));
      expect(handled).toBe(false);
    });

    it("Space does nothing when not active", () => {
      const board = makeBoardTasks({ backlog: [makeTaskWithPath(1, "Task", "backlog")] });
      const { result } = renderNav(board);

      const handled = result.current[1].handleKeyDown(makeKeyboardEvent(" "));
      expect(handled).toBe(false);
      expect(result.current[0].dndState).toBeNull();
    });

    it("Enter does nothing when not active", () => {
      const board = makeBoardTasks({ backlog: [makeTaskWithPath(1, "Task", "backlog")] });
      const { result } = renderNav(board);

      const handled = result.current[1].handleKeyDown(makeKeyboardEvent("Enter"));
      expect(handled).toBe(false);
      expect(onOpenDetail).not.toHaveBeenCalled();
    });

    it("all columns empty: column navigation stays in place", () => {
      const board = makeBoardTasks();
      const { result } = renderNav(board);

      // Activate
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });

      // Press right again — findNextColumnWithCards returns startIdx when all empty
      act(() => {
        result.current[1].handleKeyDown(makeKeyboardEvent("ArrowRight"));
      });
      // Should not crash, index stays at 0
      expect(result.current[0].focusedColumnIndex).toBe(0);
    });
  });
});
