import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { KanbanBoard, type BoardColumn } from "../KanbanBoard";
import { TaskDetailPanel } from "../TaskDetailPanel";
import { ProjectSidebar } from "../ProjectSidebar";
import { LiveRegionProvider, useLiveAnnouncer } from "../LiveRegion";
import { useTaskStore } from "../../stores/task-store";
import { useProjectStore, type ProjectEntry } from "../../stores/project-store";
import type { TasksByStatus, TaskWithPath } from "../../services/task-service";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../../services/api-client";
const mockGet = vi.mocked(api.get);

beforeEach(() => {
  vi.clearAllMocks();
  useTaskStore.setState({
    tasks: null,
    isLoading: false,
    error: null,
    parseErrors: [],
  });
  useProjectStore.setState({
    projects: [],
    activeProjectPath: null,
    activeTaskGroups: new Set<string>(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- Test helpers ---

function makeTaskResult(
  id: number,
  title: string,
  status: string,
  extra?: { metadata?: Record<string, unknown> },
) {
  return {
    type: "ok" as const,
    task: {
      id,
      title,
      description: `Description for ${title}`,
      status,
      metadata: extra?.metadata,
    },
    file_path: `/project/.agents/tasks/${status}/group/task-${id}.json`,
  };
}

function makeTaskWithPath(
  id: number,
  title: string,
  status: string,
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: `Description for ${title}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
    },
    filePath: `/project/.agents/tasks/${status}/group/task-${id}.json`,
    mtimeMs: 1700000000000 + id,
  };
}

function makeTasksByStatus(overrides?: Partial<TasksByStatus>): TasksByStatus {
  return {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    errors: [],
    ...overrides,
  };
}

function mockGetWithTasks(tasks: Record<string, unknown[]>) {
  mockGet.mockResolvedValueOnce({
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    ...tasks,
  });
}

// --- Screen Reader Labels ---

describe("Screen Reader Labels", () => {
  it("renders aria-label on kanban board grid", async () => {
    mockGetWithTasks({
      pending: [makeTaskResult(1, "Task 1", "pending")],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("kanban-board-grid")).toBeDefined();
    });
    const board = screen.getByTestId("kanban-board-grid");
    expect(board.getAttribute("aria-label")).toBe("Kanban board");
    expect(board.getAttribute("role")).toBe("grid");
  });

  it("renders aria-label on task cards", async () => {
    mockGetWithTasks({
      pending: [makeTaskResult(1, "My Task", "pending")],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("task-card-1")).toBeDefined();
    });
    const card = screen.getByTestId("task-card-1");
    expect(card.getAttribute("aria-label")).toBe("Task My Task");
    expect(card.getAttribute("aria-roledescription")).toBe("draggable task card");
  });

  it("renders aria-label on columns with task counts", async () => {
    mockGetWithTasks({
      pending: [
        makeTaskResult(1, "Task 1", "pending"),
        makeTaskResult(2, "Task 2", "pending"),
      ],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("column-pending")).toBeDefined();
    });
    const pendingColumn = screen.getByTestId("column-pending");
    expect(pendingColumn.getAttribute("aria-label")).toBe("Pending column, 2 tasks");
    expect(pendingColumn.getAttribute("role")).toBe("region");
  });

  it("renders loading spinner with aria-label", () => {
    useTaskStore.setState({ isLoading: true });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    const spinners = screen.getAllByRole("status");
    const loadingSpinner = spinners.find((el) =>
      el.getAttribute("aria-label") === "Loading tasks",
    );
    expect(loadingSpinner).toBeDefined();
  });
});

// --- ARIA Roles and Attributes ---

describe("ARIA Roles and Attributes", () => {
  it("renders filter bar with toolbar role", async () => {
    mockGetWithTasks({
      pending: [
        makeTaskResult(1, "Task 1", "pending", { metadata: { task_group: "auth" } }),
      ],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("board-filter-bar")).toBeDefined();
    });
    const filterBar = screen.getByTestId("board-filter-bar");
    expect(filterBar.getAttribute("role")).toBe("toolbar");
    expect(filterBar.getAttribute("aria-label")).toBe("Task group filters");
  });

  it("renders filter buttons with aria-pressed", async () => {
    mockGetWithTasks({
      pending: [
        makeTaskResult(1, "Task 1", "pending", { metadata: { task_group: "auth" } }),
      ],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("filter-all")).toBeDefined();
    });
    const allButton = screen.getByTestId("filter-all");
    expect(allButton.getAttribute("aria-pressed")).toBe("true");

    const groupButton = screen.getByTestId("filter-group-auth");
    expect(groupButton.getAttribute("aria-pressed")).toBe("false");
  });
});

// --- Focus Management ---

describe("Focus Management - TaskDetailPanel", () => {
  it("renders dialog with aria-modal attribute", () => {
    const tasks = makeTasksByStatus();
    const task = makeTaskWithPath(1, "Test Task", "pending");
    render(
      <TaskDetailPanel
        task={task}
        allTasks={tasks}
        onClose={() => {}}
      />,
    );
    const panel = screen.getByTestId("task-detail-panel");
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.getAttribute("aria-label")).toBe("Task details: Test Task");
  });

  it("renders panel with tabIndex for focus management", () => {
    const tasks = makeTasksByStatus();
    const task = makeTaskWithPath(1, "Test Task", "pending");
    render(
      <TaskDetailPanel
        task={task}
        allTasks={tasks}
        onClose={() => {}}
      />,
    );
    const panel = screen.getByTestId("task-detail-panel");
    expect(panel.getAttribute("tabindex")).toBe("-1");
  });

  it("has close button with proper aria-label", () => {
    const tasks = makeTasksByStatus();
    const task = makeTaskWithPath(1, "Test Task", "pending");
    render(
      <TaskDetailPanel
        task={task}
        allTasks={tasks}
        onClose={() => {}}
      />,
    );
    const closeBtn = screen.getByTestId("close-panel-button");
    expect(closeBtn.getAttribute("aria-label")).toBe("Close panel");
  });
});

// --- Dual State Indicators (Color + Icons) ---

describe("Dual State Indicators", () => {
  it("renders column headers with both color dot and SVG icon", async () => {
    mockGetWithTasks({
      pending: [makeTaskResult(1, "Task 1", "pending")],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("column-pending")).toBeDefined();
    });

    for (const column of ["backlog", "pending", "blocked", "in_progress", "failed", "completed"] as BoardColumn[]) {
      const columnEl = screen.getByTestId(`column-${column}`);
      const svgs = columnEl.querySelectorAll("svg[aria-hidden='true']");
      expect(svgs.length, `Column ${column} should have status icon`).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders status badge with icon in task detail panel", () => {
    const tasks = makeTasksByStatus();
    const task = makeTaskWithPath(1, "Test Task", "pending");
    render(
      <TaskDetailPanel
        task={task}
        allTasks={tasks}
        onClose={() => {}}
      />,
    );

    const panel = screen.getByTestId("task-detail-panel");
    const statusBadge = panel.querySelector(".inline-flex.items-center.gap-1");
    expect(statusBadge).not.toBeNull();
    const svg = statusBadge?.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});

// --- ARIA Live Regions ---

describe("ARIA Live Regions", () => {
  it("renders polite and assertive live regions", () => {
    render(
      <LiveRegionProvider>
        <div>content</div>
      </LiveRegionProvider>,
    );

    const polite = screen.getByTestId("live-region-polite");
    expect(polite.getAttribute("aria-live")).toBe("polite");
    expect(polite.getAttribute("aria-atomic")).toBe("true");
    expect(polite.getAttribute("role")).toBe("status");

    const assertive = screen.getByTestId("live-region-assertive");
    expect(assertive.getAttribute("aria-live")).toBe("assertive");
    expect(assertive.getAttribute("aria-atomic")).toBe("true");
    expect(assertive.getAttribute("role")).toBe("alert");
  });

  it("live regions are visually hidden with sr-only", () => {
    render(
      <LiveRegionProvider>
        <div>content</div>
      </LiveRegionProvider>,
    );

    const polite = screen.getByTestId("live-region-polite");
    expect(polite.className).toContain("sr-only");
  });

  it("announces messages through polite live region", async () => {
    function TestAnnouncer() {
      const { announce } = useLiveAnnouncer();
      return (
        <button onClick={() => announce("Task moved to Completed")}>
          Announce
        </button>
      );
    }

    render(
      <LiveRegionProvider>
        <TestAnnouncer />
      </LiveRegionProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Announce"));
      await new Promise((r) => requestAnimationFrame(r));
    });

    const polite = screen.getByTestId("live-region-polite");
    expect(polite.textContent).toBe("Task moved to Completed");
  });

  it("announces assertive messages through assertive live region", async () => {
    function TestAnnouncer() {
      const { announce } = useLiveAnnouncer();
      return (
        <button onClick={() => announce("Error occurred", "assertive")}>
          Announce Error
        </button>
      );
    }

    render(
      <LiveRegionProvider>
        <TestAnnouncer />
      </LiveRegionProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Announce Error"));
      await new Promise((r) => requestAnimationFrame(r));
    });

    const assertive = screen.getByTestId("live-region-assertive");
    expect(assertive.textContent).toBe("Error occurred");
  });
});

// --- Project Sidebar Accessibility ---

describe("Project Sidebar Accessibility", () => {
  it("renders sidebar with navigation role and aria-label", () => {
    render(
      <ProjectSidebar onAddProject={() => {}} />,
    );
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar.getAttribute("role")).toBe("navigation");
    expect(sidebar.getAttribute("aria-label")).toBe("Project navigation");
  });

  it("renders collapsed sidebar with navigation role", () => {
    render(
      <ProjectSidebar onAddProject={() => {}} collapsed />,
    );
    const sidebar = screen.getByTestId("sidebar-collapsed");
    expect(sidebar.getAttribute("role")).toBe("navigation");
    expect(sidebar.getAttribute("aria-label")).toBe("Project navigation (collapsed)");
  });

  it("renders project buttons with aria-label in collapsed mode", () => {
    const project: ProjectEntry = {
      path: "/test/path",
      name: "test-project",
      connected: true,
      counts: { pending: 0, in_progress: 0, completed: 0, total: 0 },
      taskGroups: [],
    };
    useProjectStore.setState({ projects: [project] });
    render(
      <ProjectSidebar onAddProject={() => {}} collapsed />,
    );
    const btn = screen.getByText("T");
    expect(btn.getAttribute("aria-label")).toBe("Select project: test-project");
  });

  it("renders count badges with aria-labels", () => {
    const project: ProjectEntry = {
      path: "/test/path",
      name: "test-project",
      connected: true,
      counts: { pending: 3, in_progress: 2, completed: 5, total: 10 },
      taskGroups: [],
    };
    useProjectStore.setState({ projects: [project], activeProjectPath: "/test/path" });
    render(
      <ProjectSidebar onAddProject={() => {}} />,
    );

    const pendingBadge = screen.getByLabelText("3 pending");
    expect(pendingBadge).toBeDefined();

    const inProgressBadge = screen.getByLabelText("2 in progress");
    expect(inProgressBadge).toBeDefined();

    const completedBadge = screen.getByLabelText("5 completed");
    expect(completedBadge).toBeDefined();
  });

  it("renders project button with aria-expanded for groups", () => {
    const project: ProjectEntry = {
      path: "/test/path",
      name: "test-project",
      connected: true,
      counts: { pending: 3, in_progress: 0, completed: 0, total: 3 },
      taskGroups: [{ name: "auth", counts: { pending: 3, in_progress: 0, completed: 0, total: 3 } }],
    };
    useProjectStore.setState({ projects: [project], activeProjectPath: "/test/path" });
    render(
      <ProjectSidebar onAddProject={() => {}} />,
    );

    const projectBtn = screen.getByTestId("project-btn-test-project");
    expect(projectBtn.getAttribute("aria-expanded")).not.toBeNull();
  });
});

// --- Fallback Labels ---

describe("Fallback Labels", () => {
  it("provides aria-label when task title is empty", async () => {
    mockGetWithTasks({
      pending: [makeTaskResult(1, "", "pending")],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("task-card-1")).toBeDefined();
    });
    const card = screen.getByTestId("task-card-1");
    expect(card.getAttribute("aria-label")).toBe("Task ");
  });

  it("provides label for task detail panel with empty title", () => {
    const tasks = makeTasksByStatus();
    const task = makeTaskWithPath(1, "", "pending");
    render(
      <TaskDetailPanel
        task={task}
        allTasks={tasks}
        onClose={() => {}}
      />,
    );
    const panel = screen.getByTestId("task-detail-panel");
    expect(panel.getAttribute("aria-label")).toBe("Task details: ");
  });

  it("column renders with aria-label even when empty", async () => {
    mockGetWithTasks({
      pending: [makeTaskResult(1, "Task 1", "pending")],
    });
    render(
      <LiveRegionProvider>
        <KanbanBoard projectPath="/project" />
      </LiveRegionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("column-backlog")).toBeDefined();
    });
    const backlogColumn = screen.getByTestId("column-backlog");
    expect(backlogColumn.getAttribute("aria-label")).toBe("Backlog column, 0 tasks");
  });
});
