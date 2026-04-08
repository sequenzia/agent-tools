/**
 * Dual file watcher — ported from Rust watcher.rs.
 * Watches .agents/tasks/ for task changes and .agents/sessions/ for session changes.
 * Broadcasts events via WebSocket.
 */

import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";
import fs from "node:fs";
import type {
  FileChangeEvent,
  FileChangeBatch,
  SessionChangeEvent,
  SessionStatus,
  ResultFileChangeEvent,
} from "./types.js";
import { classifySessionStatus } from "./routes/sessions.js";

export type WebSocketBroadcast = (event: string, payload: unknown) => void;

const DEBOUNCE_MS = 100;
const SESSION_RECHECK_MS = 500;

interface WatcherState {
  taskWatchers: Map<string, FSWatcher>;
  sessionWatchers: Map<string, FSWatcher>;
  sessionStatusCache: Map<string, SessionStatus>;
  sessionRecheckTimers: Map<string, ReturnType<typeof setInterval>>;
  pendingTaskEvents: Map<string, FileChangeEvent[]>;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
}

const state: WatcherState = {
  taskWatchers: new Map(),
  sessionWatchers: new Map(),
  sessionStatusCache: new Map(),
  sessionRecheckTimers: new Map(),
  pendingTaskEvents: new Map(),
  debounceTimers: new Map(),
};

let broadcastFn: WebSocketBroadcast | null = null;

function broadcast(event: string, payload: unknown): void {
  broadcastFn?.(event, payload);
}

/**
 * Classify a file event kind from chokidar event name.
 */
function classifyKind(
  event: "add" | "change" | "unlink",
): FileChangeEvent["kind"] {
  switch (event) {
    case "add":
      return "create";
    case "change":
      return "modify";
    case "unlink":
      return "delete";
    default:
      return "unknown";
  }
}

/**
 * Flush pending task events for a project as a batch.
 */
function flushTaskEvents(projectPath: string): void {
  const events = state.pendingTaskEvents.get(projectPath);
  if (!events || events.length === 0) return;

  state.pendingTaskEvents.set(projectPath, []);

  const batch: FileChangeBatch = {
    events,
    project_path: projectPath,
  };
  broadcast("task-file-change", batch);
}

/**
 * Queue a task file event with debouncing.
 */
function queueTaskEvent(projectPath: string, event: FileChangeEvent): void {
  let pending = state.pendingTaskEvents.get(projectPath);
  if (!pending) {
    pending = [];
    state.pendingTaskEvents.set(projectPath, pending);
  }
  pending.push(event);

  // Reset debounce timer
  const existingTimer = state.debounceTimers.get(projectPath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    state.debounceTimers.delete(projectPath);
    flushTaskEvents(projectPath);
  }, DEBOUNCE_MS);
  state.debounceTimers.set(projectPath, timer);
}

/**
 * Check session status and emit change event if status changed.
 */
function checkAndEmitSessionChange(projectPath: string): void {
  const newStatus = classifySessionStatus(projectPath);
  const lastStatus = state.sessionStatusCache.get(projectPath);

  if (lastStatus !== newStatus) {
    state.sessionStatusCache.set(projectPath, newStatus);

    const sessionPath = path.join(
      projectPath,
      ".agents",
      "sessions",
      "__live_session__",
    );
    const event: SessionChangeEvent = {
      status: newStatus,
      project_path: projectPath,
      session_path: sessionPath,
    };
    broadcast("session-change", event);
  }
}

/**
 * Start watching a project's task and session directories.
 */
function addProjectWatch(projectPath: string): void {
  if (state.taskWatchers.has(projectPath)) return;

  const tasksDir = path.join(projectPath, ".agents", "tasks");

  // --- Task watcher ---
  if (fs.existsSync(tasksDir)) {
    const taskWatcher = chokidar.watch(tasksDir, {
      ignoreInitial: true,
      depth: 3,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    });

    taskWatcher.on("all", (eventName, filePath) => {
      // Only process .json files
      if (!filePath.endsWith(".json")) return;
      // Only process task-*.json files
      const basename = path.basename(filePath);
      if (!basename.startsWith("task-")) return;

      const kind = classifyKind(eventName as "add" | "change" | "unlink");
      const event: FileChangeEvent = {
        kind,
        path: filePath,
        project_path: projectPath,
      };
      queueTaskEvent(projectPath, event);
    });

    taskWatcher.on("error", (error: unknown) => {
      broadcast("task-watch-error", {
        message: error instanceof Error ? error.message : String(error),
        project_path: projectPath,
      });
    });

    state.taskWatchers.set(projectPath, taskWatcher);
  }

  // --- Session watcher ---
  // We watch the sessions directory if .agents/ exists
  const agentsDir = path.join(projectPath, ".agents");
  if (fs.existsSync(agentsDir)) {
    // Ensure sessions dir exists for watching (it may not yet)
    const sessionsPath = path.join(agentsDir, "sessions");
    if (!fs.existsSync(sessionsPath)) {
      try {
        fs.mkdirSync(sessionsPath, { recursive: true });
      } catch {
        // can't create, skip session watching
      }
    }

    if (fs.existsSync(sessionsPath)) {
      const sessionWatcher = chokidar.watch(sessionsPath, {
        ignoreInitial: true,
        depth: 2,
      });

      sessionWatcher.on("all", (eventName, filePath) => {
        // Check if this is a result file change
        const relativePath = path.relative(sessionsPath, filePath);
        const parts = relativePath.split(path.sep);

        if (parts[0] === "__live_session__") {
          const filename = parts[1];

          // Check for result file changes
          if (
            filename &&
            filename.startsWith("result-") &&
            filename.endsWith(".md")
          ) {
            const kind = eventName === "unlink" ? "delete" : "modify";
            const event: ResultFileChangeEvent = {
              filename,
              kind,
              project_path: projectPath,
            };
            broadcast("result-file-change", event);
          }

          // Always check session status on any live session change
          checkAndEmitSessionChange(projectPath);
        }
      });

      sessionWatcher.on("error", (error: unknown) => {
        broadcast("task-watch-error", {
          message: `Session watcher error: ${error instanceof Error ? error.message : String(error)}`,
          project_path: projectPath,
        });
      });

      state.sessionWatchers.set(projectPath, sessionWatcher);

      // Periodic recheck for session status (handles external state changes)
      const recheckTimer = setInterval(() => {
        checkAndEmitSessionChange(projectPath);
      }, SESSION_RECHECK_MS);
      state.sessionRecheckTimers.set(projectPath, recheckTimer);

      // Initialize session status cache
      state.sessionStatusCache.set(
        projectPath,
        classifySessionStatus(projectPath),
      );
    }
  }
}

/**
 * Stop watching a project.
 */
async function removeProjectWatch(projectPath: string): Promise<void> {
  const taskWatcher = state.taskWatchers.get(projectPath);
  if (taskWatcher) {
    await taskWatcher.close();
    state.taskWatchers.delete(projectPath);
  }

  const sessionWatcher = state.sessionWatchers.get(projectPath);
  if (sessionWatcher) {
    await sessionWatcher.close();
    state.sessionWatchers.delete(projectPath);
  }

  const recheckTimer = state.sessionRecheckTimers.get(projectPath);
  if (recheckTimer) {
    clearInterval(recheckTimer);
    state.sessionRecheckTimers.delete(projectPath);
  }

  state.sessionStatusCache.delete(projectPath);

  // Flush and clear pending events
  const debounceTimer = state.debounceTimers.get(projectPath);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    state.debounceTimers.delete(projectPath);
  }
  state.pendingTaskEvents.delete(projectPath);
}

// --- Public API ---

export function initWatcher(broadcastFunction: WebSocketBroadcast): void {
  broadcastFn = broadcastFunction;
}

export function handleWatcherMessage(
  event: string,
  payload: Record<string, unknown>,
): void {
  switch (event) {
    case "watch:start": {
      const paths = payload.projectPaths as string[];
      if (Array.isArray(paths)) {
        for (const p of paths) {
          addProjectWatch(p);
        }
      }
      break;
    }
    case "watch:stop": {
      stopAllWatchers();
      break;
    }
    case "watch:add": {
      const projectPath = payload.projectPath as string;
      if (projectPath) {
        addProjectWatch(projectPath);
      }
      break;
    }
    case "watch:remove": {
      const projectPath = payload.projectPath as string;
      if (projectPath) {
        removeProjectWatch(projectPath);
      }
      break;
    }
  }
}

export async function stopAllWatchers(): Promise<void> {
  const allPaths = [
    ...state.taskWatchers.keys(),
    ...state.sessionWatchers.keys(),
  ];
  const unique = [...new Set(allPaths)];
  await Promise.all(unique.map(removeProjectWatch));
}
