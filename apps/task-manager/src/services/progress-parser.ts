/**
 * Parsers for progress.md and execution_plan.md session files.
 *
 * These files are written by the SDD execute-tasks orchestrator and follow
 * a known markdown format. The parsers extract structured data for the
 * wave progress display component.
 */

/** Per-task execution status within a wave. */
export type TaskExecutionStatus =
  | "queued"
  | "running"
  | "passed"
  | "partial"
  | "failed";

/** A single task entry extracted from progress.md. */
export interface ProgressTask {
  id: string;
  title: string;
  status: TaskExecutionStatus;
  detail: string;
}

/** Structured data extracted from progress.md. */
export interface ProgressData {
  /** Overall execution status: Initializing, Executing, Complete, etc. */
  executionStatus: string;
  /** Current wave number (0 = not yet started). */
  currentWave: number;
  /** Total estimated waves. */
  totalWaves: number;
  /** Max parallel tasks per wave. */
  maxParallel: number;
  /** ISO 8601 timestamp of last update. */
  updatedAt: string;
  /** Tasks currently active in this wave. */
  activeTasks: ProgressTask[];
  /** Tasks completed during this session. */
  completedTasks: ProgressTask[];
  /** Whether a parse error occurred (partial data may still be available). */
  parseError: string | null;
}

/** Wave structure extracted from execution_plan.md. */
export interface WaveInfo {
  waveNumber: number;
  taskCount: number;
  taskIds: string[];
}

/** Structured data extracted from execution_plan.md. */
export interface ExecutionPlanData {
  totalTasks: number;
  totalWaves: number;
  retryLimit: number;
  maxParallel: number;
  waves: WaveInfo[];
  blockedCount: number;
  completedCount: number;
  parseError: string | null;
}

/**
 * Parse a task status from the detail string in progress.md.
 *
 * Active tasks use verbs like "Executing", "Running", "Retrying".
 * Completed tasks use "PASS", "PARTIAL", "FAIL".
 */
function inferTaskStatus(detail: string): TaskExecutionStatus {
  const lower = detail.toLowerCase();
  if (lower.includes("pass")) return "passed";
  if (lower.includes("partial")) return "partial";
  if (lower.includes("fail")) return "failed";
  if (lower.includes("retry")) return "running";
  if (lower.includes("executing") || lower.includes("running")) return "running";
  if (lower.includes("queued") || lower.includes("waiting")) return "queued";
  return "running";
}

/**
 * Parse a task line from progress.md.
 *
 * Expected formats:
 *   - [{id}] {title} -- {status_detail}
 *   - [{id}] {title} --- {status_detail}
 */
function parseTaskLine(line: string): ProgressTask | null {
  // Match: - [{id}] {title} — {detail}
  // The separator can be em-dash, en-dash, or double hyphen
  const match = line.match(
    /^\s*-\s*\[(\d+(?:\.\d+)?|[\w-]+)\]\s+(.+?)\s+(?:—|--|–)\s+(.+)$/,
  );
  if (!match) return null;

  const [, id, title, detail] = match;
  return {
    id,
    title: title.trim(),
    status: inferTaskStatus(detail),
    detail: detail.trim(),
  };
}

/**
 * Parse progress.md content into structured data.
 *
 * Format produced by the execute-tasks orchestrator:
 * ```
 * # Execution Progress
 * Status: Executing
 * Wave: 2 of 5
 * Max Parallel: 5
 * Updated: 2026-04-06T14:30:00Z
 *
 * ## Active Tasks
 * - [5] Build auth service -- Executing
 * - [7] Create user model -- Executing
 *
 * ## Completed This Session
 * - [1] Scaffold project -- PASS (45s)
 * - [2] Add data model -- PASS (32s)
 * ```
 */
export function parseProgressMd(content: string): ProgressData {
  const result: ProgressData = {
    executionStatus: "Unknown",
    currentWave: 0,
    totalWaves: 0,
    maxParallel: 0,
    updatedAt: "",
    activeTasks: [],
    completedTasks: [],
    parseError: null,
  };

  if (!content || content.trim().length === 0) {
    result.parseError = "Empty progress file";
    return result;
  }

  try {
    const lines = content.split("\n");
    let section: "header" | "active" | "completed" = "header";

    for (const line of lines) {
      const trimmed = line.trim();

      // Section headers
      if (trimmed.startsWith("## Active Tasks")) {
        section = "active";
        continue;
      }
      if (trimmed.startsWith("## Completed This Session")) {
        section = "completed";
        continue;
      }

      // Header key-value pairs
      if (section === "header") {
        const statusMatch = trimmed.match(/^Status:\s*(.+)$/i);
        if (statusMatch) {
          result.executionStatus = statusMatch[1].trim();
          continue;
        }

        const waveMatch = trimmed.match(/^Wave:\s*(\d+)\s+of\s+(\d+)$/i);
        if (waveMatch) {
          result.currentWave = parseInt(waveMatch[1], 10);
          result.totalWaves = parseInt(waveMatch[2], 10);
          continue;
        }

        const parallelMatch = trimmed.match(/^Max Parallel:\s*(\d+)$/i);
        if (parallelMatch) {
          result.maxParallel = parseInt(parallelMatch[1], 10);
          continue;
        }

        const updatedMatch = trimmed.match(/^Updated:\s*(.+)$/i);
        if (updatedMatch) {
          result.updatedAt = updatedMatch[1].trim();
          continue;
        }
      }

      // Task lines in active or completed sections
      if (section === "active" || section === "completed") {
        const task = parseTaskLine(trimmed);
        if (task) {
          if (section === "active") {
            result.activeTasks.push(task);
          } else {
            result.completedTasks.push(task);
          }
        }
      }
    }
  } catch (err) {
    result.parseError =
      err instanceof Error ? err.message : "Unknown parse error";
  }

  return result;
}

/**
 * Parse execution_plan.md content into structured data.
 *
 * Format produced by the execute-tasks orchestrator:
 * ```
 * EXECUTION PLAN
 * Tasks to execute: 15
 * Retry limit: 3 per task
 * Max parallel: 5 per wave
 *
 * WAVE 1 (3 tasks):
 *   1. [101] Scaffold project (high)
 *   2. [102] Add data model (high)
 *   3. [103] Setup testing (medium)
 *
 * WAVE 2 (2 tasks):
 *   4. [104] Build service layer (high) -- after [101, 102]
 *   5. [105] Add validation (medium) -- after [102]
 *
 * BLOCKED (unresolvable dependencies):
 *   [110] Some task -- blocked by: 999
 *
 * COMPLETED:
 *   5 tasks already completed
 * ```
 */
export function parseExecutionPlanMd(content: string): ExecutionPlanData {
  const result: ExecutionPlanData = {
    totalTasks: 0,
    totalWaves: 0,
    retryLimit: 3,
    maxParallel: 5,
    waves: [],
    blockedCount: 0,
    completedCount: 0,
    parseError: null,
  };

  if (!content || content.trim().length === 0) {
    result.parseError = "Empty execution plan";
    return result;
  }

  try {
    const lines = content.split("\n");
    let currentWave: WaveInfo | null = null;
    let inBlocked = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Total tasks
      const tasksMatch = trimmed.match(/^Tasks to execute:\s*(\d+)/i);
      if (tasksMatch) {
        result.totalTasks = parseInt(tasksMatch[1], 10);
        continue;
      }

      // Retry limit
      const retryMatch = trimmed.match(/^Retry limit:\s*(\d+)/i);
      if (retryMatch) {
        result.retryLimit = parseInt(retryMatch[1], 10);
        continue;
      }

      // Max parallel
      const parallelMatch = trimmed.match(/^Max parallel:\s*(\d+)/i);
      if (parallelMatch) {
        result.maxParallel = parseInt(parallelMatch[1], 10);
        continue;
      }

      // Wave header: WAVE N (M tasks):
      const waveMatch = trimmed.match(/^WAVE\s+(\d+)\s*\((\d+)\s+tasks?\)/i);
      if (waveMatch) {
        if (currentWave) {
          result.waves.push(currentWave);
        }
        inBlocked = false;
        currentWave = {
          waveNumber: parseInt(waveMatch[1], 10),
          taskCount: parseInt(waveMatch[2], 10),
          taskIds: [],
        };
        continue;
      }

      // Task within a wave: N. [{id}] {title} ...
      if (currentWave) {
        const taskMatch = trimmed.match(
          /^\d+\.\s*\[(\d+(?:\.\d+)?|[\w-]+)\]/,
        );
        if (taskMatch) {
          currentWave.taskIds.push(taskMatch[1]);
          continue;
        }
      }

      // BLOCKED section
      if (trimmed.match(/^BLOCKED/i)) {
        if (currentWave) {
          result.waves.push(currentWave);
          currentWave = null;
        }
        inBlocked = true;
        continue;
      }

      // Count blocked tasks
      if (inBlocked) {
        const blockedMatch = trimmed.match(/^\[(\d+(?:\.\d+)?|[\w-]+)\]/);
        if (blockedMatch) {
          result.blockedCount++;
          continue;
        }
      }

      // COMPLETED section
      const completedMatch = trimmed.match(
        /^(\d+)\s+tasks?\s+already\s+completed/i,
      );
      if (completedMatch) {
        if (currentWave) {
          result.waves.push(currentWave);
          currentWave = null;
        }
        result.completedCount = parseInt(completedMatch[1], 10);
        inBlocked = false;
        continue;
      }
    }

    // Push last wave if pending
    if (currentWave) {
      result.waves.push(currentWave);
    }

    result.totalWaves = result.waves.length;
  } catch (err) {
    result.parseError =
      err instanceof Error ? err.message : "Unknown parse error";
  }

  return result;
}

/**
 * Compute overall completion percentage.
 */
export function computeCompletionPercentage(
  completedCount: number,
  totalTasks: number,
): number {
  if (totalTasks <= 0) return 0;
  return Math.min(100, Math.round((completedCount / totalTasks) * 100));
}
