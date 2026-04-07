import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProjectSidebar } from "../ProjectSidebar";
import {
  useProjectStore,
  getDirectoryName,
  type ProjectEntry,
} from "../../stores/project-store";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

function makeProject(
  path: string,
  overrides?: Partial<ProjectEntry>,
): ProjectEntry {
  return {
    path,
    name: getDirectoryName(path),
    connected: true,
    counts: { pending: 0, in_progress: 0, completed: 0, total: 0 },
    taskGroups: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe("ProjectSidebar", () => {
  describe("rendering", () => {
    it("renders empty state when no projects are configured", () => {
      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByText("No projects configured")).toBeDefined();
      expect(screen.getByTestId("add-project-btn")).toBeDefined();
    });

    it("renders the sidebar with Projects header", () => {
      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByText("Projects")).toBeDefined();
    });

    it("renders project list with names and paths", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha"),
          makeProject("/Users/dev/beta"),
        ],
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByText("alpha")).toBeDefined();
      expect(screen.getByText("beta")).toBeDefined();
      expect(screen.getByText("/Users/dev/alpha")).toBeDefined();
      expect(screen.getByText("/Users/dev/beta")).toBeDefined();
    });

    it("shows project count in header", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha"),
          makeProject("/Users/dev/beta"),
        ],
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByText("2")).toBeDefined();
    });
  });

  describe("task count badges", () => {
    it("shows task count summary badges for a project", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha", {
            counts: {
              pending: 5,
              in_progress: 3,
              completed: 10,
              total: 18,
            },
          }),
        ],
        activeProjectPath: "/Users/dev/alpha",
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByText("5")).toBeDefined();
      expect(screen.getByText("3")).toBeDefined();
      expect(screen.getByText("10")).toBeDefined();
    });
  });

  describe("task groups", () => {
    it("shows task groups as sub-items under active project", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha", {
            counts: { pending: 3, in_progress: 1, completed: 2, total: 6 },
            taskGroups: [
              {
                name: "auth",
                counts: {
                  pending: 2,
                  in_progress: 1,
                  completed: 1,
                  total: 4,
                },
              },
              {
                name: "payments",
                counts: {
                  pending: 1,
                  in_progress: 0,
                  completed: 1,
                  total: 2,
                },
              },
            ],
          }),
        ],
        activeProjectPath: "/Users/dev/alpha",
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByTestId("task-group-auth")).toBeDefined();
      expect(screen.getByTestId("task-group-payments")).toBeDefined();
      expect(screen.getByText("auth")).toBeDefined();
      expect(screen.getByText("payments")).toBeDefined();
    });

    it("shows 'No tasks found' when project has no task groups and no tasks", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha", {
            counts: { pending: 0, in_progress: 0, completed: 0, total: 0 },
            taskGroups: [],
          }),
        ],
        activeProjectPath: "/Users/dev/alpha",
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByTestId("no-tasks-alpha")).toBeDefined();
      expect(screen.getByText("No tasks found")).toBeDefined();
    });
  });

  describe("project selection", () => {
    it("highlights the active project", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha"),
          makeProject("/Users/dev/beta"),
        ],
        activeProjectPath: "/Users/dev/alpha",
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      const activeProject = screen.getByTestId("project-alpha");
      expect(activeProject.className).toContain("bg-blue-50");
    });

    it("switches active project on click", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha"),
          makeProject("/Users/dev/beta"),
        ],
        activeProjectPath: "/Users/dev/alpha",
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      fireEvent.click(screen.getByTestId("project-btn-beta"));

      expect(useProjectStore.getState().activeProjectPath).toBe(
        "/Users/dev/beta",
      );
    });
  });

  describe("task group filtering", () => {
    it("adds group to filter when clicking a task group", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha", {
            taskGroups: [
              {
                name: "auth",
                counts: {
                  pending: 2,
                  in_progress: 0,
                  completed: 0,
                  total: 2,
                },
              },
            ],
          }),
        ],
        activeProjectPath: "/Users/dev/alpha",
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      fireEvent.click(screen.getByTestId("task-group-auth"));

      expect(useProjectStore.getState().activeTaskGroups.has("auth")).toBe(true);
    });

    it("toggles task group filter off when clicking same group again", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha", {
            taskGroups: [
              {
                name: "auth",
                counts: {
                  pending: 2,
                  in_progress: 0,
                  completed: 0,
                  total: 2,
                },
              },
            ],
          }),
        ],
        activeProjectPath: "/Users/dev/alpha",
        activeTaskGroups: new Set(["auth"]),
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      fireEvent.click(screen.getByTestId("task-group-auth"));

      expect(useProjectStore.getState().activeTaskGroups.has("auth")).toBe(false);
      expect(useProjectStore.getState().activeTaskGroups.size).toBe(0);
    });

    it("supports multi-group selection via sidebar clicks", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha", {
            taskGroups: [
              {
                name: "auth",
                counts: { pending: 2, in_progress: 0, completed: 0, total: 2 },
              },
              {
                name: "payments",
                counts: { pending: 1, in_progress: 0, completed: 0, total: 1 },
              },
            ],
          }),
        ],
        activeProjectPath: "/Users/dev/alpha",
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      fireEvent.click(screen.getByTestId("task-group-auth"));
      fireEvent.click(screen.getByTestId("task-group-payments"));

      const groups = useProjectStore.getState().activeTaskGroups;
      expect(groups.size).toBe(2);
      expect(groups.has("auth")).toBe(true);
      expect(groups.has("payments")).toBe(true);
    });

    it("highlights all selected groups in sidebar", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/alpha", {
            taskGroups: [
              {
                name: "auth",
                counts: { pending: 2, in_progress: 0, completed: 0, total: 2 },
              },
              {
                name: "payments",
                counts: { pending: 1, in_progress: 0, completed: 0, total: 1 },
              },
            ],
          }),
        ],
        activeProjectPath: "/Users/dev/alpha",
        activeTaskGroups: new Set(["auth", "payments"]),
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      const authButton = screen.getByTestId("task-group-auth");
      const paymentsButton = screen.getByTestId("task-group-payments");
      expect(authButton.className).toContain("bg-blue-100");
      expect(paymentsButton.className).toContain("bg-blue-100");
    });
  });

  describe("Add Project button", () => {
    it("triggers onAddProject callback when clicked", () => {
      const onAddProject = vi.fn();
      render(<ProjectSidebar onAddProject={onAddProject} />);

      fireEvent.click(screen.getByTestId("add-project-btn"));

      expect(onAddProject).toHaveBeenCalledOnce();
    });

    it("shows Add Project in footer when projects exist", () => {
      useProjectStore.setState({
        projects: [makeProject("/Users/dev/alpha")],
      });

      const onAddProject = vi.fn();
      render(<ProjectSidebar onAddProject={onAddProject} />);

      const buttons = screen.getAllByTestId("add-project-btn");
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("edge cases", () => {
    it("differentiates projects with the same directory name by showing partial path", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/alice/project", { name: "project" }),
          makeProject("/Users/bob/project", { name: "project" }),
        ],
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByText("alice/project")).toBeDefined();
      expect(screen.getByText("bob/project")).toBeDefined();
    });

    it("shows disconnected state for projects whose directory no longer exists", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/gone", { connected: false }),
        ],
        activeProjectPath: null,
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      expect(screen.getByText("disconnected")).toBeDefined();
      expect(screen.getByTestId("remove-project-btn")).toBeDefined();
    });

    it("removes disconnected project when remove button is clicked", () => {
      useProjectStore.setState({
        projects: [
          makeProject("/Users/dev/gone", { connected: false }),
        ],
      });

      render(<ProjectSidebar onAddProject={vi.fn()} />);

      fireEvent.click(screen.getByTestId("remove-project-btn"));

      expect(useProjectStore.getState().projects).toHaveLength(0);
    });

    it("collapses sidebar on narrow windows", () => {
      render(<ProjectSidebar onAddProject={vi.fn()} collapsed={true} />);

      expect(screen.getByTestId("sidebar-collapsed")).toBeDefined();
    });
  });
});
