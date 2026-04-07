import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { SpecLifecyclePipeline } from "../SpecLifecyclePipeline";
import type { SpecLifecycleInfo } from "../../services/spec-service";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../../services/api-client";
const mockGet = vi.mocked(api.get);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockLifecycleResponse(info: SpecLifecycleInfo) {
  mockGet.mockImplementation(async (url: string) => {
    if (url === "/api/specs/lifecycle") {
      return info;
    }
    return undefined;
  });
}

const BASE_PROPS = {
  projectPath: "/project",
  specPath: "internal/specs/feature-SPEC.md",
};

describe("SpecLifecyclePipeline", () => {
  describe("stage display", () => {
    it("shows all 5 pipeline stages in correct order", async () => {
      mockLifecycleResponse({
        current_stage: "created",
        completed_stages: ["created"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      // Verify all 5 stages are present
      expect(screen.getByTestId("stage-created")).toBeDefined();
      expect(screen.getByTestId("stage-analyzed")).toBeDefined();
      expect(screen.getByTestId("stage-tasks_generated")).toBeDefined();
      expect(screen.getByTestId("stage-execution_in_progress")).toBeDefined();
      expect(screen.getByTestId("stage-complete")).toBeDefined();

      // Verify labels
      expect(screen.getByText("Spec Created")).toBeDefined();
      expect(screen.getByText("Analyzed")).toBeDefined();
      expect(screen.getByText("Tasks Generated")).toBeDefined();
      expect(screen.getByText("Execution In Progress")).toBeDefined();
      expect(screen.getByText("Complete")).toBeDefined();
    });

    it("highlights current stage as 'current'", async () => {
      mockLifecycleResponse({
        current_stage: "tasks_generated",
        completed_stages: ["created", "analyzed", "tasks_generated"],
        spec_modified_after_tasks: false,
        has_analysis: true,
        total_tasks: 5,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      // Current stage
      const currentCircle = screen.getByTestId("stage-circle-tasks_generated");
      expect(currentCircle.dataset.status).toBe("current");

      // Completed stages
      const createdCircle = screen.getByTestId("stage-circle-created");
      expect(createdCircle.dataset.status).toBe("completed");

      const analyzedCircle = screen.getByTestId("stage-circle-analyzed");
      expect(analyzedCircle.dataset.status).toBe("completed");

      // Future stages
      const execCircle = screen.getByTestId("stage-circle-execution_in_progress");
      expect(execCircle.dataset.status).toBe("future");

      const completeCircle = screen.getByTestId("stage-circle-complete");
      expect(completeCircle.dataset.status).toBe("future");
    });

    it("shows checkmarks on completed stages", async () => {
      mockLifecycleResponse({
        current_stage: "execution_in_progress",
        completed_stages: [
          "created",
          "analyzed",
          "tasks_generated",
          "execution_in_progress",
        ],
        spec_modified_after_tasks: false,
        has_analysis: true,
        total_tasks: 10,
        completed_tasks: 5,
        has_live_session: true,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      // Completed stages should have checkmarks (SVG elements)
      const createdCircle = screen.getByTestId("stage-circle-created");
      expect(createdCircle.querySelector("svg")).not.toBeNull();
      expect(createdCircle.dataset.status).toBe("completed");

      const analyzedCircle = screen.getByTestId("stage-circle-analyzed");
      expect(analyzedCircle.querySelector("svg")).not.toBeNull();
      expect(analyzedCircle.dataset.status).toBe("completed");

      const tasksCircle = screen.getByTestId("stage-circle-tasks_generated");
      expect(tasksCircle.querySelector("svg")).not.toBeNull();
      expect(tasksCircle.dataset.status).toBe("completed");
    });

    it("grays out future stages", async () => {
      mockLifecycleResponse({
        current_stage: "created",
        completed_stages: ["created"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      // Future stages should have "future" status
      const tasksCircle = screen.getByTestId("stage-circle-tasks_generated");
      expect(tasksCircle.dataset.status).toBe("future");

      const execCircle = screen.getByTestId("stage-circle-execution_in_progress");
      expect(execCircle.dataset.status).toBe("future");

      const completeCircle = screen.getByTestId("stage-circle-complete");
      expect(completeCircle.dataset.status).toBe("future");
    });

    it("shows complete stage when all tasks are done", async () => {
      mockLifecycleResponse({
        current_stage: "complete",
        completed_stages: [
          "created",
          "analyzed",
          "tasks_generated",
          "execution_in_progress",
          "complete",
        ],
        spec_modified_after_tasks: false,
        has_analysis: true,
        total_tasks: 5,
        completed_tasks: 5,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      const completeCircle = screen.getByTestId("stage-circle-complete");
      expect(completeCircle.dataset.status).toBe("current");

      // All prior stages should be completed
      expect(screen.getByTestId("stage-circle-created").dataset.status).toBe(
        "completed",
      );
      expect(screen.getByTestId("stage-circle-tasks_generated").dataset.status).toBe(
        "completed",
      );
    });
  });

  describe("task progress", () => {
    it("shows task count when tasks exist", async () => {
      mockLifecycleResponse({
        current_stage: "execution_in_progress",
        completed_stages: [
          "created",
          "tasks_generated",
          "execution_in_progress",
        ],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 10,
        completed_tasks: 3,
        has_live_session: true,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("task-progress")).toBeDefined();
      });

      expect(screen.getByText("3/10 tasks")).toBeDefined();
    });

    it("does not show task count when no tasks exist", async () => {
      mockLifecycleResponse({
        current_stage: "created",
        completed_stages: ["created"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      expect(screen.queryByTestId("task-progress")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("shows spec modified indicator when spec changed after tasks", async () => {
      mockLifecycleResponse({
        current_stage: "tasks_generated",
        completed_stages: ["created", "tasks_generated"],
        spec_modified_after_tasks: true,
        has_analysis: false,
        total_tasks: 5,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-modified-indicator")).toBeDefined();
      });

      expect(screen.getByText("Spec modified")).toBeDefined();
    });

    it("marks analyzed stage as skipped when no analysis exists", async () => {
      mockLifecycleResponse({
        current_stage: "tasks_generated",
        completed_stages: ["created", "tasks_generated"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 5,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      const analyzedCircle = screen.getByTestId("stage-circle-analyzed");
      expect(analyzedCircle.dataset.status).toBe("skipped");
    });

    it("shows partial completion correctly (some tasks done, some pending)", async () => {
      mockLifecycleResponse({
        current_stage: "execution_in_progress",
        completed_stages: [
          "created",
          "analyzed",
          "tasks_generated",
          "execution_in_progress",
        ],
        spec_modified_after_tasks: false,
        has_analysis: true,
        total_tasks: 8,
        completed_tasks: 3,
        has_live_session: true,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      // Should show "In Progress" as current
      const execCircle = screen.getByTestId("stage-circle-execution_in_progress");
      expect(execCircle.dataset.status).toBe("current");

      // Complete should be future
      const completeCircle = screen.getByTestId("stage-circle-complete");
      expect(completeCircle.dataset.status).toBe("future");

      // Task progress should show partial completion
      expect(screen.getByText("3/8 tasks")).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("shows unknown state with refresh button when stage is unknown", async () => {
      mockLifecycleResponse({
        current_stage: "unknown",
        completed_stages: [],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("unknown-stage")).toBeDefined();
      });

      expect(
        screen.getByText("Unable to determine pipeline stage"),
      ).toBeDefined();
      expect(screen.getByTestId("refresh-button")).toBeDefined();
    });

    it("shows unknown state when IPC call fails", async () => {
      mockGet.mockRejectedValue(new Error("IPC error"));

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("pipeline-error")).toBeDefined();
      });

      expect(
        screen.getByText("Unable to determine pipeline stage"),
      ).toBeDefined();
    });

    it("refresh button re-fetches lifecycle data", async () => {
      // First call: unknown
      mockLifecycleResponse({
        current_stage: "unknown",
        completed_stages: [],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("unknown-stage")).toBeDefined();
      });

      // Now mock a successful response for the retry
      mockLifecycleResponse({
        current_stage: "created",
        completed_stages: ["created"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      fireEvent.click(screen.getByTestId("refresh-button"));

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      expect(screen.getByText("Spec Created")).toBeDefined();
    });
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching lifecycle data", () => {
      // Don't resolve the promise
      mockGet.mockReturnValue(new Promise(() => {}));

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      expect(screen.getByTestId("pipeline-loading")).toBeDefined();
    });
  });

  describe("IPC integration", () => {
    it("passes taskGroup to IPC call when provided", async () => {
      mockLifecycleResponse({
        current_stage: "created",
        completed_stages: ["created"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(
        <SpecLifecyclePipeline
          {...BASE_PROPS}
          taskGroup="my-feature"
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      expect(mockGet).toHaveBeenCalledWith("/api/specs/lifecycle", {
        projectPath: "/project",
        specPath: "internal/specs/feature-SPEC.md",
        taskGroup: "my-feature",
      });
    });

    it("passes null taskGroup when not provided", async () => {
      mockLifecycleResponse({
        current_stage: "created",
        completed_stages: ["created"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      });

      render(<SpecLifecyclePipeline {...BASE_PROPS} />);

      await waitFor(() => {
        expect(screen.getByTestId("spec-lifecycle-pipeline")).toBeDefined();
      });

      expect(mockGet).toHaveBeenCalledWith("/api/specs/lifecycle", {
        projectPath: "/project",
        specPath: "internal/specs/feature-SPEC.md",
        taskGroup: undefined,
      });
    });
  });
});
