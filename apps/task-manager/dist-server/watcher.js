/**
 * Dual file watcher — ported from Rust watcher.rs.
 * Watches .agents/tasks/ for task changes and .agents/sessions/ for session changes.
 * Broadcasts events via WebSocket.
 */
import chokidar from "chokidar";
import path from "node:path";
import fs from "node:fs";
import { classifySessionStatus } from "./routes/sessions.js";
const DEBOUNCE_MS = 100;
const SESSION_RECHECK_MS = 500;
let state = {
    taskWatchers: new Map(),
    sessionWatchers: new Map(),
    sessionStatusCache: new Map(),
    sessionRecheckTimers: new Map(),
    pendingTaskEvents: new Map(),
    debounceTimers: new Map(),
};
let broadcastFn = null;
function broadcast(event, payload) {
    broadcastFn?.(event, payload);
}
/**
 * Classify a file event kind from chokidar event name.
 */
function classifyKind(event) {
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
function flushTaskEvents(projectPath) {
    const events = state.pendingTaskEvents.get(projectPath);
    if (!events || events.length === 0)
        return;
    state.pendingTaskEvents.set(projectPath, []);
    const batch = {
        events,
        project_path: projectPath,
    };
    broadcast("task-file-change", batch);
}
/**
 * Queue a task file event with debouncing.
 */
function queueTaskEvent(projectPath, event) {
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
function checkAndEmitSessionChange(projectPath) {
    const newStatus = classifySessionStatus(projectPath);
    const lastStatus = state.sessionStatusCache.get(projectPath);
    if (lastStatus !== newStatus) {
        state.sessionStatusCache.set(projectPath, newStatus);
        const sessionPath = path.join(projectPath, ".agents", "sessions", "__live_session__");
        const event = {
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
function addProjectWatch(projectPath) {
    if (state.taskWatchers.has(projectPath))
        return;
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
            if (!filePath.endsWith(".json"))
                return;
            // Only process task-*.json files
            const basename = path.basename(filePath);
            if (!basename.startsWith("task-"))
                return;
            const kind = classifyKind(eventName);
            const event = {
                kind,
                path: filePath,
                project_path: projectPath,
            };
            queueTaskEvent(projectPath, event);
        });
        taskWatcher.on("error", (error) => {
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
            }
            catch {
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
                    if (filename &&
                        filename.startsWith("result-") &&
                        filename.endsWith(".md")) {
                        const kind = eventName === "unlink" ? "delete" : "modify";
                        const event = {
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
            sessionWatcher.on("error", (error) => {
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
            state.sessionStatusCache.set(projectPath, classifySessionStatus(projectPath));
        }
    }
}
/**
 * Stop watching a project.
 */
async function removeProjectWatch(projectPath) {
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
export function initWatcher(broadcastFunction) {
    broadcastFn = broadcastFunction;
}
export function handleWatcherMessage(event, payload) {
    switch (event) {
        case "watch:start": {
            const paths = payload.projectPaths;
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
            const projectPath = payload.projectPath;
            if (projectPath) {
                addProjectWatch(projectPath);
            }
            break;
        }
        case "watch:remove": {
            const projectPath = payload.projectPath;
            if (projectPath) {
                removeProjectWatch(projectPath);
            }
            break;
        }
    }
}
export async function stopAllWatchers() {
    const allPaths = [
        ...state.taskWatchers.keys(),
        ...state.sessionWatchers.keys(),
    ];
    const unique = [...new Set(allPaths)];
    await Promise.all(unique.map(removeProjectWatch));
}
//# sourceMappingURL=watcher.js.map