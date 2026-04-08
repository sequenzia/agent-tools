import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { SpecViewer } from "../SpecViewer";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

// Mock mermaid — jsdom lacks SVG support needed for real rendering
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn((_id: string, code: string) =>
      Promise.resolve({ svg: `<svg data-testid="mermaid-svg">${code}</svg>` }),
    ),
  },
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

function mockSpecResponse(
  content: string,
  hasAnalysis: boolean = false,
  analysisContent?: string,
) {
  mockGet.mockImplementation(async (url: string, params?: unknown) => {
    const p = params as Record<string, string> | undefined;
    if (url === "/api/specs/read") {
      if (p?.specPath?.includes(".analysis.md") && analysisContent) {
        return {
          content: analysisContent,
          resolved_path: "/project/spec.analysis.md",
          size: analysisContent.length,
        };
      }
      return {
        content,
        resolved_path: "/project/spec.md",
        size: content.length,
      };
    }
    if (url === "/api/specs/analysis") {
      return {
        exists: hasAnalysis,
        analysis_path: "/project/spec.analysis.md",
      };
    }
    return undefined;
  });
}

describe("SpecViewer", () => {
  describe("loading state", () => {
    it("shows loading spinner while spec is being fetched", () => {
      mockGet.mockReturnValue(new Promise(() => {}));

      render(
        <SpecViewer projectPath="/project" specPath="internal/spec.md" />,
      );

      expect(screen.getByText("Loading spec...")).toBeDefined();
      expect(screen.getByRole("status")).toBeDefined();
    });
  });

  describe("markdown rendering", () => {
    it("renders heading elements from markdown", async () => {
      mockSpecResponse("# Main Title\n\n## Subtitle\n\nSome text.");

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Main Title")).toBeDefined();
      });
      expect(screen.getByText("Subtitle")).toBeDefined();
      expect(screen.getByText("Some text.")).toBeDefined();
    });

    it("renders lists from markdown", async () => {
      mockSpecResponse(
        "## Items\n\n- Item one\n- Item two\n- Item three\n",
      );

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Item one")).toBeDefined();
      });
      expect(screen.getByText("Item two")).toBeDefined();
      expect(screen.getByText("Item three")).toBeDefined();
    });

    it("renders tables from markdown", async () => {
      mockSpecResponse(
        "## Data\n\n| Name | Value |\n|------|-------|\n| Alpha | 1 |\n| Beta | 2 |\n",
      );

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Name")).toBeDefined();
      });
      expect(screen.getByText("Value")).toBeDefined();
      expect(screen.getByText("Alpha")).toBeDefined();
      expect(screen.getByText("Beta")).toBeDefined();
    });

    it("renders code blocks from markdown", async () => {
      const md = '## Code\n\n```typescript\nconst x = 1;\n```\n';
      mockSpecResponse(md);

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("const x = 1;")).toBeDefined();
      });
    });

    it("renders mermaid blocks as diagrams", async () => {
      const md =
        "## Diagram\n\n```mermaid\ngraph TD\n  A-->B\n```\n";
      mockSpecResponse(md);

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("mermaid-svg")).toBeDefined();
      });
    });
  });

  describe("section anchoring", () => {
    it("generates anchor IDs on headings", async () => {
      mockSpecResponse(
        "# Executive Summary\n\n## Problem Statement\n\nText here.",
      );

      const { container } = render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Executive Summary")).toBeDefined();
      });

      const h1 = container.querySelector("#executive-summary");
      expect(h1).not.toBeNull();

      const h2 = container.querySelector("#problem-statement");
      expect(h2).not.toBeNull();
    });

    it("generates URL-safe anchor IDs for headings with special characters", async () => {
      mockSpecResponse(
        "# What's New?\n\n## Section 5.7: Feature (v2)\n\nContent.",
      );

      const { container } = render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText(/What's New/)).toBeDefined();
      });

      const h1 = container.querySelector("#whats-new");
      expect(h1).not.toBeNull();

      const h2 = container.querySelector("#section-57-feature-v2");
      expect(h2).not.toBeNull();
    });

    it("includes anchor links on headings", async () => {
      mockSpecResponse("# Test Heading\n\nSome content.");

      const { container } = render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Test Heading")).toBeDefined();
      });

      const link = container.querySelector('a[href="#test-heading"]');
      expect(link).not.toBeNull();
    });
  });

  describe("scroll to section", () => {
    it("shows notification when section anchor is not found", async () => {
      mockSpecResponse("# Existing Section\n\nContent here.");

      render(
        <SpecViewer
          projectPath="/project"
          specPath="spec.md"
          scrollToSection="Nonexistent Section"
        />,
      );

      await waitFor(
        () => {
          expect(
            screen.getByText(
              /Section "Nonexistent Section" not found/,
            ),
          ).toBeDefined();
        },
        { timeout: 2000 },
      );
    });

    it("does not show notification when section exists", async () => {
      mockSpecResponse("# Target Section\n\nContent here.");

      // Mock scrollIntoView
      Element.prototype.scrollIntoView = vi.fn();

      render(
        <SpecViewer
          projectPath="/project"
          specPath="spec.md"
          scrollToSection="Target Section"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText("Target Section")).toBeDefined();
      });

      // Wait a bit for the scroll effect timer
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(screen.queryByText(/not found/)).toBeNull();
    });
  });

  describe("analysis tab", () => {
    it("shows tabs when analysis file exists", async () => {
      mockSpecResponse(
        "# Spec Content\n\nMain spec.",
        true,
        "# Analysis\n\nFindings here.",
      );

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Spec")).toBeDefined();
      });
      expect(screen.getByText("Analysis")).toBeDefined();
    });

    it("does not show tabs when no analysis file", async () => {
      mockSpecResponse("# Spec Content\n\nMain spec.", false);

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Spec Content")).toBeDefined();
      });

      expect(screen.queryByText("Analysis")).toBeNull();
    });

    it("switches to analysis tab when clicked", async () => {
      mockSpecResponse(
        "# Spec Content\n\nMain spec text here.",
        true,
        "# Analysis Results\n\nAnalysis findings.",
      );

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Spec Content")).toBeDefined();
      });

      const analysisTab = screen.getByText("Analysis");
      fireEvent.click(analysisTab);

      await waitFor(() => {
        expect(screen.getByText("Analysis Results")).toBeDefined();
      });
    });
  });

  describe("error handling", () => {
    it("shows error when spec fails to load", async () => {
      mockGet.mockRejectedValue("Spec file not found: /project/missing.md");

      render(
        <SpecViewer projectPath="/project" specPath="missing.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Failed to load spec")).toBeDefined();
      });
      expect(
        screen.getByText("Spec file not found: /project/missing.md"),
      ).toBeDefined();
    });

    it("shows error for Error objects", async () => {
      mockGet.mockRejectedValue(new Error("Permission denied"));

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Failed to load spec")).toBeDefined();
      });
      expect(screen.getByText("Permission denied")).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles spec with no analysis file without error", async () => {
      mockSpecResponse("# Simple Spec\n\nJust a spec, no analysis.", false);

      render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Simple Spec")).toBeDefined();
      });

      // No error state visible
      expect(screen.queryByText("Failed to load spec")).toBeNull();
      expect(screen.queryByText(/error/i)).toBeNull();
    });

    it("renders very long content in a scrollable container", async () => {
      const longContent =
        "# Long Spec\n\n" +
        Array.from({ length: 200 }, (_, i) => `## Section ${i + 1}\n\nContent for section ${i + 1}.\n`).join("\n");
      mockSpecResponse(longContent);

      const { container } = render(
        <SpecViewer projectPath="/project" specPath="spec.md" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Long Spec")).toBeDefined();
      });

      const contentArea = container.querySelector(
        '[data-testid="spec-content"]',
      );
      expect(contentArea).not.toBeNull();
      // Check the container has overflow-y-auto for scrollability
      expect(contentArea?.className).toContain("overflow-y-auto");
    });
  });
});
