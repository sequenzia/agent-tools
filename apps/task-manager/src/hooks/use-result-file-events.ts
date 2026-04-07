import { useEffect, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useResultStore } from "../stores/result-store";

/**
 * Event payload from the Rust backend when a result file changes.
 * Must match watcher.rs ResultFileChangeEvent.
 */
export interface ResultFileChangeEvent {
  filename: string;
  kind: "modify" | "delete";
  project_path: string;
}

/** Tauri IPC event name for result file changes (must match watcher.rs). */
const EVENT_RESULT_FILE_CHANGE = "result-file-change";

/**
 * React hook that listens for result file changes from the Tauri backend
 * and updates the result store accordingly.
 *
 * On mount (when projectPath is provided), it:
 * 1. Loads all existing result files from the session directory
 * 2. Subscribes to the result-file-change event
 * 3. Adds/removes results as events arrive
 */
export function useResultFileEvents(projectPath: string | null): void {
  const addResult = useResultStore((s) => s.addResult);
  const removeResult = useResultStore((s) => s.removeResult);
  const loadAllResults = useResultStore((s) => s.loadAllResults);
  const clearResults = useResultStore((s) => s.clearResults);
  const projectPathRef = useRef(projectPath);

  useEffect(() => {
    projectPathRef.current = projectPath;
  }, [projectPath]);

  const handleEvent = useCallback(
    (event: { payload: ResultFileChangeEvent }) => {
      const { filename, kind, project_path } = event.payload;

      // Only process events for the active project
      if (project_path !== projectPathRef.current) return;

      if (kind === "delete") {
        removeResult(filename);
      } else {
        // "modify" covers both create and modify (debouncer-mini coalesces)
        if (projectPathRef.current) {
          addResult(projectPathRef.current, filename);
        }
      }
    },
    [addResult, removeResult],
  );

  useEffect(() => {
    if (!projectPath) {
      clearResults();
      return;
    }

    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    const setup = async () => {
      // Load existing results first
      await loadAllResults(projectPath);

      if (cancelled) return;

      // Subscribe to new result file events
      unlisten = await listen<ResultFileChangeEvent>(
        EVENT_RESULT_FILE_CHANGE,
        handleEvent,
      );
    };

    setup();

    return () => {
      cancelled = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [projectPath, loadAllResults, clearResults, handleEvent]);
}
