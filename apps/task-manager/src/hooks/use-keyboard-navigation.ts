import { useState, useCallback, useRef, useEffect } from "react";
import type { BoardColumn } from "../components/KanbanBoard";
import type { TaskWithPath, TasksByStatus } from "../services/task-service";
import type { TransitionResult } from "../services/transition-validation";
import { validateTransition } from "../services/transition-validation";
import type { BoardTasks } from "../components/KanbanBoard";

/** State for keyboard drag-and-drop mode. */
export interface KeyboardDndState {
  /** The task being "dragged" via keyboard. */
  task: TaskWithPath;
  /** The column the task originated from. */
  fromColumn: BoardColumn;
  /** The column currently being targeted for the drop. */
  targetColumn: BoardColumn;
  /** Validation result for the current target column. */
  transitionResult: TransitionResult;
}

/** The full state returned by the keyboard navigation hook. */
export interface KeyboardNavState {
  /** The currently focused column index (0-5). */
  focusedColumnIndex: number;
  /** The currently focused card index within the column, or -1 for column header. */
  focusedCardIndex: number;
  /** Whether keyboard navigation is active (user has started navigating). */
  isActive: boolean;
  /** Active keyboard DnD state, or null if not in DnD mode. */
  dndState: KeyboardDndState | null;
}

export interface KeyboardNavActions {
  /** Handle a keyboard event on the board container. Returns true if the event was handled. */
  handleKeyDown: (e: KeyboardEvent) => boolean;
  /** Reset navigation state (e.g., when board data changes significantly). */
  reset: () => void;
  /** Activate navigation starting at a specific column and card. */
  focusCard: (columnIndex: number, cardIndex: number) => void;
  /** Get the focused task, or null if no task is focused. */
  getFocusedTask: () => TaskWithPath | null;
}

/**
 * Hook providing keyboard navigation for the Kanban board.
 *
 * Supports:
 * - Arrow keys to navigate between columns (Left/Right) and cards (Up/Down)
 * - Enter to open task detail panel or confirm keyboard DnD drop
 * - Space to initiate keyboard drag-and-drop mode
 * - Escape to cancel keyboard DnD or close detail panel
 * - Tab follows natural order (managed externally)
 *
 * Column boundary: wraps around from last to first column and vice versa.
 * Empty column skip: arrow navigation skips columns with no cards when navigating by card.
 */
export function useKeyboardNavigation(
  boardTasks: BoardTasks | null,
  allTasks: TasksByStatus | null,
  orderedColumns: BoardColumn[],
  callbacks: {
    onOpenDetail: (task: TaskWithPath) => void;
    onMoveTask: (task: TaskWithPath, fromColumn: BoardColumn, toColumn: BoardColumn) => void;
  },
): [KeyboardNavState, KeyboardNavActions] {
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const [isActive, setIsActive] = useState(false);
  const [dndState, setDndState] = useState<KeyboardDndState | null>(null);

  // Keep refs so callbacks always have the latest values
  const boardTasksRef = useRef(boardTasks);
  boardTasksRef.current = boardTasks;
  const allTasksRef = useRef(allTasks);
  allTasksRef.current = allTasks;
  const columnsRef = useRef(orderedColumns);
  columnsRef.current = orderedColumns;

  const getColumnTasks = useCallback(
    (colIdx: number): TaskWithPath[] => {
      const bt = boardTasksRef.current;
      if (!bt) return [];
      return bt[columnsRef.current[colIdx]] ?? [];
    },
    [],
  );

  const getFocusedTask = useCallback((): TaskWithPath | null => {
    if (!isActive || focusedCardIndex < 0) return null;
    const tasks = getColumnTasks(focusedColumnIndex);
    return tasks[focusedCardIndex] ?? null;
  }, [isActive, focusedColumnIndex, focusedCardIndex, getColumnTasks]);

  /** Find the next column with cards in a given direction, wrapping around. */
  const findNextColumnWithCards = useCallback(
    (startIdx: number, direction: 1 | -1): number => {
      const len = columnsRef.current.length;
      let idx = (startIdx + direction + len) % len;
      let checked = 0;
      while (checked < len) {
        const tasks = getColumnTasks(idx);
        if (tasks.length > 0) return idx;
        idx = (idx + direction + len) % len;
        checked++;
      }
      // All columns empty, stay at start
      return startIdx;
    },
    [getColumnTasks],
  );

  /** Clamp card index to column bounds. */
  const clampCardIndex = useCallback(
    (colIdx: number, requestedIdx: number): number => {
      const tasks = getColumnTasks(colIdx);
      if (tasks.length === 0) return -1;
      return Math.max(0, Math.min(requestedIdx, tasks.length - 1));
    },
    [getColumnTasks],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): boolean => {
      const bt = boardTasksRef.current;
      const at = allTasksRef.current;
      if (!bt || !at) return false;

      // --- Keyboard DnD mode ---
      if (dndState !== null) {
        switch (e.key) {
          case "Escape": {
            e.preventDefault();
            setDndState(null);
            return true;
          }
          case "ArrowLeft": {
            e.preventDefault();
            const cols = columnsRef.current;
            const len = cols.length;
            const newIdx =
              (cols.indexOf(dndState.targetColumn) - 1 + len) % len;
            const newCol = cols[newIdx];
            const result = validateTransition(
              dndState.task,
              dndState.fromColumn,
              newCol,
              at,
            );
            setDndState((prev) =>
              prev
                ? { ...prev, targetColumn: newCol, transitionResult: result }
                : null,
            );
            setFocusedColumnIndex(newIdx);
            return true;
          }
          case "ArrowRight": {
            e.preventDefault();
            const cols = columnsRef.current;
            const len = cols.length;
            const newIdx =
              (cols.indexOf(dndState.targetColumn) + 1) % len;
            const newCol = cols[newIdx];
            const result = validateTransition(
              dndState.task,
              dndState.fromColumn,
              newCol,
              at,
            );
            setDndState((prev) =>
              prev
                ? { ...prev, targetColumn: newCol, transitionResult: result }
                : null,
            );
            setFocusedColumnIndex(newIdx);
            return true;
          }
          case "Enter": {
            e.preventDefault();
            if (dndState.transitionResult.allowed && dndState.fromColumn !== dndState.targetColumn) {
              callbacks.onMoveTask(
                dndState.task,
                dndState.fromColumn,
                dndState.targetColumn,
              );
            }
            setDndState(null);
            return true;
          }
          default:
            return false;
        }
      }

      // --- Normal navigation mode ---
      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          if (!isActive) {
            setIsActive(true);
            setFocusedColumnIndex(0);
            setFocusedCardIndex(clampCardIndex(0, 0));
            return true;
          }
          const nextCol = findNextColumnWithCards(focusedColumnIndex, 1);
          setFocusedColumnIndex(nextCol);
          setFocusedCardIndex(clampCardIndex(nextCol, focusedCardIndex));
          return true;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (!isActive) {
            setIsActive(true);
            const lastCol = columnsRef.current.length - 1;
            setFocusedColumnIndex(lastCol);
            setFocusedCardIndex(clampCardIndex(lastCol, 0));
            return true;
          }
          const prevCol = findNextColumnWithCards(focusedColumnIndex, -1);
          setFocusedColumnIndex(prevCol);
          setFocusedCardIndex(clampCardIndex(prevCol, focusedCardIndex));
          return true;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (!isActive) {
            setIsActive(true);
            setFocusedColumnIndex(0);
            setFocusedCardIndex(clampCardIndex(0, 0));
            return true;
          }
          const tasks = getColumnTasks(focusedColumnIndex);
          if (tasks.length === 0) return true;
          const newIdx = Math.min(focusedCardIndex + 1, tasks.length - 1);
          setFocusedCardIndex(newIdx);
          return true;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (!isActive) {
            setIsActive(true);
            setFocusedColumnIndex(0);
            setFocusedCardIndex(clampCardIndex(0, 0));
            return true;
          }
          const newIdx = Math.max(focusedCardIndex - 1, 0);
          setFocusedCardIndex(newIdx);
          return true;
        }
        case "Enter": {
          if (!isActive || focusedCardIndex < 0) return false;
          e.preventDefault();
          const task = getFocusedTask();
          if (task) {
            callbacks.onOpenDetail(task);
          }
          return true;
        }
        case " ": {
          // Space to initiate keyboard DnD
          if (!isActive || focusedCardIndex < 0) return false;
          e.preventDefault();
          const task = getFocusedTask();
          if (!task || !at) return true;
          const fromColumn = columnsRef.current[focusedColumnIndex];
          const result = validateTransition(task, fromColumn, fromColumn, at);
          setDndState({
            task,
            fromColumn,
            targetColumn: fromColumn,
            transitionResult: result,
          });
          return true;
        }
        default:
          return false;
      }
    },
    [
      dndState,
      isActive,
      focusedColumnIndex,
      focusedCardIndex,
      callbacks,
      findNextColumnWithCards,
      clampCardIndex,
      getColumnTasks,
      getFocusedTask,
    ],
  );

  const reset = useCallback(() => {
    setFocusedColumnIndex(0);
    setFocusedCardIndex(-1);
    setIsActive(false);
    setDndState(null);
  }, []);

  const focusCard = useCallback(
    (columnIndex: number, cardIndex: number) => {
      setIsActive(true);
      setFocusedColumnIndex(columnIndex);
      setFocusedCardIndex(cardIndex);
    },
    [],
  );

  // Reset DnD state when boardTasks changes (tasks moved externally)
  useEffect(() => {
    if (dndState) {
      setDndState(null);
    }
    // Only reset dnd when board data changes, not on every dndState change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardTasks]);

  const state: KeyboardNavState = {
    focusedColumnIndex,
    focusedCardIndex,
    isActive,
    dndState,
  };

  const actions: KeyboardNavActions = {
    handleKeyDown,
    reset,
    focusCard,
    getFocusedTask,
  };

  return [state, actions];
}
