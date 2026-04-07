import { useEffect, useCallback, useRef } from "react";
import { ws } from "../services/api-client";
import { useResultStore } from "../stores/result-store";

/**
 * Event payload from the backend when a result file changes.
 * Must match server watcher.ts ResultFileChangeEvent.
 */
export interface ResultFileChangeEvent {
  filename: string;
  kind: "modify" | "delete";
  project_path: string;
}

/**
 * React hook that listens for result file changes from the WebSocket
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
    (payload: ResultFileChangeEvent) => {
      const { filename, kind, project_path } = payload;

      // Only process events for the active project
      if (project_path !== projectPathRef.current) return;

      if (kind === "delete") {
        removeResult(filename);
      } else {
        // "modify" covers both create and modify (debouncer coalesces)
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

    // Load existing results first
    loadAllResults(projectPath);

    // Subscribe to new result file events via WebSocket
    const unsub = ws.on<ResultFileChangeEvent>(
      "result-file-change",
      handleEvent,
    );

    return () => {
      unsub();
    };
  }, [projectPath, loadAllResults, clearResults, handleEvent]);
}
