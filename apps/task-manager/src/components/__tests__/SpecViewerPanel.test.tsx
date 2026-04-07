import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SpecViewerPanel } from "../SpecViewerPanel";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockSpecResponse(content: string) {
  mockInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === "read_spec") {
      return {
        content,
        resolved_path: "/project/spec.md",
        size: content.length,
      };
    }
    if (cmd === "check_spec_analysis") {
      return {
        exists: false,
        analysis_path: "/project/spec.analysis.md",
      };
    }
    if (cmd === "get_spec_lifecycle") {
      return {
        current_stage: "created",
        completed_stages: ["created"],
        spec_modified_after_tasks: false,
        has_analysis: false,
        total_tasks: 0,
        completed_tasks: 0,
        has_live_session: false,
      };
    }
    return undefined;
  });
}

describe("SpecViewerPanel", () => {
  describe("rendering", () => {
    it("renders the spec viewer panel overlay", () => {
      mockSpecResponse("# Test Spec\n\nContent.");

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={vi.fn()}
        />,
      );

      expect(screen.getByTestId("spec-viewer-panel")).toBeDefined();
    });

    it("displays the spec path in the header", () => {
      mockSpecResponse("# Test Spec\n\nContent.");

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="internal/specs/feature-SPEC.md"
          onBack={vi.fn()}
        />,
      );

      expect(screen.getByTestId("spec-viewer-path").textContent).toBe(
        "internal/specs/feature-SPEC.md",
      );
    });

    it("shows the source task title in back button", () => {
      mockSpecResponse("# Test Spec\n\nContent.");

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={vi.fn()}
          sourceTaskTitle="Build authentication"
        />,
      );

      expect(
        screen.getByTestId("spec-viewer-back-button").textContent,
      ).toContain('Back to "Build authentication"');
    });

    it("shows generic back text when no source task title", () => {
      mockSpecResponse("# Test Spec\n\nContent.");

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={vi.fn()}
        />,
      );

      expect(
        screen.getByTestId("spec-viewer-back-button").textContent,
      ).toContain("Back to task");
    });

    it("renders the SpecViewer inside the panel", async () => {
      mockSpecResponse("# My Spec\n\nSpec content here.");

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("My Spec")).toBeDefined();
      });
    });
  });

  describe("navigation", () => {
    it("calls onBack when back button is clicked", () => {
      mockSpecResponse("# Test Spec\n\nContent.");
      const onBack = vi.fn();

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={onBack}
        />,
      );

      fireEvent.click(screen.getByTestId("spec-viewer-back-button"));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("calls onBack when close button is clicked", () => {
      mockSpecResponse("# Test Spec\n\nContent.");
      const onBack = vi.fn();

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={onBack}
        />,
      );

      fireEvent.click(screen.getByTestId("spec-viewer-close-button"));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("calls onBack when Escape key is pressed", () => {
      mockSpecResponse("# Test Spec\n\nContent.");
      const onBack = vi.fn();

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={onBack}
        />,
      );

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("passes scrollToSection to the SpecViewer", async () => {
      mockSpecResponse(
        "# Spec\n\n## 5.7 Spec Lifecycle View\n\nTarget section content.",
      );

      // Mock scrollIntoView
      Element.prototype.scrollIntoView = vi.fn();

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          scrollToSection="5.7 Spec Lifecycle View"
          onBack={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("5.7 Spec Lifecycle View")).toBeDefined();
      });
    });
  });

  describe("accessibility", () => {
    it("has dialog role", () => {
      mockSpecResponse("# Test Spec\n\nContent.");

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={vi.fn()}
        />,
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute("aria-label")).toContain("spec.md");
    });

    it("back button has appropriate aria-label with task title", () => {
      mockSpecResponse("# Test Spec\n\nContent.");

      render(
        <SpecViewerPanel
          projectPath="/project"
          specPath="spec.md"
          onBack={vi.fn()}
          sourceTaskTitle="My Task"
        />,
      );

      const backButton = screen.getByTestId("spec-viewer-back-button");
      expect(backButton.getAttribute("aria-label")).toBe(
        "Back to task: My Task",
      );
    });
  });
});
