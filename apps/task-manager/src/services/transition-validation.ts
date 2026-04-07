import type { BoardColumn } from "../components/KanbanBoard";
import type { TaskWithPath, TasksByStatus } from "./task-service";

/**
 * Result of a transition validation check.
 * If `allowed` is false, `reason` explains why.
 */
export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Columns that are derived from the "pending" filesystem status.
 * Tasks cannot be dragged INTO these columns because they are
 * UI-computed states, not filesystem directories.
 */
const DERIVED_COLUMNS: ReadonlySet<BoardColumn> = new Set([
  "blocked",
  "failed",
]);

/**
 * Mapping from board column names to the filesystem status directory names.
 * Derived columns are excluded because you cannot move into them directly.
 */
export const COLUMN_TO_STATUS: Partial<Record<BoardColumn, string>> = {
  backlog: "backlog",
  pending: "pending",
  in_progress: "in_progress",
  completed: "completed",
};

/**
 * Validate whether a task transition from one board column to another is allowed.
 *
 * Rules:
 * 1. Dragging to the same column is a no-op (allowed but no change needed).
 * 2. Cannot move to "blocked" or "failed" columns (these are derived states).
 * 3. Cannot move to "in_progress" if `blocked_by` tasks are not all completed.
 */
export function validateTransition(
  task: TaskWithPath,
  fromColumn: BoardColumn,
  toColumn: BoardColumn,
  allTasks: TasksByStatus,
): TransitionResult {
  // Same column = no-op
  if (fromColumn === toColumn) {
    return { allowed: true, reason: "Same column" };
  }

  // Cannot drop into derived columns
  if (DERIVED_COLUMNS.has(toColumn)) {
    const label = toColumn === "blocked" ? "Blocked" : "Failed";
    return {
      allowed: false,
      reason: `Cannot move to "${label}" — it is a derived state`,
    };
  }

  // Cannot move to "In Progress" if blocked_by tasks are not all completed
  if (toColumn === "in_progress") {
    const blockedBy = task.task.blocked_by;
    if (blockedBy && blockedBy.length > 0) {
      const completedIds = new Set(
        allTasks.completed.map((t) => String(t.task.id)),
      );
      const unresolvedDeps = blockedBy.filter(
        (depId) => !completedIds.has(String(depId)),
      );
      if (unresolvedDeps.length > 0) {
        return {
          allowed: false,
          reason: `Blocked by unresolved dependencies: ${unresolvedDeps.join(", ")}`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Get the board column that a task currently belongs to.
 * This resolves derived states (blocked, failed) from the raw pending status.
 */
export function getTaskBoardColumn(
  task: TaskWithPath,
  allTasks: TasksByStatus,
): BoardColumn {
  const status = task.task.status;

  if (status === "pending") {
    // Check derived states in priority order (failed > blocked > pending)
    const rawTask = task.task as Record<string, unknown>;
    const lastResult = rawTask.last_result;
    if (typeof lastResult === "string") {
      const normalized = lastResult.toUpperCase();
      if (normalized === "FAIL" || normalized === "PARTIAL") {
        return "failed";
      }
    }

    const blockedBy = task.task.blocked_by;
    if (blockedBy && blockedBy.length > 0) {
      const completedIds = new Set(
        allTasks.completed.map((t) => String(t.task.id)),
      );
      const hasUnresolved = blockedBy.some(
        (depId) => !completedIds.has(String(depId)),
      );
      if (hasUnresolved) {
        return "blocked";
      }
    }

    return "pending";
  }

  // Direct mapping for non-pending statuses
  if (
    status === "backlog" ||
    status === "in_progress" ||
    status === "completed"
  ) {
    return status;
  }

  // Fallback: unknown status treated as backlog
  return "backlog";
}
