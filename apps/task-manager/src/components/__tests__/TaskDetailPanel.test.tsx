import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TaskDetailPanel } from "../TaskDetailPanel";
import type { TaskWithPath, TasksByStatus } from "../../services/task-service";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- Test helpers ---

function makeTaskWithPath(
  id: number | string,
  title: string,
  status: string,
  extra?: {
    description?: string;
    metadata?: Record<string, unknown>;
    blocked_by?: (number | string)[];
    acceptance_criteria?: Record<string, string[]>;
    testing_requirements?: (string | { type: string; target: string })[];
  },
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: extra?.description ?? `Description for ${title}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
      metadata: extra?.metadata,
      blocked_by: extra?.blocked_by,
      acceptance_criteria: extra?.acceptance_criteria,
      testing_requirements: extra?.testing_requirements,
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

const defaultOnClose = vi.fn();

// --- Rendering tests ---

describe("TaskDetailPanel", () => {
  describe("open/close behavior", () => {
    it("does not render when task is null", () => {
      render(
        <TaskDetailPanel
          task={null}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.queryByTestId("task-detail-panel")).toBeNull();
    });

    it("renders the panel when a task is provided", () => {
      const task = makeTaskWithPath(1, "Test task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByTestId("task-detail-panel")).toBeDefined();
    });

    it("closes when close button is clicked", () => {
      const onClose = vi.fn();
      const task = makeTaskWithPath(1, "Test task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={onClose}
        />,
      );

      fireEvent.click(screen.getByTestId("close-panel-button"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes when Escape key is pressed", () => {
      const onClose = vi.fn();
      const task = makeTaskWithPath(1, "Test task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={onClose}
        />,
      );

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes when clicking outside the panel (on overlay)", () => {
      const onClose = vi.fn();
      const task = makeTaskWithPath(1, "Test task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={onClose}
        />,
      );

      const overlay = screen.getByTestId("task-detail-overlay");
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not close when clicking inside the panel", () => {
      const onClose = vi.fn();
      const task = makeTaskWithPath(1, "Test task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={onClose}
        />,
      );

      const panel = screen.getByTestId("task-detail-panel");
      fireEvent.click(panel);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("task field display", () => {
    it("displays task title and ID in header", () => {
      const task = makeTaskWithPath(42, "Build the thing", "in_progress");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("Build the thing")).toBeDefined();
      expect(screen.getByText("#42")).toBeDefined();
    });

    it("displays task status badge", () => {
      const task = makeTaskWithPath(1, "Task", "in_progress");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("in progress")).toBeDefined();
    });

    it("displays priority and complexity badges in overview", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: { priority: "high", complexity: "L" },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("high")).toBeDefined();
      expect(screen.getByText("L")).toBeDefined();
    });

    it("displays task group in overview", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: { task_group: "authentication" },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      // task_group appears in both Overview badge and Metadata row
      const matches = screen.getAllByText("authentication");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("renders description with markdown formatting", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        description: "This is **bold** and *italic* text",
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      const descContent = screen.getByTestId("description-content");
      // Check that bold text is rendered as <strong>
      const strong = descContent.querySelector("strong");
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe("bold");
      // Check that italic text is rendered as <em>
      const em = descContent.querySelector("em");
      expect(em).not.toBeNull();
      expect(em?.textContent).toBe("italic");
    });

    it("renders markdown lists in description", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        description: "Features:\n- Item one\n- Item two\n- Item three",
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      const descContent = screen.getByTestId("description-content");
      const listItems = descContent.querySelectorAll("li");
      expect(listItems.length).toBe(3);
    });
  });

  describe("acceptance criteria", () => {
    it("groups criteria by category", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        acceptance_criteria: {
          functional: ["User can login", "User can logout"],
          edge_cases: ["Handle empty password"],
          error_handling: ["Show error on invalid credentials"],
          performance: ["Login under 200ms"],
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("Functional")).toBeDefined();
      expect(screen.getByText("Edge Cases")).toBeDefined();
      expect(screen.getByText("Error Handling")).toBeDefined();
      expect(screen.getByText("Performance")).toBeDefined();

      expect(screen.getByText("User can login")).toBeDefined();
      expect(screen.getByText("User can logout")).toBeDefined();
      expect(screen.getByText("Handle empty password")).toBeDefined();
      expect(screen.getByText("Show error on invalid credentials")).toBeDefined();
      expect(screen.getByText("Login under 200ms")).toBeDefined();
    });

    it("shows placeholder when no acceptance criteria exist", () => {
      const task = makeTaskWithPath(1, "Task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByTestId("no-acceptance-criteria")).toBeDefined();
      expect(
        screen.getByTestId("no-acceptance-criteria").textContent,
      ).toBe("No acceptance criteria defined");
    });

    it("shows placeholder when acceptance criteria object has empty arrays", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        acceptance_criteria: {
          functional: [],
          edge_cases: [],
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      // Should show the "No acceptance criteria defined" text since all categories are empty
      const panelContent = screen.getByTestId("panel-content");
      expect(panelContent.textContent).toContain(
        "No acceptance criteria defined",
      );
    });

    it("only shows categories that have items", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        acceptance_criteria: {
          functional: ["Must work"],
          edge_cases: [],
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("Functional")).toBeDefined();
      expect(screen.getByText("Must work")).toBeDefined();
      expect(screen.queryByText("Edge Cases")).toBeNull();
    });
  });

  describe("dependencies", () => {
    it("shows linked task titles for blocked_by references", () => {
      const blocker = makeTaskWithPath(10, "Setup database", "in_progress");
      const task = makeTaskWithPath(1, "Build API", "pending", {
        blocked_by: [10],
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({
            in_progress: [blocker],
            pending: [task],
          })}
          onClose={defaultOnClose}
        />,
      );

      // Title appears in both the dependency graph and the blocked-by list
      expect(screen.getAllByText("Setup database").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("#10").length).toBeGreaterThanOrEqual(1);
    });

    it("shows fallback text when referenced task is not found", () => {
      const task = makeTaskWithPath(1, "Build API", "pending", {
        blocked_by: [999],
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({ pending: [task] })}
          onClose={defaultOnClose}
        />,
      );

      // Title appears in both the dependency graph and the blocked-by list
      expect(screen.getAllByText("Task 999").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("#999").length).toBeGreaterThanOrEqual(1);
    });

    it("shows 'No dependencies' when blocked_by is empty", () => {
      const task = makeTaskWithPath(1, "Independent task", "pending", {
        blocked_by: [],
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByTestId("no-dependencies")).toBeDefined();
      expect(screen.getByTestId("no-dependencies").textContent).toBe(
        "No dependencies",
      );
    });

    it("shows 'No dependencies' when blocked_by is undefined", () => {
      const task = makeTaskWithPath(1, "Independent task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByTestId("no-dependencies")).toBeDefined();
    });

    it("resolves multiple dependencies across different statuses", () => {
      const dep1 = makeTaskWithPath(10, "Dep in backlog", "backlog");
      const dep2 = makeTaskWithPath(20, "Dep completed", "completed");
      const task = makeTaskWithPath(1, "Main task", "pending", {
        blocked_by: [10, 20],
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({
            backlog: [dep1],
            pending: [task],
            completed: [dep2],
          })}
          onClose={defaultOnClose}
        />,
      );

      // Titles appear in both the dependency graph and the blocked-by list
      expect(screen.getAllByText("Dep in backlog").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Dep completed").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("testing requirements", () => {
    it("displays testing requirements list", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        testing_requirements: [
          "Unit: Test validation",
          "Integration: Test API endpoints",
        ],
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("Unit: Test validation")).toBeDefined();
      expect(
        screen.getByText("Integration: Test API endpoints"),
      ).toBeDefined();
    });

    it("displays testing requirements from object format", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        testing_requirements: [
          { type: "unit", target: "Schema validation" },
          { type: "integration", target: "API endpoints" },
        ],
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("unit: Schema validation")).toBeDefined();
      expect(screen.getByText("integration: API endpoints")).toBeDefined();
    });

    it("shows placeholder when no testing requirements", () => {
      const task = makeTaskWithPath(1, "Task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      const panelContent = screen.getByTestId("panel-content");
      expect(panelContent.textContent).toContain("No testing requirements");
    });
  });

  describe("metadata section", () => {
    it("displays all metadata fields", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          task_group: "auth",
          spec_path: "specs/auth-SPEC.md",
          source_section: "Section 5.3",
          feature_name: "User Auth",
          spec_phase: 2,
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      // task_group appears in both Overview badge and Metadata row
      const authMatches = screen.getAllByText("auth");
      expect(authMatches.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("specs/auth-SPEC.md")).toBeDefined();
      expect(screen.getByText("Section 5.3")).toBeDefined();
      expect(screen.getByText("User Auth")).toBeDefined();
      expect(screen.getByText("2")).toBeDefined();
    });

    it("displays spec_path even if it references a non-existent file", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          spec_path: "nonexistent/path/to/spec.md",
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(
        screen.getByText("nonexistent/path/to/spec.md"),
      ).toBeDefined();
    });

    it("shows 'No metadata' when no metadata fields present", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {},
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      const panelContent = screen.getByTestId("panel-content");
      expect(panelContent.textContent).toContain("No metadata");
    });
  });

  describe("edge cases", () => {
    it("handles task with no optional fields without errors", () => {
      const task: TaskWithPath = {
        task: {
          id: 1,
          title: "Minimal task",
          description: "Basic description",
          status: "pending",
        },
        filePath: "/project/.agents/tasks/pending/task-1.json",
        mtimeMs: 1700000000001,
      };

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByText("Minimal task")).toBeDefined();
      expect(screen.getByTestId("no-dependencies")).toBeDefined();
      expect(screen.getByTestId("no-acceptance-criteria")).toBeDefined();
    });

    it("scrollable content area for long descriptions", () => {
      const longDescription = Array.from(
        { length: 100 },
        (_, i) => `Line ${i + 1}: This is a long description paragraph.`,
      ).join("\n\n");

      const task = makeTaskWithPath(1, "Long task", "pending", {
        description: longDescription,
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      const content = screen.getByTestId("panel-content");
      expect(content.className).toContain("overflow-y-auto");
    });

    it("has dialog role and accessible label", () => {
      const task = makeTaskWithPath(1, "Accessible task", "pending");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      const panel = screen.getByRole("dialog");
      expect(panel).toBeDefined();
      expect(panel.getAttribute("aria-label")).toBe(
        "Task details: Accessible task",
      );
    });

    it("renders all sections in correct order", () => {
      const task = makeTaskWithPath(1, "Full task", "pending", {
        description: "Some description",
        metadata: { task_group: "group1", spec_path: "spec.md" },
        acceptance_criteria: {
          functional: ["Works"],
        },
        testing_requirements: ["Unit: test it"],
        blocked_by: [2],
      });

      const dep = makeTaskWithPath(2, "Dependency task", "in_progress");

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus({
            pending: [task],
            in_progress: [dep],
          })}
          onClose={defaultOnClose}
        />,
      );

      const content = screen.getByTestId("panel-content");
      const text = content.textContent ?? "";

      // Verify section ordering
      const overviewIdx = text.indexOf("Overview");
      const descIdx = text.indexOf("Description");
      const acIdx = text.indexOf("Acceptance Criteria");
      const testIdx = text.indexOf("Testing Requirements");
      const depIdx = text.indexOf("Dependencies");
      const metaIdx = text.indexOf("Metadata");

      expect(overviewIdx).toBeLessThan(descIdx);
      expect(descIdx).toBeLessThan(acIdx);
      expect(acIdx).toBeLessThan(testIdx);
      expect(testIdx).toBeLessThan(depIdx);
      expect(depIdx).toBeLessThan(metaIdx);
    });
  });

  describe("source section linking", () => {
    it("renders source_section as clickable link when spec_path exists and format is valid", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          spec_path: "specs/auth-SPEC.md",
          source_section: "Section 5.3",
        },
      });
      const onViewSpec = vi.fn();

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
          onViewSpec={onViewSpec}
        />,
      );

      const link = screen.getByTestId("source-section-link");
      expect(link).toBeDefined();
      expect(link.textContent).toBe("Section 5.3");
    });

    it("calls onViewSpec with spec_path and heading text when source section link is clicked", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          spec_path: "specs/auth-SPEC.md",
          source_section: "Section 5.3: User Auth",
        },
      });
      const onViewSpec = vi.fn();

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
          onViewSpec={onViewSpec}
        />,
      );

      fireEvent.click(screen.getByTestId("source-section-link"));
      expect(onViewSpec).toHaveBeenCalledTimes(1);
      expect(onViewSpec).toHaveBeenCalledWith(
        "specs/auth-SPEC.md",
        "5.3 User Auth",
      );
    });

    it("renders source_section as plain text when spec_path is missing", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          source_section: "Section 5.3",
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.queryByTestId("source-section-link")).toBeNull();
      const text = screen.getByTestId("source-section-text");
      expect(text).toBeDefined();
      expect(text.textContent).toContain("Section 5.3");
    });

    it("shows 'no spec path' notice when source_section is valid but spec_path missing", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          source_section: "Section 5.3",
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.getByTestId("source-section-no-spec")).toBeDefined();
    });

    it("renders source_section as plain text when format is invalid", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          spec_path: "specs/auth-SPEC.md",
          source_section: "Introduction",
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
          onViewSpec={vi.fn()}
        />,
      );

      expect(screen.queryByTestId("source-section-link")).toBeNull();
      const text = screen.getByTestId("source-section-text");
      expect(text).toBeDefined();
      expect(text.textContent).toContain("Introduction");
    });

    it("renders as plain text when onViewSpec is not provided", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        metadata: {
          spec_path: "specs/auth-SPEC.md",
          source_section: "Section 5.3",
        },
      });

      render(
        <TaskDetailPanel
          task={task}
          allTasks={makeTasksByStatus()}
          onClose={defaultOnClose}
        />,
      );

      expect(screen.queryByTestId("source-section-link")).toBeNull();
      expect(screen.getByTestId("source-section-text")).toBeDefined();
    });

    it("handles various source_section formats as links", () => {
      const formats = [
        { input: "5.3", display: "Section 5.3" },
        { input: "Section 5.3: Feature Name", display: "Section 5.3: Feature Name" },
        { input: "5.3 - Feature Name", display: "Section 5.3: Feature Name" },
        { input: "5.3.1", display: "Section 5.3.1" },
      ];

      for (const { input, display } of formats) {
        cleanup();
        const task = makeTaskWithPath(1, "Task", "pending", {
          metadata: {
            spec_path: "spec.md",
            source_section: input,
          },
        });

        render(
          <TaskDetailPanel
            task={task}
            allTasks={makeTasksByStatus()}
            onClose={defaultOnClose}
            onViewSpec={vi.fn()}
          />,
        );

        const link = screen.getByTestId("source-section-link");
        expect(link.textContent).toBe(display);
      }
    });
  });
});
