import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useSessionHistoryStore,
  SESSIONS_PER_PAGE,
} from "../session-history-store";

// Mock the session service
vi.mock("../../services/session-service", () => ({
  listArchivedSessions: vi.fn(),
  readArchivedSessionFile: vi.fn(),
}));

import {
  listArchivedSessions,
  readArchivedSessionFile,
} from "../../services/session-service";

const mockListArchivedSessions = vi.mocked(listArchivedSessions);
const mockReadArchivedSessionFile = vi.mocked(readArchivedSessionFile);

function makeSession(
  name: string,
  opts?: {
    passed?: number;
    failed?: number;
    total?: number;
    error?: string | null;
  },
) {
  const passed = opts?.passed ?? 0;
  const failed = opts?.failed ?? 0;
  const total = opts?.total ?? passed + failed;

  return {
    name,
    path: `/project/.agents/sessions/${name}`,
    available_files: ["execution_plan.md", "session_summary.md"],
    has_summary: true,
    mtime_ms: Date.now(),
    summary: {
      tasks_passed: passed,
      tasks_failed: failed,
      tasks_total: total,
      headline: "# Summary",
    },
    error: opts?.error ?? null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset store state between tests
  useSessionHistoryStore.setState({
    sessions: [],
    isLoading: false,
    error: null,
    selectedSession: null,
    selectedSessionFiles: new Map(),
    isLoadingFile: false,
    currentPage: 0,
  });
});

describe("useSessionHistoryStore", () => {
  describe("initial state", () => {
    it("has empty sessions by default", () => {
      const state = useSessionHistoryStore.getState();
      expect(state.sessions).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedSession).toBeNull();
      expect(state.selectedSessionFiles.size).toBe(0);
      expect(state.currentPage).toBe(0);
    });
  });

  describe("fetchSessions", () => {
    it("loads archived sessions successfully", async () => {
      const sessions = [
        makeSession("exec-session-20260406-140000", { passed: 8, failed: 2 }),
        makeSession("exec-session-20260405-120000", { passed: 5, failed: 0 }),
      ];
      mockListArchivedSessions.mockResolvedValueOnce(sessions);

      await useSessionHistoryStore.getState().fetchSessions("/project");

      const state = useSessionHistoryStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("sets isLoading during fetch", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockListArchivedSessions.mockReturnValueOnce(promise as never);

      const fetchPromise = useSessionHistoryStore
        .getState()
        .fetchSessions("/project");

      expect(useSessionHistoryStore.getState().isLoading).toBe(true);

      resolvePromise!([]);
      await fetchPromise;

      expect(useSessionHistoryStore.getState().isLoading).toBe(false);
    });

    it("sets error on failure", async () => {
      mockListArchivedSessions.mockRejectedValueOnce(
        new Error("Permission denied"),
      );

      await useSessionHistoryStore.getState().fetchSessions("/project");

      const state = useSessionHistoryStore.getState();
      expect(state.error).toBe("Permission denied");
      expect(state.isLoading).toBe(false);
    });

    it("handles string errors", async () => {
      mockListArchivedSessions.mockRejectedValueOnce("IPC error");

      await useSessionHistoryStore.getState().fetchSessions("/project");

      expect(useSessionHistoryStore.getState().error).toBe("IPC error");
    });
  });

  describe("selectSession", () => {
    it("sets selected session and clears files cache", () => {
      // Pre-populate some cached files
      useSessionHistoryStore.setState({
        selectedSession: "old-session",
        selectedSessionFiles: new Map([
          [
            "progress.md",
            {
              filename: "progress.md",
              content: "old data",
              error: null,
              exists: true,
            },
          ],
        ]),
      });

      useSessionHistoryStore
        .getState()
        .selectSession("exec-session-20260406-140000");

      const state = useSessionHistoryStore.getState();
      expect(state.selectedSession).toBe("exec-session-20260406-140000");
      expect(state.selectedSessionFiles.size).toBe(0);
    });

    it("clears selection when null is passed", () => {
      useSessionHistoryStore.setState({
        selectedSession: "some-session",
      });

      useSessionHistoryStore.getState().selectSession(null);

      expect(useSessionHistoryStore.getState().selectedSession).toBeNull();
    });
  });

  describe("fetchSessionFile", () => {
    it("caches session file content", async () => {
      mockReadArchivedSessionFile.mockResolvedValueOnce({
        filename: "execution_plan.md",
        content: "# Plan\nWave 1",
        error: null,
        exists: true,
      });

      const result = await useSessionHistoryStore
        .getState()
        .fetchSessionFile(
          "/project",
          "exec-session-20260406-140000",
          "execution_plan.md",
        );

      expect(result?.content).toBe("# Plan\nWave 1");
      expect(
        useSessionHistoryStore
          .getState()
          .selectedSessionFiles.get("execution_plan.md")?.content,
      ).toBe("# Plan\nWave 1");
    });

    it("returns cached result on subsequent calls", async () => {
      // Pre-populate cache
      useSessionHistoryStore.setState({
        selectedSessionFiles: new Map([
          [
            "execution_plan.md",
            {
              filename: "execution_plan.md",
              content: "cached",
              error: null,
              exists: true,
            },
          ],
        ]),
      });

      const result = await useSessionHistoryStore
        .getState()
        .fetchSessionFile(
          "/project",
          "exec-session-20260406-140000",
          "execution_plan.md",
        );

      expect(result?.content).toBe("cached");
      // Should not have called the IPC
      expect(mockReadArchivedSessionFile).not.toHaveBeenCalled();
    });

    it("caches error results", async () => {
      mockReadArchivedSessionFile.mockRejectedValueOnce(
        new Error("Read failed"),
      );

      const result = await useSessionHistoryStore
        .getState()
        .fetchSessionFile(
          "/project",
          "exec-session-20260406-140000",
          "broken.md",
        );

      expect(result?.error).toBe("Read failed");
      expect(result?.content).toBeNull();
    });
  });

  describe("setPage", () => {
    it("updates current page", () => {
      useSessionHistoryStore.getState().setPage(3);
      expect(useSessionHistoryStore.getState().currentPage).toBe(3);
    });
  });

  describe("clearHistory", () => {
    it("resets all state", () => {
      useSessionHistoryStore.setState({
        sessions: [makeSession("test")],
        isLoading: true,
        error: "some error",
        selectedSession: "test",
        selectedSessionFiles: new Map([
          [
            "file.md",
            { filename: "file.md", content: "x", error: null, exists: true },
          ],
        ]),
        currentPage: 5,
      });

      useSessionHistoryStore.getState().clearHistory();

      const state = useSessionHistoryStore.getState();
      expect(state.sessions).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.selectedSession).toBeNull();
      expect(state.selectedSessionFiles.size).toBe(0);
      expect(state.currentPage).toBe(0);
    });
  });

  describe("SESSIONS_PER_PAGE", () => {
    it("is 20", () => {
      expect(SESSIONS_PER_PAGE).toBe(20);
    });
  });
});
