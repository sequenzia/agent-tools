import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSessionStore } from "../session-store";

// Mock the session service
vi.mock("../../services/session-service", () => ({
  checkLiveSession: vi.fn(),
  readSessionFile: vi.fn(),
}));

import {
  checkLiveSession,
  readSessionFile,
} from "../../services/session-service";

const mockCheckLiveSession = vi.mocked(checkLiveSession);
const mockReadSessionFile = vi.mocked(readSessionFile);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset store state between tests
  useSessionStore.setState({
    status: "inactive",
    sessionInfo: null,
    isChecking: false,
    error: null,
    sessionFiles: new Map(),
    isDashboardActive: false,
  });
});

describe("useSessionStore", () => {
  describe("initial state", () => {
    it("has inactive status by default", () => {
      const state = useSessionStore.getState();
      expect(state.status).toBe("inactive");
      expect(state.sessionInfo).toBeNull();
      expect(state.isChecking).toBe(false);
      expect(state.error).toBeNull();
      expect(state.sessionFiles.size).toBe(0);
      expect(state.isDashboardActive).toBe(false);
    });
  });

  describe("checkSession", () => {
    it("activates dashboard when session is active", async () => {
      mockCheckLiveSession.mockResolvedValueOnce({
        exists: true,
        status: "active",
        session_path: "/project/.agents/sessions/__live_session__",
        available_files: ["progress.md"],
        project_path: "/project",
      });

      await useSessionStore.getState().checkSession("/project");

      const state = useSessionStore.getState();
      expect(state.status).toBe("active");
      expect(state.isDashboardActive).toBe(true);
      expect(state.isChecking).toBe(false);
      expect(state.sessionInfo?.exists).toBe(true);
    });

    it("activates dashboard when session is interrupted", async () => {
      mockCheckLiveSession.mockResolvedValueOnce({
        exists: true,
        status: "interrupted",
        session_path: "/project/.agents/sessions/__live_session__",
        available_files: ["progress.md"],
        project_path: "/project",
      });

      await useSessionStore.getState().checkSession("/project");

      const state = useSessionStore.getState();
      expect(state.status).toBe("interrupted");
      expect(state.isDashboardActive).toBe(true);
    });

    it("does not activate dashboard when session is inactive", async () => {
      mockCheckLiveSession.mockResolvedValueOnce({
        exists: false,
        status: "inactive",
        session_path: "/project/.agents/sessions/__live_session__",
        available_files: [],
        project_path: "/project",
      });

      await useSessionStore.getState().checkSession("/project");

      const state = useSessionStore.getState();
      expect(state.status).toBe("inactive");
      expect(state.isDashboardActive).toBe(false);
    });

    it("sets isChecking during the check", async () => {
      let resolveCheck: (value: unknown) => void;
      const checkPromise = new Promise((resolve) => {
        resolveCheck = resolve;
      });
      mockCheckLiveSession.mockReturnValueOnce(checkPromise as never);

      const checkSessionPromise = useSessionStore
        .getState()
        .checkSession("/project");

      // During check
      expect(useSessionStore.getState().isChecking).toBe(true);

      resolveCheck!({
        exists: false,
        status: "inactive",
        session_path: "/project/.agents/sessions/__live_session__",
        available_files: [],
        project_path: "/project",
      });

      await checkSessionPromise;

      expect(useSessionStore.getState().isChecking).toBe(false);
    });

    it("sets error on IPC failure", async () => {
      mockCheckLiveSession.mockRejectedValueOnce(new Error("IPC error"));

      await useSessionStore.getState().checkSession("/project");

      const state = useSessionStore.getState();
      expect(state.error).toBe("IPC error");
      expect(state.isChecking).toBe(false);
    });

    it("handles string error from IPC", async () => {
      mockCheckLiveSession.mockRejectedValueOnce("Permission denied");

      await useSessionStore.getState().checkSession("/project");

      const state = useSessionStore.getState();
      expect(state.error).toBe("Permission denied");
    });
  });

  describe("fetchSessionFile", () => {
    it("caches session file content", async () => {
      mockReadSessionFile.mockResolvedValueOnce({
        filename: "progress.md",
        content: "Wave 2 of 3",
        error: null,
        exists: true,
      });

      const result = await useSessionStore
        .getState()
        .fetchSessionFile("/project", "progress.md");

      expect(result?.content).toBe("Wave 2 of 3");
      expect(
        useSessionStore.getState().sessionFiles.get("progress.md")?.content,
      ).toBe("Wave 2 of 3");
    });

    it("caches error results", async () => {
      mockReadSessionFile.mockRejectedValueOnce(new Error("Read failed"));

      const result = await useSessionStore
        .getState()
        .fetchSessionFile("/project", "progress.md");

      expect(result?.error).toBe("Read failed");
      expect(result?.content).toBeNull();
      expect(
        useSessionStore.getState().sessionFiles.get("progress.md")?.error,
      ).toBe("Read failed");
    });
  });

  describe("updateSessionStatus", () => {
    it("activates dashboard when status becomes active", () => {
      useSessionStore.getState().updateSessionStatus("active");

      const state = useSessionStore.getState();
      expect(state.status).toBe("active");
      expect(state.isDashboardActive).toBe(true);
    });

    it("activates dashboard when status becomes interrupted", () => {
      useSessionStore.getState().updateSessionStatus("interrupted");

      const state = useSessionStore.getState();
      expect(state.status).toBe("interrupted");
      expect(state.isDashboardActive).toBe(true);
    });

    it("deactivates dashboard and clears state when session ends", () => {
      // First activate
      useSessionStore.setState({
        status: "active",
        isDashboardActive: true,
        sessionFiles: new Map([
          [
            "progress.md",
            {
              filename: "progress.md",
              content: "data",
              error: null,
              exists: true,
            },
          ],
        ]),
      });

      // Then deactivate
      useSessionStore.getState().updateSessionStatus("inactive");

      const state = useSessionStore.getState();
      expect(state.status).toBe("inactive");
      expect(state.isDashboardActive).toBe(false);
      expect(state.sessionFiles.size).toBe(0);
      expect(state.sessionInfo).toBeNull();
    });

    it("does not clear state when transitioning between active states", () => {
      // Set to active with some data
      useSessionStore.setState({
        status: "active",
        isDashboardActive: true,
        sessionFiles: new Map([
          [
            "progress.md",
            {
              filename: "progress.md",
              content: "data",
              error: null,
              exists: true,
            },
          ],
        ]),
      });

      // Transition to interrupted (still has session)
      useSessionStore.getState().updateSessionStatus("interrupted");

      const state = useSessionStore.getState();
      expect(state.status).toBe("interrupted");
      expect(state.isDashboardActive).toBe(true);
      // Files should still be there
      expect(state.sessionFiles.size).toBe(1);
    });
  });

  describe("clearSession", () => {
    it("resets all session state", () => {
      // Set some state
      useSessionStore.setState({
        status: "active",
        isDashboardActive: true,
        error: "some error",
        sessionFiles: new Map([
          [
            "progress.md",
            {
              filename: "progress.md",
              content: "data",
              error: null,
              exists: true,
            },
          ],
        ]),
      });

      useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.status).toBe("inactive");
      expect(state.sessionInfo).toBeNull();
      expect(state.isChecking).toBe(false);
      expect(state.error).toBeNull();
      expect(state.sessionFiles.size).toBe(0);
      expect(state.isDashboardActive).toBe(false);
    });
  });
});
