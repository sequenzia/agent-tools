import { api } from "./api-client";
import { TaskSchema, type Task, type TaskStatus } from "../types";

/**
 * Raw result from the Rust `read_tasks` IPC command.
 * Each entry is either a successfully parsed task or an error.
 */
interface TaskFileResult {
  type: "ok" | "error";
  task?: Record<string, unknown>;
  file_path: string;
  error?: string;
  /** File modification timestamp in ms since epoch (conflict detection). */
  mtime_ms?: number;
}

/**
 * Raw response from `read_tasks` IPC — tasks grouped by status directory.
 */
interface TasksByStatusRaw {
  backlog: TaskFileResult[];
  pending: TaskFileResult[];
  in_progress: TaskFileResult[];
  completed: TaskFileResult[];
}

/**
 * A parsed task with its source file path.
 */
export interface TaskWithPath {
  task: Task;
  filePath: string;
  /** File modification timestamp in ms since epoch, for conflict detection on writes. */
  mtimeMs: number;
}

/**
 * Tasks grouped by status, after Zod validation.
 * Each group contains successfully parsed tasks.
 * Parse errors are collected separately.
 */
export interface TasksByStatus {
  backlog: TaskWithPath[];
  pending: TaskWithPath[];
  in_progress: TaskWithPath[];
  completed: TaskWithPath[];
  errors: TaskParseError[];
}

/**
 * Represents a task file that failed to parse.
 */
export interface TaskParseError {
  filePath: string;
  error: string;
}

/** Ordered list of status groups for rendering. */
export const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "pending",
  "in_progress",
  "completed",
];

/** Human-readable labels for each status. */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

/**
 * Parse a single TaskFileResult into either a TaskWithPath or a TaskParseError.
 */
function parseTaskFileResult(
  result: TaskFileResult,
): TaskWithPath | TaskParseError {
  if (result.type === "error") {
    return { filePath: result.file_path, error: result.error ?? "Unknown error" };
  }

  const parsed = TaskSchema.safeParse(result.task);
  if (!parsed.success) {
    return {
      filePath: result.file_path,
      error: `Zod validation failed: ${parsed.error.message}`,
    };
  }

  return {
    task: parsed.data,
    filePath: result.file_path,
    mtimeMs: result.mtime_ms ?? 0,
  };
}

function isTaskWithPath(
  result: TaskWithPath | TaskParseError,
): result is TaskWithPath {
  return "task" in result;
}

/**
 * Load all tasks from disk via the Tauri `read_tasks` IPC command.
 * Validates each task against the Zod schema.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @returns Tasks grouped by status with parse errors collected separately.
 * @throws If the IPC call itself fails (e.g., Tauri backend not available).
 */
export async function loadTasks(projectPath: string): Promise<TasksByStatus> {
  const raw = await api.get<TasksByStatusRaw>("/api/tasks", {
    projectPath,
  });

  const result: TasksByStatus = {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    errors: [],
  };

  for (const status of STATUS_ORDER) {
    const rawResults = raw[status];
    for (const rawResult of rawResults) {
      const parsed = parseTaskFileResult(rawResult);
      if (isTaskWithPath(parsed)) {
        result[status].push(parsed);
      } else {
        result.errors.push(parsed);
      }
    }
  }

  return result;
}

/**
 * Error thrown when a conflict is detected during a write operation.
 * The file was modified or deleted externally since the last read.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * Determine whether an IPC error message indicates a conflict.
 */
function isConflictError(error: unknown): boolean {
  const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  return msg.includes("Conflict:");
}

/**
 * Result from a move_task or update_task_fields IPC call.
 */
export interface WriteResult {
  task: Record<string, unknown>;
  filePath: string;
  mtimeMs: number;
}

/**
 * Move a task to a new status directory via the Tauri `move_task` IPC command.
 * Performs conflict detection when `lastReadMtimeMs` is provided.
 *
 * @param filePath - Absolute path to the task JSON file.
 * @param newStatus - Target status (e.g., "pending", "in_progress", "completed").
 * @param lastReadMtimeMs - File modification timestamp from when the task was last loaded.
 * @returns The updated task data with new file path and mtime.
 * @throws {ConflictError} If the file was modified or deleted externally since last read.
 */
export async function moveTask(
  filePath: string,
  newStatus: string,
  lastReadMtimeMs?: number,
): Promise<WriteResult> {
  try {
    const result = await api.post<{
      task: Record<string, unknown>;
      file_path: string;
      mtime_ms: number;
    }>("/api/tasks/move", {
      filePath,
      newStatus,
      lastReadMtimeMs: lastReadMtimeMs ?? null,
    });
    return {
      task: result.task,
      filePath: result.file_path,
      mtimeMs: result.mtime_ms,
    };
  } catch (error) {
    if (isConflictError(error)) {
      throw new ConflictError(
        typeof error === "string" ? error : (error as Error).message,
      );
    }
    throw error;
  }
}

/**
 * Update specific fields in a task JSON file via the Tauri `update_task_fields` IPC command.
 * Performs conflict detection when `lastReadMtimeMs` is provided.
 *
 * @param filePath - Absolute path to the task JSON file.
 * @param fields - JSON object of key-value pairs to merge into the task.
 * @param lastReadMtimeMs - File modification timestamp from when the task was last loaded.
 * @returns The updated task data with new mtime.
 * @throws {ConflictError} If the file was modified or deleted externally since last read.
 */
export async function updateTaskFields(
  filePath: string,
  fields: Record<string, unknown>,
  lastReadMtimeMs?: number,
): Promise<WriteResult> {
  try {
    const result = await api.post<{
      task: Record<string, unknown>;
      mtime_ms: number;
    }>("/api/tasks/update", {
      filePath,
      fields,
      lastReadMtimeMs: lastReadMtimeMs ?? null,
    });
    return {
      task: result.task,
      filePath,
      mtimeMs: result.mtime_ms,
    };
  } catch (error) {
    if (isConflictError(error)) {
      throw new ConflictError(
        typeof error === "string" ? error : (error as Error).message,
      );
    }
    throw error;
  }
}

/**
 * Get the total task count across all status groups.
 */
export function getTotalTaskCount(tasks: TasksByStatus): number {
  return (
    tasks.backlog.length +
    tasks.pending.length +
    tasks.in_progress.length +
    tasks.completed.length
  );
}

/**
 * Check whether the tasks result is empty (no tasks in any status).
 */
export function isEmptyTaskList(tasks: TasksByStatus): boolean {
  return getTotalTaskCount(tasks) === 0;
}
