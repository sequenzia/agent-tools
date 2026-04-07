/**
 * Parser for task_log.md to produce timeline events.
 *
 * The task_log.md file is written by the SDD execute-tasks orchestrator
 * and follows a markdown table format:
 *
 * ```
 * # Task Execution Log
 *
 * | Task ID | Subject | Status | Attempts | Duration | Token Usage |
 * |---------|---------|--------|----------|----------|-------------|
 * | 101 | Scaffold project | PASS | 1/3 | 45s | 12345 |
 * | 102 | Add data model | FAIL | 2/3 | 1m 23s | 45678 |
 * ```
 *
 * Each table row is mapped to a "completed" (or "failed") timeline event.
 * Active tasks from progress.md are mapped to "started" events.
 */

/** Event type for timeline entries. */
export type TimelineEventType = "started" | "completed" | "failed";

/** A single event in the session timeline. */
export interface TimelineEvent {
  /** Task ID (e.g., "101"). */
  taskId: string;
  /** Task subject/title. */
  title: string;
  /** Event type: started, completed, or failed. */
  type: TimelineEventType;
  /** Duration string for completed/failed events (e.g., "45s", "1m 23s"). */
  duration: string | null;
  /** Duration in seconds (parsed from duration string) for calculations. */
  durationSeconds: number | null;
  /** Status string for completed events (PASS, PARTIAL, FAIL). */
  status: string | null;
  /** Attempt info (e.g., "1/3"). */
  attempts: string | null;
  /** Ordering index (row position in log, or Infinity for active tasks). */
  order: number;
  /** Whether this entry had a parse warning. */
  isMalformed: boolean;
}

/** Summary statistics for the timeline. */
export interface TimelineSummary {
  /** Total number of completed tasks. */
  tasksCompleted: number;
  /** Number of passed tasks. */
  tasksPassed: number;
  /** Number of failed tasks. */
  tasksFailed: number;
  /** Number of currently running tasks. */
  tasksRunning: number;
  /** Total duration in seconds (sum of all completed task durations). */
  totalDurationSeconds: number;
  /** Formatted total duration string. */
  totalDuration: string;
  /** Average task duration in seconds. */
  averageDurationSeconds: number;
  /** Formatted average duration string. */
  averageDuration: string;
}

/** Full timeline parse result. */
export interface TimelineData {
  /** All timeline events sorted chronologically. */
  events: TimelineEvent[];
  /** Summary statistics. */
  summary: TimelineSummary;
  /** Parse error, if any (partial data may still be available). */
  parseError: string | null;
  /** Number of malformed entries that were skipped. */
  malformedCount: number;
}

/**
 * Parse a duration string into seconds.
 *
 * Handles formats:
 * - "45s" -> 45
 * - "1m 23s" -> 83
 * - "2m" -> 120
 * - "1h 5m 30s" -> 3930
 * - "123.4s" -> 123
 * - "N/A" or empty -> null
 */
export function parseDuration(duration: string): number | null {
  if (!duration || duration.trim() === "" || duration.trim().toLowerCase() === "n/a") {
    return null;
  }

  const trimmed = duration.trim();

  // Try hours/minutes/seconds pattern
  const hours = trimmed.match(/(\d+)\s*h/);
  const minutes = trimmed.match(/(\d+)\s*m(?!s)/);
  const seconds = trimmed.match(/(\d+(?:\.\d+)?)\s*s/);

  if (hours || minutes || seconds) {
    let total = 0;
    if (hours) total += parseInt(hours[1], 10) * 3600;
    if (minutes) total += parseInt(minutes[1], 10) * 60;
    if (seconds) total += Math.round(parseFloat(seconds[1]));
    return total;
  }

  // Try plain number (assume seconds)
  const plainNum = parseFloat(trimmed);
  if (!isNaN(plainNum)) {
    return Math.round(plainNum);
  }

  return null;
}

/**
 * Format seconds into a human-readable duration string.
 *
 * Examples: "45s", "1m 23s", "1h 5m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return "0s";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

/**
 * Parse a single table row from task_log.md into a timeline event.
 *
 * Expected format: | {id} | {subject} | {status} | {attempts} | {duration} | {tokens} |
 */
function parseLogRow(row: string, index: number): TimelineEvent | null {
  // Split on pipe, trim each cell. Leading/trailing pipes produce empty
  // strings at index 0 and last, so slice them off.
  const rawCells = row.split("|").map((c) => c.trim());
  // Remove leading empty string (before first |) and trailing (after last |)
  const cells =
    rawCells.length >= 2
      ? rawCells.slice(1, rawCells[rawCells.length - 1] === "" ? -1 : undefined)
      : rawCells;

  // Need at least 4 cells: id, subject, status, attempts
  if (cells.length < 4) return null;

  const [taskId, title, status, attempts, duration] = cells;

  // Skip separator rows (all dashes)
  if (/^[-\s]+$/.test(taskId)) return null;

  // Skip header row
  if (taskId.toLowerCase() === "task id") return null;

  // Validate task ID is a number or valid identifier
  if (!/^[\w.-]+$/.test(taskId)) return null;

  const statusUpper = status.toUpperCase();
  const isFailed = statusUpper === "FAIL" || statusUpper === "FAILED";
  const eventType: TimelineEventType = isFailed ? "failed" : "completed";

  const durationStr = duration ?? null;
  const durationSecs = durationStr ? parseDuration(durationStr) : null;

  return {
    taskId,
    title,
    type: eventType,
    duration: durationStr || null,
    durationSeconds: durationSecs,
    status: status || null,
    attempts: attempts || null,
    order: index,
    isMalformed: false,
  };
}

/**
 * Parse task_log.md content into structured timeline data.
 *
 * @param logContent - Raw content of task_log.md (may be null if file doesn't exist)
 * @param activeTasks - Active tasks from progress.md to include as "started" events
 */
export function parseTaskLog(
  logContent: string | null,
  activeTasks?: Array<{ id: string; title: string }>,
): TimelineData {
  const events: TimelineEvent[] = [];
  let parseError: string | null = null;
  let malformedCount = 0;

  // Parse task_log.md rows
  if (logContent && logContent.trim().length > 0) {
    try {
      const lines = logContent.split("\n");
      let rowIndex = 0;
      let inTable = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and heading
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Detect table rows (start with |)
        if (trimmed.startsWith("|")) {
          inTable = true;

          // Skip separator rows
          if (/^\|[\s-|]+\|$/.test(trimmed)) continue;

          const event = parseLogRow(trimmed, rowIndex);
          if (event) {
            events.push(event);
            rowIndex++;
          } else if (inTable && !trimmed.includes("Task ID")) {
            // Malformed row in table (not header, not separator)
            malformedCount++;
          }
        }
      }
    } catch (err) {
      parseError =
        err instanceof Error ? err.message : "Unknown parse error in task_log.md";
    }
  }

  // Add "started" events for active tasks (from progress.md)
  if (activeTasks && activeTasks.length > 0) {
    for (const task of activeTasks) {
      // Only add if not already in completed events
      const isCompleted = events.some((e) => e.taskId === task.id);
      if (!isCompleted) {
        events.push({
          taskId: task.id,
          title: task.title,
          type: "started",
          duration: null,
          durationSeconds: null,
          status: null,
          attempts: null,
          order: events.length,
          isMalformed: false,
        });
      }
    }
  }

  // Sort by order (chronological — completed first by table order, then started)
  events.sort((a, b) => a.order - b.order);

  // Compute summary statistics
  const completedEvents = events.filter(
    (e) => e.type === "completed" || e.type === "failed",
  );
  const passedEvents = completedEvents.filter(
    (e) => e.status?.toUpperCase() === "PASS",
  );
  const failedEvents = completedEvents.filter(
    (e) => e.type === "failed" || e.status?.toUpperCase() === "FAIL",
  );
  const runningEvents = events.filter((e) => e.type === "started");

  const durationsInSeconds = completedEvents
    .map((e) => e.durationSeconds)
    .filter((d): d is number => d !== null);

  const totalDurationSeconds = durationsInSeconds.reduce(
    (sum, d) => sum + d,
    0,
  );
  const averageDurationSeconds =
    durationsInSeconds.length > 0
      ? Math.round(totalDurationSeconds / durationsInSeconds.length)
      : 0;

  const summary: TimelineSummary = {
    tasksCompleted: completedEvents.length,
    tasksPassed: passedEvents.length,
    tasksFailed: failedEvents.length,
    tasksRunning: runningEvents.length,
    totalDurationSeconds,
    totalDuration: formatDuration(totalDurationSeconds),
    averageDurationSeconds,
    averageDuration: formatDuration(averageDurationSeconds),
  };

  return {
    events,
    summary,
    parseError,
    malformedCount,
  };
}
