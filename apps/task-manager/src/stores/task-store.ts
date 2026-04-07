import { create } from "zustand";
import {
  loadTasks,
  type TasksByStatus,
  type TaskWithPath,
  type TaskParseError,
  STATUS_ORDER,
} from "../services/task-service";
import type { TaskStatus } from "../types";

/** Snapshot of pre-move state for rollback. */
export interface MoveSnapshot {
  taskId: string;
  originalFilePath: string;
  originalStatus: TaskStatus;
  originalTask: TaskWithPath;
  targetStatus: TaskStatus;
  timestamp: number;
}

interface TaskState {
  /** Tasks grouped by status. Null until first load attempt. */
  tasks: TasksByStatus | null;
  /** Whether tasks are currently being loaded. */
  isLoading: boolean;
  /** Error message from the most recent load attempt, or null. */
  error: string | null;
  /** Parse errors from the most recent load (files that failed to parse). */
  parseErrors: TaskParseError[];
  /** Set of file paths with stale data (failed to re-read after modify event). */
  stalePaths: Set<string>;
  /** Set of task IDs locked from further drags while a write is in flight. */
  lockedTaskIds: Set<string>;
  /** Pending move snapshots keyed by task ID for rollback. */
  pendingMoves: Map<string, MoveSnapshot>;

  /** Load tasks from disk for the given project path. */
  fetchTasks: (projectPath: string) => Promise<void>;
  /** Clear all task state (e.g., when project directory changes). */
  clearTasks: () => void;

  /** Upsert a task (add or update) by file path, placing it in the correct status group. */
  upsertTask: (taskWithPath: TaskWithPath) => void;
  /** Remove a task by its file path from all status groups. */
  removeTaskByPath: (filePath: string) => void;
  /** Mark a file path as stale (failed to re-read after modify event). */
  markStale: (filePath: string) => void;
  /** Clear the stale indicator for a file path. */
  clearStale: (filePath: string) => void;
  /** Apply a batch of store mutations atomically (single state update). */
  applyBatch: (
    mutations: Array<
      | { type: "upsert"; taskWithPath: TaskWithPath }
      | { type: "remove"; filePath: string }
      | { type: "stale"; filePath: string }
    >,
  ) => void;

  /** Optimistically move a task to a new status. Returns snapshot for rollback. */
  moveTaskOptimistic: (taskWithPath: TaskWithPath, targetStatus: TaskStatus) => MoveSnapshot;
  /** Confirm a successful move — update with real data from IPC and unlock. */
  confirmMove: (taskId: string, updatedTask: TaskWithPath) => void;
  /** Rollback a failed move — restore pre-move state and unlock. */
  rollbackMove: (taskId: string) => void;
  /** Check if a task is locked (write in flight). */
  isTaskLocked: (taskId: string) => boolean;
}

/** Remove a task from all status groups by file path. Returns a new TasksByStatus. */
function removeFromAll(
  tasks: TasksByStatus,
  filePath: string,
): TasksByStatus {
  const next = { ...tasks };
  for (const status of STATUS_ORDER) {
    const group = next[status];
    const idx = group.findIndex((t) => t.filePath === filePath);
    if (idx !== -1) {
      next[status] = [...group.slice(0, idx), ...group.slice(idx + 1)];
    }
  }
  return next;
}

/** Insert or update a task in the correct status group. */
function upsertInto(
  tasks: TasksByStatus,
  twp: TaskWithPath,
): TasksByStatus {
  // First remove from any existing location
  const cleaned = removeFromAll(tasks, twp.filePath);
  const status = twp.task.status as TaskStatus;
  // Only add to valid status groups
  if (STATUS_ORDER.includes(status)) {
    const group = cleaned[status];
    const existing = group.findIndex((t) => t.filePath === twp.filePath);
    if (existing !== -1) {
      // Replace in place
      cleaned[status] = [
        ...group.slice(0, existing),
        twp,
        ...group.slice(existing + 1),
      ];
    } else {
      cleaned[status] = [...group, twp];
    }
  }
  return cleaned;
}

function emptyTasks(): TasksByStatus {
  return { backlog: [], pending: [], in_progress: [], completed: [], errors: [] };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: null,
  isLoading: false,
  error: null,
  parseErrors: [],
  stalePaths: new Set(),
  lockedTaskIds: new Set(),
  pendingMoves: new Map(),

  fetchTasks: async (projectPath: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await loadTasks(projectPath);
      set({
        tasks: result,
        isLoading: false,
        error: null,
        parseErrors: result.errors,
        stalePaths: new Set(),
      });
    } catch (err) {
      set({
        tasks: null,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to load tasks",
        parseErrors: [],
      });
    }
  },

  clearTasks: () => {
    set({
      tasks: null,
      isLoading: false,
      error: null,
      parseErrors: [],
      stalePaths: new Set(),
      lockedTaskIds: new Set(),
      pendingMoves: new Map(),
    });
  },

  upsertTask: (taskWithPath: TaskWithPath) => {
    const { tasks, stalePaths } = get();
    const base = tasks ?? emptyTasks();
    const nextTasks = upsertInto(base, taskWithPath);
    const nextStale = new Set(stalePaths);
    nextStale.delete(taskWithPath.filePath);
    set({ tasks: nextTasks, stalePaths: nextStale });
  },

  removeTaskByPath: (filePath: string) => {
    const { tasks, stalePaths } = get();
    if (!tasks) return;
    const nextTasks = removeFromAll(tasks, filePath);
    const nextStale = new Set(stalePaths);
    nextStale.delete(filePath);
    set({ tasks: nextTasks, stalePaths: nextStale });
  },

  markStale: (filePath: string) => {
    const { stalePaths } = get();
    if (stalePaths.has(filePath)) return;
    const nextStale = new Set(stalePaths);
    nextStale.add(filePath);
    set({ stalePaths: nextStale });
  },

  clearStale: (filePath: string) => {
    const { stalePaths } = get();
    if (!stalePaths.has(filePath)) return;
    const nextStale = new Set(stalePaths);
    nextStale.delete(filePath);
    set({ stalePaths: nextStale });
  },

  applyBatch: (mutations) => {
    const state = get();
    let current = state.tasks ?? emptyTasks();
    const stale = new Set(state.stalePaths);

    for (const mutation of mutations) {
      switch (mutation.type) {
        case "upsert":
          current = upsertInto(current, mutation.taskWithPath);
          stale.delete(mutation.taskWithPath.filePath);
          break;
        case "remove":
          current = removeFromAll(current, mutation.filePath);
          stale.delete(mutation.filePath);
          break;
        case "stale":
          stale.add(mutation.filePath);
          break;
      }
    }

    set({ tasks: current, stalePaths: stale });
  },

  moveTaskOptimistic: (taskWithPath: TaskWithPath, targetStatus: TaskStatus): MoveSnapshot => {
    const state = get();
    const taskId = String(taskWithPath.task.id);
    const originalStatus = taskWithPath.task.status as TaskStatus;

    const snapshot: MoveSnapshot = {
      taskId,
      originalFilePath: taskWithPath.filePath,
      originalStatus,
      originalTask: taskWithPath,
      targetStatus,
      timestamp: Date.now(),
    };

    // Create optimistic version of the task in the new status
    const optimisticTask: TaskWithPath = {
      ...taskWithPath,
      task: { ...taskWithPath.task, status: targetStatus },
    };

    const base = state.tasks ?? emptyTasks();
    const nextTasks = upsertInto(base, optimisticTask);

    const nextLocked = new Set(state.lockedTaskIds);
    nextLocked.add(taskId);

    const nextPending = new Map(state.pendingMoves);
    nextPending.set(taskId, snapshot);

    set({ tasks: nextTasks, lockedTaskIds: nextLocked, pendingMoves: nextPending });
    return snapshot;
  },

  confirmMove: (taskId: string, updatedTask: TaskWithPath) => {
    const state = get();
    const base = state.tasks ?? emptyTasks();

    // Remove the optimistic entry (which may have the old filePath) before upserting the confirmed one
    const snapshot = state.pendingMoves.get(taskId);
    const cleaned = snapshot
      ? removeFromAll(base, snapshot.originalFilePath)
      : base;
    const nextTasks = upsertInto(cleaned, updatedTask);

    const nextLocked = new Set(state.lockedTaskIds);
    nextLocked.delete(taskId);

    const nextPending = new Map(state.pendingMoves);
    nextPending.delete(taskId);

    set({ tasks: nextTasks, lockedTaskIds: nextLocked, pendingMoves: nextPending });
  },

  rollbackMove: (taskId: string) => {
    const state = get();
    const snapshot = state.pendingMoves.get(taskId);
    if (!snapshot) {
      // No snapshot to rollback — just unlock
      const nextLocked = new Set(state.lockedTaskIds);
      nextLocked.delete(taskId);
      set({ lockedTaskIds: nextLocked });
      return;
    }

    const base = state.tasks ?? emptyTasks();
    const nextTasks = upsertInto(base, snapshot.originalTask);

    const nextLocked = new Set(state.lockedTaskIds);
    nextLocked.delete(taskId);

    const nextPending = new Map(state.pendingMoves);
    nextPending.delete(taskId);

    set({ tasks: nextTasks, lockedTaskIds: nextLocked, pendingMoves: nextPending });
  },

  isTaskLocked: (taskId: string): boolean => {
    return get().lockedTaskIds.has(taskId);
  },
}));
