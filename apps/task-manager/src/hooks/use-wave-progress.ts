import { useEffect, useRef, useCallback, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSessionStore } from "../stores/session-store";
import type { SessionChangeEvent } from "../services/session-service";
import {
  parseProgressMd,
  parseExecutionPlanMd,
  computeCompletionPercentage,
  type ProgressData,
  type ExecutionPlanData,
} from "../services/progress-parser";

/** IPC event name emitted by the Rust session watcher. */
const EVENT_SESSION_CHANGE = "session-change";

/** Polling interval in ms for refreshing progress data when session is active. */
const POLL_INTERVAL_MS = 2000;

/** Combined wave progress state. */
export interface WaveProgressState {
  /** Parsed progress.md data. */
  progress: ProgressData | null;
  /** Parsed execution_plan.md data. */
  plan: ExecutionPlanData | null;
  /** Overall completion percentage (0-100). */
  completionPct: number;
  /** Total tasks (from plan or progress). */
  totalTasks: number;
  /** Completed task count. */
  completedCount: number;
  /** Whether data is loading. */
  isLoading: boolean;
  /** Whether the session is active/interrupted (dashboard should show). */
  isActive: boolean;
  /** Error message if something went wrong. */
  error: string | null;
}

const INITIAL_STATE: WaveProgressState = {
  progress: null,
  plan: null,
  completionPct: 0,
  totalTasks: 0,
  completedCount: 0,
  isLoading: false,
  isActive: false,
  error: null,
};

/**
 * Hook that tracks wave progress for the execution dashboard.
 *
 * Listens for session-change events from the Rust watcher. When a session
 * is active, it polls progress.md and execution_plan.md via the session
 * store's fetchSessionFile, parsing them into structured data.
 *
 * @param projectPath - The active project path, or null if none selected.
 */
export function useWaveProgress(
  projectPath: string | null,
): WaveProgressState {
  const [state, setState] = useState<WaveProgressState>(INITIAL_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const { fetchSessionFile, status, isDashboardActive, updateSessionStatus } =
    useSessionStore();

  /** Fetch and parse both session files. */
  const refresh = useCallback(async () => {
    if (!projectPath) return;

    setState((prev) => ({ ...prev, isLoading: prev.progress === null }));

    try {
      const [progressResult, planResult] = await Promise.all([
        fetchSessionFile(projectPath, "progress.md"),
        fetchSessionFile(projectPath, "execution_plan.md"),
      ]);

      if (!mountedRef.current) return;

      const progressData = progressResult?.content
        ? parseProgressMd(progressResult.content)
        : null;

      const planData = planResult?.content
        ? parseExecutionPlanMd(planResult.content)
        : null;

      const completedCount = progressData?.completedTasks.length ?? 0;
      const totalFromPlan = planData?.totalTasks ?? 0;
      const totalFromProgress =
        completedCount + (progressData?.activeTasks.length ?? 0);
      const totalTasks = totalFromPlan > 0 ? totalFromPlan : totalFromProgress;

      const completionPct = computeCompletionPercentage(
        completedCount,
        totalTasks,
      );

      const parseError =
        progressData?.parseError ?? planData?.parseError ?? null;

      setState({
        progress: progressData,
        plan: planData,
        completionPct,
        totalTasks,
        completedCount,
        isLoading: false,
        isActive: true,
        error: parseError,
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
              : "Failed to fetch progress data",
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
  }, [projectPath, updateSessionStatus]);

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
