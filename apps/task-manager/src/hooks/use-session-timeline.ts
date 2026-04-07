import { useEffect, useRef, useCallback, useState } from "react";
import { useSessionStore } from "../stores/session-store";
import {
  parseTaskLog,
  type TimelineData,
  type TimelineEvent,
} from "../services/timeline-service";
import {
  parseProgressMd,
  type ProgressData,
} from "../services/progress-parser";

/** Polling interval in ms for refreshing timeline data. */
const POLL_INTERVAL_MS = 2000;

/** Combined timeline state exposed by the hook. */
export interface SessionTimelineState {
  /** Parsed timeline data (events + summary). */
  timeline: TimelineData | null;
  /** Whether data is loading (first fetch only). */
  isLoading: boolean;
  /** Whether the session is active (dashboard should show). */
  isActive: boolean;
  /** Error message if something went wrong. */
  error: string | null;
}

const INITIAL_STATE: SessionTimelineState = {
  timeline: null,
  isLoading: false,
  isActive: false,
  error: null,
};

/**
 * Hook that tracks the session timeline by polling task_log.md and progress.md.
 *
 * Produces a sorted list of timeline events (started/completed/failed) with
 * summary statistics. Polls while the session is active.
 *
 * @param projectPath - The active project path, or null if none selected.
 */
export function useSessionTimeline(
  projectPath: string | null,
): SessionTimelineState {
  const [state, setState] = useState<SessionTimelineState>(INITIAL_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const prevEventsRef = useRef<TimelineEvent[]>([]);

  const { fetchSessionFile, status, isDashboardActive } = useSessionStore();

  /** Fetch task_log.md and progress.md, parse into timeline. */
  const refresh = useCallback(async () => {
    if (!projectPath) return;

    setState((prev) => ({ ...prev, isLoading: prev.timeline === null }));

    try {
      const [logResult, progressResult] = await Promise.all([
        fetchSessionFile(projectPath, "task_log.md"),
        fetchSessionFile(projectPath, "progress.md"),
      ]);

      if (!mountedRef.current) return;

      // Extract active tasks from progress.md for "started" events
      let activeTasks: Array<{ id: string; title: string }> = [];
      if (progressResult?.content) {
        const progressData: ProgressData = parseProgressMd(
          progressResult.content,
        );
        activeTasks = progressData.activeTasks
          .filter((t) => t.status === "running" || t.status === "queued")
          .map((t) => ({ id: t.id, title: t.title }));
      }

      const logContent = logResult?.content ?? null;
      const timeline = parseTaskLog(logContent, activeTasks);

      // Track events for auto-scroll detection
      prevEventsRef.current = timeline.events;

      setState({
        timeline,
        isLoading: false,
        isActive: true,
        error: timeline.parseError,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to fetch timeline data",
      }));
    }
  }, [projectPath, fetchSessionFile]);

  /** Start polling interval. */
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
  }, [refresh]);

  /** Stop polling interval. */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // React to session status changes: start/stop polling.
  useEffect(() => {
    const isSessionActive = status === "active" || status === "interrupted";

    if (isSessionActive && projectPath) {
      refresh();
      startPolling();
    } else {
      stopPolling();
      if (!isSessionActive) {
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return state;
}
