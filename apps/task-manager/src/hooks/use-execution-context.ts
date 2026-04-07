import { useEffect, useRef, useCallback, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSessionStore } from "../stores/session-store";
import type { SessionChangeEvent } from "../services/session-service";

/** IPC event name emitted by the Rust session watcher. */
const EVENT_SESSION_CHANGE = "session-change";

/** Polling interval in ms for refreshing execution context when session is active. */
const POLL_INTERVAL_MS = 3000;

/** Debounce delay in ms to prevent rapid re-renders from rapid file writes. */
const DEBOUNCE_MS = 500;

/** State exposed by the useExecutionContext hook. */
export interface ExecutionContextState {
  /** The current markdown content, or null if file doesn't exist. */
  content: string | null;
  /** The previous content snapshot for diffing (null on first load). */
  previousContent: string | null;
  /** Line numbers that are new since the last content change. */
  newLineIndices: Set<number>;
  /** Whether the initial load is in progress. */
  isLoading: boolean;
  /** Whether the session is active/interrupted (dashboard should show). */
  isActive: boolean;
  /** Error message if the file read failed. */
  error: string | null;
  /** Whether the displayed content is stale (read error with fallback). */
  isStale: boolean;
  /** Timestamp of the last successful content update. */
  lastUpdated: number | null;
}

const INITIAL_STATE: ExecutionContextState = {
  content: null,
  previousContent: null,
  newLineIndices: new Set(),
  isLoading: false,
  isActive: false,
  error: null,
  isStale: false,
  lastUpdated: null,
};

/**
 * Compute which lines in `current` are new compared to `previous`.
 * Returns a Set of zero-based line indices that appear in `current` but not in `previous`.
 *
 * Uses a simple line-by-line comparison: lines at the end of the file that
 * weren't present in the previous version are marked as new.
 */
function computeNewLines(previous: string, current: string): Set<number> {
  const prevLines = previous.split("\n");
  const currLines = current.split("\n");

  const newIndices = new Set<number>();

  // If the current content is shorter or the same length, no new lines at the bottom.
  if (currLines.length <= prevLines.length) {
    // Check if content changed in place (replaced, not appended).
    // Mark changed lines as new.
    for (let i = 0; i < currLines.length; i++) {
      if (i >= prevLines.length || currLines[i] !== prevLines[i]) {
        newIndices.add(i);
      }
    }
    return newIndices;
  }

  // Find the first differing line.
  let firstDiff = 0;
  while (
    firstDiff < prevLines.length &&
    firstDiff < currLines.length &&
    prevLines[firstDiff] === currLines[firstDiff]
  ) {
    firstDiff++;
  }

  // All lines from firstDiff onward in current are new.
  for (let i = firstDiff; i < currLines.length; i++) {
    newIndices.add(i);
  }

  return newIndices;
}

export { computeNewLines as _computeNewLines };

/**
 * Hook that tracks the execution_context.md file content during live sessions.
 *
 * Listens for session-change events from the Rust watcher. When a session
 * is active, it polls execution_context.md via the session store's
 * fetchSessionFile, computing diffs to highlight new content.
 *
 * @param projectPath - The active project path, or null if none selected.
 */
export function useExecutionContext(
  projectPath: string | null,
): ExecutionContextState {
  const [state, setState] = useState<ExecutionContextState>(INITIAL_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lastContentRef = useRef<string | null>(null);

  const { fetchSessionFile, status, isDashboardActive, updateSessionStatus } =
    useSessionStore();

  /** Fetch and process execution_context.md. */
  const refresh = useCallback(async () => {
    if (!projectPath) return;

    setState((prev) => ({ ...prev, isLoading: prev.content === null }));

    try {
      const result = await fetchSessionFile(
        projectPath,
        "execution_context.md",
      );

      if (!mountedRef.current) return;

      if (!result || !result.exists || result.content === null) {
        // File doesn't exist yet.
        setState((prev) => ({
          ...prev,
          content: null,
          isLoading: false,
          isActive: true,
          error: null,
          isStale: false,
        }));
        return;
      }

      const newContent = result.content;
      const prevContent = lastContentRef.current;

      // Skip update if content hasn't changed.
      if (prevContent === newContent) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isActive: true,
          error: null,
          isStale: false,
        }));
        return;
      }

      // Compute new lines for highlighting.
      const newLineIndices =
        prevContent !== null
          ? computeNewLines(prevContent, newContent)
          : new Set<number>();

      lastContentRef.current = newContent;

      setState({
        content: newContent,
        previousContent: prevContent,
        newLineIndices,
        isLoading: false,
        isActive: true,
        error: null,
        isStale: false,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      if (!mountedRef.current) return;
      // On error, keep last known content but mark as stale.
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isStale: prev.content !== null,
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to read execution context",
      }));
    }
  }, [projectPath, fetchSessionFile]);

  /** Debounced refresh to handle rapid file writes. */
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      refresh();
    }, DEBOUNCE_MS);
  }, [refresh]);

  /** Start polling interval. */
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      debouncedRefresh();
    }, POLL_INTERVAL_MS);
  }, [debouncedRefresh]);

  /** Stop polling interval. */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // Listen for session-change events from the Rust watcher.
  useEffect(() => {
    if (!projectPath) return;

    mountedRef.current = true;
    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      unlisten = await listen<SessionChangeEvent>(
        EVENT_SESSION_CHANGE,
        (event) => {
          if (!mountedRef.current) return;
          if (event.payload.project_path !== projectPath) return;

          const newStatus = event.payload.status;
          updateSessionStatus(newStatus);

          // Session changed — trigger a refresh to pick up new content.
          if (
            newStatus === "active" ||
            newStatus === "interrupted"
          ) {
            debouncedRefresh();
          }
        },
      );
    };

    setup();

    return () => {
      mountedRef.current = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [projectPath, updateSessionStatus, debouncedRefresh]);

  // React to session status changes: start/stop polling.
  useEffect(() => {
    const isSessionActive = status === "active" || status === "interrupted";

    if (isSessionActive && projectPath) {
      // Initial fetch, then start polling.
      refresh();
      startPolling();
    } else {
      stopPolling();
      if (!isSessionActive) {
        // Reset state when session ends, but keep lastContentRef for next session.
        lastContentRef.current = null;
        setState(INITIAL_STATE);
      }
    }

    return () => {
      stopPolling();
    };
  }, [status, projectPath, refresh, startPolling, stopPolling]);

  // Sync isActive from store state.
  useEffect(() => {
    setState((prev) => {
      const shouldBeActive = isDashboardActive;
      if (prev.isActive !== shouldBeActive) {
        return { ...prev, isActive: shouldBeActive };
      }
      return prev;
    });
  }, [isDashboardActive]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return state;
}
