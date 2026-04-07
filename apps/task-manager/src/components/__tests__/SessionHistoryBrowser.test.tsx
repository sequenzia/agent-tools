import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { SessionHistoryBrowser } from "../SessionHistoryBrowser";
import { useSessionHistoryStore } from "../../stores/session-history-store";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the store between tests
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeSession(
  name: string,
  opts?: {
    passed?: number;
    failed?: number;
    total?: number;
    error?: string | null;
    files?: string[];
    hasSummary?: boolean;
  },
) {
  const passed = opts?.passed ?? 0;
  const failed = opts?.failed ?? 0;
  const total = opts?.total ?? passed + failed;

  return {
    name,
    path: `/project/.agents/sessions/${name}`,
    available_files: opts?.files ?? [
      "session_summary.md",
      "execution_plan.md",
      "task_log.md",
    ],
    has_summary: opts?.hasSummary ?? true,
    mtime_ms: Date.now(),
    summary:
      opts?.hasSummary === false
        ? null
        : {
            tasks_passed: passed,
            tasks_failed: failed,
            tasks_total: total,
            headline: "# Summary",
          },
    error: opts?.error ?? null,
  };
}

describe("SessionHistoryBrowser", () => {
  describe("loading state", () => {
    it("shows loading spinner while sessions are being fetched", () => {
      // Make invoke hang so loading state persists
      mockInvoke.mockReturnValue(new Promise(() => {}));

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      expect(screen.getByText("Loading session history...")).toBeDefined();
      expect(screen.getByRole("status")).toBeDefined();
    });
  });

  describe("empty state", () => {
    it("displays empty message when no archived sessions exist", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("No previous sessions")).toBeDefined();
      });
      expect(
        screen.getByText("Completed execution sessions will appear here."),
      ).toBeDefined();
    });
  });

  describe("session list rendering", () => {
    it("renders session entries with names and summary statistics", async () => {
      mockInvoke.mockResolvedValueOnce([
        makeSession("exec-session-20260406-140000", {
          passed: 8,
          failed: 2,
          total: 10,
        }),
        makeSession("exec-session-20260405-120000", {
          passed: 5,
          failed: 0,
          total: 5,
        }),
      ]);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText("exec-session-20260406-140000"),
        ).toBeDefined();
      });

      expect(screen.getByText("exec-session-20260405-120000")).toBeDefined();
      // Summary statistics
      expect(screen.getByText("8 passed")).toBeDefined();
      expect(screen.getByText("2 failed")).toBeDefined();
      expect(screen.getByText("5 passed")).toBeDefined();
      // Session count
      expect(screen.getByText("2 archived sessions")).toBeDefined();
    });

    it("shows 'No summary' for sessions without summary files", async () => {
      mockInvoke.mockResolvedValueOnce([
        makeSession("session-no-summary-20260406-100000", {
          hasSummary: false,
          files: ["execution_plan.md"],
        }),
      ]);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText("session-no-summary-20260406-100000"),
        ).toBeDefined();
      });
      expect(screen.getByText("No summary")).toBeDefined();
    });

    it("shows 'Error' badge for sessions with errors", async () => {
      mockInvoke.mockResolvedValueOnce([
        makeSession("corrupt-session-20260406-100000", {
          error: "Failed to read session_summary.md",
          files: ["session_summary.md"],
        }),
      ]);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText("corrupt-session-20260406-100000"),
        ).toBeDefined();
      });
      expect(screen.getByText("Error")).toBeDefined();
    });

    it("displays formatted timestamp from session name", async () => {
      mockInvoke.mockResolvedValueOnce([
        makeSession("exec-session-20260406-140000", { passed: 1 }),
      ]);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("2026-04-06 14:00:00")).toBeDefined();
      });
    });
  });

  describe("session detail view", () => {
    it("shows detail view when a session is clicked", async () => {
      const sessions = [
        makeSession("exec-session-20260406-140000", {
          passed: 8,
          failed: 2,
          total: 10,
          files: ["session_summary.md", "execution_plan.md"],
        }),
      ];

      // First call: list sessions
      mockInvoke.mockResolvedValueOnce(sessions);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText("exec-session-20260406-140000"),
        ).toBeDefined();
      });

      // Next call: read session file (triggered after clicking)
      mockInvoke.mockResolvedValueOnce({
        filename: "session_summary.md",
        content: "# Session Summary\n\nAll tasks completed.",
        error: null,
        exists: true,
      });

      fireEvent.click(
        screen.getByTestId("session-item-exec-session-20260406-140000"),
      );

      await waitFor(() => {
        // Should show back button
        expect(screen.getByLabelText("Back to session list")).toBeDefined();
      });

      // Should show the session name as header
      const headings = screen.getAllByText("exec-session-20260406-140000");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it("navigates back to session list when back button is clicked", async () => {
      const sessions = [
        makeSession("exec-session-20260406-140000", {
          passed: 8,
          failed: 2,
          total: 10,
        }),
      ];

      // First call: list sessions
      mockInvoke.mockResolvedValueOnce(sessions);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText("exec-session-20260406-140000"),
        ).toBeDefined();
      });

      // Click to open detail - mock file read
      mockInvoke.mockResolvedValueOnce({
        filename: "session_summary.md",
        content: "# Summary",
        error: null,
        exists: true,
      });

      fireEvent.click(
        screen.getByTestId("session-item-exec-session-20260406-140000"),
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Back to session list")).toBeDefined();
      });

      fireEvent.click(screen.getByLabelText("Back to session list"));

      // Should be back in list view
      expect(useSessionHistoryStore.getState().selectedSession).toBeNull();
    });

    it("shows available tabs for session files", async () => {
      const sessions = [
        makeSession("test-session-20260406-150000", {
          passed: 5,
          files: ["session_summary.md", "execution_plan.md", "task_log.md"],
        }),
      ];

      // List sessions call
      mockInvoke.mockResolvedValueOnce(sessions);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText("test-session-20260406-150000"),
        ).toBeDefined();
      });

      // Mock file read for detail view
      mockInvoke.mockResolvedValueOnce({
        filename: "session_summary.md",
        content: "# Summary",
        error: null,
        exists: true,
      });

      fireEvent.click(
        screen.getByTestId("session-item-test-session-20260406-150000"),
      );

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Summary" })).toBeDefined();
        expect(
          screen.getByRole("tab", { name: "Execution Plan" }),
        ).toBeDefined();
        expect(screen.getByRole("tab", { name: "Task Log" })).toBeDefined();
      });
    });
  });

  describe("error handling", () => {
    it("displays error state when IPC call fails", async () => {
      mockInvoke.mockRejectedValueOnce("Backend connection lost");

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load session history"),
        ).toBeDefined();
      });
      expect(screen.getByText("Backend connection lost")).toBeDefined();
    });
  });

  describe("pagination", () => {
    it("shows pagination when more than 20 sessions exist", async () => {
      const sessions = Array.from({ length: 25 }, (_, i) =>
        makeSession(`session-${String(i).padStart(3, "0")}-20260406-${String(100000 + i)}`, {
          passed: i,
        }),
      );
      mockInvoke.mockResolvedValueOnce(sessions);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Page 1 of 2")).toBeDefined();
      });
      expect(screen.getByText("25 archived sessions")).toBeDefined();
      expect(screen.getByLabelText("Previous page")).toBeDefined();
      expect(screen.getByLabelText("Next page")).toBeDefined();
    });

    it("does not show pagination when 20 or fewer sessions exist", async () => {
      const sessions = Array.from({ length: 10 }, (_, i) =>
        makeSession(`session-${i}-20260406-${String(100000 + i)}`, {
          passed: i,
        }),
      );
      mockInvoke.mockResolvedValueOnce(sessions);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("10 archived sessions")).toBeDefined();
      });
      // No pagination controls
      expect(screen.queryByText(/Page/)).toBeNull();
    });

    it("disables previous button on first page", async () => {
      const sessions = Array.from({ length: 25 }, (_, i) =>
        makeSession(`session-${i}-20260406-${String(100000 + i)}`, {
          passed: i,
        }),
      );
      mockInvoke.mockResolvedValueOnce(sessions);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        const prevButton = screen.getByLabelText(
          "Previous page",
        ) as HTMLButtonElement;
        expect(prevButton.disabled).toBe(true);
      });
    });

    it("navigates to next page", async () => {
      const sessions = Array.from({ length: 25 }, (_, i) =>
        makeSession(
          `session-${String(i).padStart(3, "0")}-20260406-${String(100000 + i)}`,
          { passed: i },
        ),
      );
      mockInvoke.mockResolvedValueOnce(sessions);

      render(<SessionHistoryBrowser projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Page 1 of 2")).toBeDefined();
      });

      fireEvent.click(screen.getByLabelText("Next page"));

      expect(screen.getByText("Page 2 of 2")).toBeDefined();
      // Last page: next should be disabled
      const nextButton = screen.getByLabelText(
        "Next page",
      ) as HTMLButtonElement;
      expect(nextButton.disabled).toBe(true);
    });
  });

  describe("IPC integration", () => {
    it("calls list_archived_sessions_cmd on mount", async () => {
      mockInvoke.mockResolvedValueOnce([]);

      render(<SessionHistoryBrowser projectPath="/my/project" />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "list_archived_sessions_cmd",
          { projectPath: "/my/project" },
        );
      });
    });

    it("reloads sessions when project path changes", async () => {
      mockInvoke.mockResolvedValue([]);

      const { rerender } = render(
        <SessionHistoryBrowser projectPath="/project/a" />,
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "list_archived_sessions_cmd",
          { projectPath: "/project/a" },
        );
      });

      rerender(<SessionHistoryBrowser projectPath="/project/b" />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "list_archived_sessions_cmd",
          { projectPath: "/project/b" },
        );
      });
    });
  });
});
