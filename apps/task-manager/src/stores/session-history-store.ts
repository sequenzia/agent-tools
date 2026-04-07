import { create } from "zustand";
import {
  listArchivedSessions,
  readArchivedSessionFile,
  type ArchivedSessionInfo,
  type SessionFileResult,
} from "../services/session-service";

/** Number of sessions to display per page. */
export const SESSIONS_PER_PAGE = 20;

interface SessionHistoryState {
  /** List of all archived sessions, sorted by most recent first. */
  sessions: ArchivedSessionInfo[];
  /** Whether the session list is currently loading. */
  isLoading: boolean;
  /** Error from the last fetch attempt. */
  error: string | null;
  /** Currently selected session name (for detail view). */
  selectedSession: string | null;
  /** Cached session file contents for the selected session, keyed by filename. */
  selectedSessionFiles: Map<string, SessionFileResult>;
  /** Whether a session file is currently loading. */
  isLoadingFile: boolean;
  /** Current page (0-indexed) for pagination. */
  currentPage: number;

  /** Fetch the list of archived sessions for a project. */
  fetchSessions: (projectPath: string) => Promise<void>;
  /** Select a session to view its details. */
  selectSession: (sessionName: string | null) => void;
  /** Read a file from the selected session and cache it. */
  fetchSessionFile: (
    projectPath: string,
    sessionName: string,
    filename: string,
  ) => Promise<SessionFileResult | null>;
  /** Set the current page for pagination. */
  setPage: (page: number) => void;
  /** Clear all session history state. */
  clearHistory: () => void;
}

export const useSessionHistoryStore = create<SessionHistoryState>(
  (set, get) => ({
    sessions: [],
    isLoading: false,
    error: null,
    selectedSession: null,
    selectedSessionFiles: new Map(),
    isLoadingFile: false,
    currentPage: 0,

    fetchSessions: async (projectPath: string) => {
      set({ isLoading: true, error: null });

      try {
        const sessions = await listArchivedSessions(projectPath);
        set({
          sessions,
          isLoading: false,
        });
      } catch (err) {
        set({
          isLoading: false,
          error:
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "Failed to load session history",
        });
      }
    },

    selectSession: (sessionName: string | null) => {
      set({
        selectedSession: sessionName,
        selectedSessionFiles: new Map(),
      });
    },

    fetchSessionFile: async (
      projectPath: string,
      sessionName: string,
      filename: string,
    ) => {
      // Check cache first
      const cached = get().selectedSessionFiles.get(filename);
      if (cached) return cached;

      set({ isLoadingFile: true });

      try {
        const result = await readArchivedSessionFile(
          projectPath,
          sessionName,
          filename,
        );
        set((state) => {
          const newFiles = new Map(state.selectedSessionFiles);
          newFiles.set(filename, result);
          return { selectedSessionFiles: newFiles, isLoadingFile: false };
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
          const newFiles = new Map(state.selectedSessionFiles);
          newFiles.set(filename, errorResult);
          return { selectedSessionFiles: newFiles, isLoadingFile: false };
        });
        return errorResult;
      }
    },

    setPage: (page: number) => {
      set({ currentPage: page });
    },

    clearHistory: () => {
      set({
        sessions: [],
        isLoading: false,
        error: null,
        selectedSession: null,
        selectedSessionFiles: new Map(),
        isLoadingFile: false,
        currentPage: 0,
      });
    },
  }),
);
