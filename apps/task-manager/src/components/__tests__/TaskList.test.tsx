import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { TaskList } from "../TaskList";
import { useTaskStore } from "../../stores/task-store";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../../services/api-client";
const mockGet = vi.mocked(api.get);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the Zustand store between tests
  useTaskStore.setState({
    tasks: null,
    isLoading: false,
    error: null,
    parseErrors: [],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeTaskResult(
  id: number | string,
  title: string,
  status: string,
  metadata?: Record<string, unknown>,
) {
  return {
    type: "ok" as const,
    task: {
      id,
      title,
      description: `Description for ${title}`,
      status,
      metadata,
    },
    file_path: `/project/.agents/tasks/${status}/group/task-${id}.json`,
  };
}

describe("TaskList", () => {
  describe("loading state", () => {
    it("shows loading spinner while tasks are being fetched", () => {
      // Make invoke hang so loading state persists
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<TaskList projectPath="/test/project" />);

      expect(screen.getByText("Loading tasks...")).toBeDefined();
      expect(screen.getByRole("status")).toBeDefined();
    });
  });

  describe("empty state", () => {
    it("displays empty state when no tasks exist", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("No tasks found")).toBeDefined();
      });
    });

    it("displays guidance text in empty state", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Select a project with an .agents/tasks/ directory to view tasks.",
          ),
        ).toBeDefined();
      });
    });
  });

  describe("task card rendering", () => {
    it("renders task cards with title, status, priority, and complexity", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Build login page", "pending", {
            priority: "high",
            complexity: "M",
          }),
        ],
        in_progress: [],
        completed: [],
      });

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Build login page")).toBeDefined();
      });

      // Section header "Pending" and status badge "Pending" both appear
      const pendingElements = screen.getAllByText("Pending");
      expect(pendingElements.length).toBeGreaterThanOrEqual(2);
      // Priority badge
      expect(screen.getByText("high")).toBeDefined();
      // Complexity badge
      expect(screen.getByText("M")).toBeDefined();
      // Task ID
      expect(screen.getByText("#1")).toBeDefined();
    });

    it("renders task cards without optional priority and complexity", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [
          makeTaskResult(5, "Minimal task", "backlog"),
        ],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Minimal task")).toBeDefined();
      });

      // Section header "Backlog" and status badge "Backlog" both appear
      const backlogElements = screen.getAllByText("Backlog");
      expect(backlogElements.length).toBeGreaterThanOrEqual(2);
      // No priority or complexity badges
      expect(screen.queryByText("high")).toBeNull();
      expect(screen.queryByText("M")).toBeNull();
    });
  });

  describe("status grouping", () => {
    it("groups tasks by status with section headers", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [makeTaskResult(1, "Backlog task", "backlog")],
        pending: [makeTaskResult(2, "Pending task", "pending")],
        in_progress: [makeTaskResult(3, "Active task", "in_progress")],
        completed: [makeTaskResult(4, "Done task", "completed")],
      });

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Backlog task")).toBeDefined();
      });

      // Section headers (each status text appears as both a section header and a badge on the card)
      expect(screen.getAllByText("Backlog").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("In Progress").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("Completed").length).toBeGreaterThanOrEqual(2);

      // Task titles
      expect(screen.getByText("Pending task")).toBeDefined();
      expect(screen.getByText("Active task")).toBeDefined();
      expect(screen.getByText("Done task")).toBeDefined();
    });

    it("hides empty status groups", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [makeTaskResult(1, "Only pending", "pending")],
        in_progress: [],
        completed: [],
      });

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Only pending")).toBeDefined();
      });

      // Only Pending section header should appear (as both section header and badge)
      expect(screen.queryByText("Backlog")).toBeNull();
      expect(screen.queryByText("In Progress")).toBeNull();
      expect(screen.queryByText("Completed")).toBeNull();
    });

    it("shows task count for each status group", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [
          makeTaskResult(1, "Task A", "pending"),
          makeTaskResult(2, "Task B", "pending"),
          makeTaskResult(3, "Task C", "pending"),
        ],
        in_progress: [],
        completed: [],
      });

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Task A")).toBeDefined();
      });

      // Count badge showing "3"
      expect(screen.getByText("3")).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("displays error state when IPC call fails", async () => {
      mockGet.mockRejectedValueOnce("Backend connection lost");

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load tasks")).toBeDefined();
      });

      expect(screen.getByText("Backend connection lost")).toBeDefined();
    });

    it("displays error state for Error objects", async () => {
      mockGet.mockRejectedValueOnce(
        new Error("Network timeout"),
      );

      render(<TaskList projectPath="/test/project" />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load tasks")).toBeDefined();
      });

      expect(screen.getByText("Network timeout")).toBeDefined();
    });
  });

  describe("IPC integration", () => {
    it("calls read_tasks with the project path on mount", async () => {
      mockGet.mockResolvedValueOnce({
        backlog: [],
        pending: [],
        in_progress: [],
        completed: [],
      });

      render(<TaskList projectPath="/my/project/dir" />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith("/api/tasks", {
          projectPath: "/my/project/dir",
        });
      });
    });

    it("reloads tasks when project path changes", async () => {
      mockGet.mockResolvedValue({
        backlog: [],
        pending: [],
        in_progress: [],
        completed: [],
      });

      const { rerender } = render(
        <TaskList projectPath="/project/a" />,
      );

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith("/api/tasks", {
          projectPath: "/project/a",
        });
      });

      rerender(<TaskList projectPath="/project/b" />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith("/api/tasks", {
          projectPath: "/project/b",
        });
      });
    });
  });
});
