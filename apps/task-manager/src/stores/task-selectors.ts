/**
 * Efficient Zustand selectors for the task store.
 *
 * These selectors pick specific slices of state to prevent unnecessary
 * re-renders when unrelated state changes. Components should use these
 * instead of pulling the entire store state.
 */

import { useTaskStore } from "./task-store";
import type { TasksByStatus, TaskWithPath } from "../services/task-service";

/** Select only the tasks map (null until loaded). */
export function useTasksData(): TasksByStatus | null {
  return useTaskStore((s) => s.tasks);
}

/** Select only the loading state. */
export function useTasksLoading(): boolean {
  return useTaskStore((s) => s.isLoading);
}

/** Select only the error state. */
export function useTasksError(): string | null {
  return useTaskStore((s) => s.error);
}

/** Select the locked task IDs set. */
export function useLockedTaskIds(): Set<string> {
  return useTaskStore((s) => s.lockedTaskIds);
}

/** Select the fetchTasks action. */
export function useFetchTasks(): (projectPath: string) => Promise<void> {
  return useTaskStore((s) => s.fetchTasks);
}

/** Select move-related actions as a stable group. */
export interface MoveActions {
  moveTaskOptimistic: (taskWithPath: TaskWithPath, targetStatus: import("../types").TaskStatus) => import("./task-store").MoveSnapshot;
  confirmMove: (taskId: string, updatedTask: TaskWithPath) => void;
  rollbackMove: (taskId: string) => void;
  isTaskLocked: (taskId: string) => boolean;
}

/** Select move-related actions. Uses a stable selector to avoid re-renders. */
export function useMoveActions(): MoveActions {
  return useTaskStore((s) => ({
    moveTaskOptimistic: s.moveTaskOptimistic,
    confirmMove: s.confirmMove,
    rollbackMove: s.rollbackMove,
    isTaskLocked: s.isTaskLocked,
  }));
}

/** Get the total task count across all statuses. */
export function useTaskCount(): number {
  return useTaskStore((s) => {
    if (!s.tasks) return 0;
    return (
      s.tasks.backlog.length +
      s.tasks.pending.length +
      s.tasks.in_progress.length +
      s.tasks.completed.length
    );
  });
}

/** Get the stale paths set. */
export function useStalePaths(): Set<string> {
  return useTaskStore((s) => s.stalePaths);
}
