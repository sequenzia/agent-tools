import { useEffect, useRef, useCallback, useState } from "react";
import { api, ws } from "../services/api-client";
import { TaskSchema } from "../types";
import { useTaskStore } from "../stores/task-store";
import { perfMonitor } from "../services/perf-monitor";
import type { TaskWithPath } from "../services/task-service";

// --- Event payload types matching server watcher.ts ---

/** A single file change event from the backend. */
export interface FileChangeEvent {
  kind: "create" | "modify" | "delete" | "unknown";
  path: string;
  project_path: string;
}

/** A batch of file change events (debounced by the backend). */
export interface FileChangeBatch {
  events: FileChangeEvent[];
  project_path: string;
}

/** Error event from the watcher. */
export interface WatchErrorEvent {
  message: string;
  project_path: string;
}

/** Disconnection event from the watcher. */
export interface WatchDisconnectedEvent {
  message: string;
  project_path: string;
}

// --- Frontend debounce settings ---

/** How long to wait before flushing accumulated events into a store update. */
const DEBOUNCE_MS = 50;

// --- Raw API result matching task-service.ts ---

interface TaskFileResult {
  type: "ok" | "error";
  task?: Record<string, unknown>;
  file_path: string;
  error?: string;
  mtime_ms?: number;
}

/** Result type for the hook's connection state. */
export interface TaskFileEventsState {
  /** Whether the event listener is connected. */
  isConnected: boolean;
  /** The last watcher error message, if any. */
  lastError: string | null;
}

/**
 * Attempt to re-read a task file from disk via the API and parse it.
 * Returns the parsed TaskWithPath on success, or null on failure.
 */
async function reReadTask(filePath: string): Promise<TaskWithPath | null> {
  try {
    const raw = await api.get<TaskFileResult>("/api/tasks/file", {
      filePath,
    });

    if (raw.type === "error" || !raw.task) {
      return null;
    }

    const parsed = TaskSchema.safeParse(raw.task);
    if (!parsed.success) {
      return null;
    }

    return { task: parsed.data, filePath: raw.file_path, mtimeMs: raw.mtime_ms ?? 0 };
  } catch {
    return null;
  }
}

/**
 * Deduplicate events for the same file path within a batch.
 * Keeps the last event for each path (most recent wins).
 */
function deduplicateEvents(events: FileChangeEvent[]): FileChangeEvent[] {
  const seen = new Map<string, FileChangeEvent>();
  for (const event of events) {
    seen.set(event.path, event);
  }
  return Array.from(seen.values());
}

/**
 * React hook that listens for file watcher events via WebSocket and reconciles
 * them into task store state updates.
 *
 * - Listens for `task-file-change`, `task-watch-disconnected`, and `task-watch-error` events
 * - Debounces events on the frontend to batch store updates
 * - Re-reads task JSON from disk on create/modify events
 * - Handles out-of-order, duplicate, and stale events
 *
 * @param projectPath - The project path to filter events for (null to disable)
 */
export function useTaskFileEvents(projectPath: string | null): TaskFileEventsState {
  const [isConnected, setIsConnected] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const pendingEventsRef = useRef<FileChangeEvent[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedRef = useRef(new Set<string>());

  const flushEvents = useCallback(async () => {
    const events = pendingEventsRef.current;
    pendingEventsRef.current = [];
    // Clear dedup set each flush so repeated events for the same path are not dropped across windows
    processedRef.current.clear();

    if (events.length === 0) return;

    perfMonitor.mark("file-event-to-ui");

    // Deduplicate: keep last event per path
    const deduped = deduplicateEvents(events);

    type Mutation =
      | { type: "upsert"; taskWithPath: TaskWithPath }
      | { type: "remove"; filePath: string }
      | { type: "stale"; filePath: string };

    const mutations: Mutation[] = [];

    // Process all events concurrently
    const results = await Promise.all(
      deduped.map(async (event): Promise<Mutation | null> => {
        switch (event.kind) {
          case "create":
          case "modify": {
            const twp = await reReadTask(event.path);
            if (twp) {
              return { type: "upsert", taskWithPath: twp };
            }
            // Failed to re-read: mark as stale for modify, ignore for create
            if (event.kind === "modify") {
              return { type: "stale", filePath: event.path };
            }
            return null;
          }
          case "delete":
            return { type: "remove", filePath: event.path };
          default:
            // Unknown event kind: attempt re-read to see if file exists
            {
              const twp = await reReadTask(event.path);
              if (twp) {
                return { type: "upsert", taskWithPath: twp };
              }
              return { type: "remove", filePath: event.path };
            }
        }
      }),
    );

    for (const result of results) {
      if (result) {
        mutations.push(result);
      }
    }

    if (mutations.length > 0) {
      useTaskStore.getState().applyBatch(mutations);
      perfMonitor.measure("file-event-to-ui", { eventCount: deduped.length, mutationCount: mutations.length });
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      flushEvents();
    }, DEBOUNCE_MS);
  }, [flushEvents]);

  useEffect(() => {
    if (!projectPath) return;

    // Reset non-render state for new project
    processedRef.current = new Set();
    pendingEventsRef.current = [];

    // Subscribe to WebSocket events
    const unsubChange = ws.on<FileChangeBatch>(
      "task-file-change",
      (batch) => {
        // Filter events for the current project path
        if (batch.project_path !== projectPath) return;

        // Generate a dedup key for each event to detect stale/duplicate events
        for (const fileEvent of batch.events) {
          const dedupKey = `${fileEvent.kind}:${fileEvent.path}`;
          // Skip if we've already seen this exact event within the current flush window
          if (processedRef.current.has(dedupKey)) continue;
          processedRef.current.add(dedupKey);

          pendingEventsRef.current.push(fileEvent);
        }

        scheduleFlush();
      },
    );

    const unsubDisconnect = ws.on<WatchDisconnectedEvent>(
      "task-watch-disconnected",
      (payload) => {
        if (payload.project_path !== projectPath) return;

        setIsConnected(false);
        setLastError(payload.message);

        // Attempt reconnection after a delay
        setTimeout(() => {
          ws.send("watch:start", { projectPaths: [projectPath] });
          setIsConnected(true);
          setLastError(null);
        }, 2000);
      },
    );

    const unsubError = ws.on<WatchErrorEvent>(
      "task-watch-error",
      (payload) => {
        if (payload.project_path !== projectPath && payload.project_path !== "")
          return;
        setLastError(payload.message);
      },
    );

    // Re-establish watchers on WebSocket reconnection (server may have restarted)
    const unsubReconnect = ws.on("ws:reconnect", () => {
      ws.send("watch:start", { projectPaths: [projectPath] });
      setIsConnected(true);
      setLastError(null);
    });

    // Start watching this project (queued if WS not yet open)
    ws.send("watch:start", { projectPaths: [projectPath] });

    return () => {
      unsubChange();
      unsubDisconnect();
      unsubError();
      unsubReconnect();
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingEventsRef.current = [];
      processedRef.current.clear();
      // Reset connection state on cleanup (project change or unmount)
      setIsConnected(true);
      setLastError(null);
    };
  }, [projectPath, scheduleFlush]);

  return {
    isConnected,
    lastError,
  };
}
