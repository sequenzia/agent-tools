import { create } from "zustand";
import {
  checkLiveSession,
  readSessionFile,
  type LiveSessionInfo,
  type SessionFileResult,
  type SessionStatus,
} from "../services/session-service";

interface SessionState {
  /** Current session status. */
  status: SessionStatus;
  /** Full session info from the last check. Null until first check. */
  sessionInfo: LiveSessionInfo | null;
  /** Whether the session check is in progress. */
  isChecking: boolean;
  /** Error from the last session check. */
  error: string | null;
  /** Cached session file contents, keyed by filename. */
  sessionFiles: Map<string, SessionFileResult>;
  /** Whether the dashboard should be shown. */
  isDashboardActive: boolean;

  /** Check if a live session exists and update state. */
  checkSession: (projectPath: string) => Promise<void>;
  /** Read a specific session file and cache the result. */
  fetchSessionFile: (
    projectPath: string,
    filename: string,
  ) => Promise<SessionFileResult | null>;
  /** Update session status from a watcher event. */
  updateSessionStatus: (status: SessionStatus) => void;
  /** Clear all session state. */
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "inactive",
  sessionInfo: null,
  isChecking: false,
  error: null,
  sessionFiles: new Map(),
  isDashboardActive: false,

  checkSession: async (projectPath: string) => {
    set({ isChecking: true, error: null });

    try {
      const info = await checkLiveSession(projectPath);
      const shouldActivate =
        info.status === "active" || info.status === "interrupted";

      set({
        status: info.status,
        sessionInfo: info,
        isChecking: false,
        isDashboardActive: shouldActivate,
      });
    } catch (err) {
      set({
        isChecking: false,
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to check session",
      });
    }
  },

  fetchSessionFile: async (projectPath: string, filename: string) => {
    try {
      const result = await readSessionFile(projectPath, filename);
      set((state) => {
        const newFiles = new Map(state.sessionFiles);
        newFiles.set(filename, result);
        return { sessionFiles: newFiles };
      });
      return result;
    } catch (err) {
      const errorResult: SessionFileResult = {
        filename,
        content: null,
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to read session file",
        exists: false,
      };
      set((state) => {
        const newFiles = new Map(state.sessionFiles);
        newFiles.set(filename, errorResult);
        return { sessionFiles: newFiles };
      });
      return errorResult;
    }
  },

  updateSessionStatus: (status: SessionStatus) => {
    const shouldActivate = status === "active" || status === "interrupted";
    const currentState = get();

    // When transitioning from active/interrupted to inactive, deactivate dashboard.
    const shouldDeactivate = !shouldActivate && currentState.isDashboardActive;

    set({
      status,
      isDashboardActive: shouldActivate,
      // Clear session files when session ends.
      ...(shouldDeactivate
        ? { sessionFiles: new Map(), sessionInfo: null }
        : {}),
    });
  },

  clearSession: () => {
    set({
      status: "inactive",
      sessionInfo: null,
      isChecking: false,
      error: null,
      sessionFiles: new Map(),
      isDashboardActive: false,
    });
  },
}));
