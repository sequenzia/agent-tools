import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  ExecutionContextMonitor,
  splitIntoSections,
  sectionHasNewContent,
  formatTimestamp,
} from "../ExecutionContextMonitor";
import type { ExecutionContextState } from "../../hooks/use-execution-context";

afterEach(() => {
  cleanup();
});

// --- Test helpers ---

function makeState(
  overrides?: Partial<ExecutionContextState>,
): ExecutionContextState {
  return {
    content: "# Execution Context\n\n## Project Patterns\n- Pattern 1\n",
    previousContent: null,
    newLineIndices: new Set(),
    isLoading: false,
    isActive: true,
    error: null,
    isStale: false,
    lastUpdated: Date.now(),
    ...overrides,
  };
}

describe("ExecutionContextMonitor", () => {
  describe("when inactive", () => {
    it("renders nothing when isActive is false", () => {
      const { container } = render(
        <ExecutionContextMonitor state={makeState({ isActive: false })} />,
      );
      expect(container.innerHTML).toBe("");
    });
  });

  describe("loading state", () => {
    it("shows loading indicator when loading with no content", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({ isLoading: true, content: null, isActive: true })}
        />,
      );
      expect(
        screen.getByTestId("context-monitor-loading"),
      ).toBeDefined();
      expect(
        screen.getByText("Loading execution context..."),
      ).toBeDefined();
    });
  });

  describe("empty state (file does not exist)", () => {
    it("shows 'No learnings yet' placeholder when content is null", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({ content: null, isActive: true })}
        />,
      );
      expect(
        screen.getByTestId("context-monitor-empty"),
      ).toBeDefined();
      expect(screen.getByText("No learnings yet")).toBeDefined();
      expect(
        screen.getByText(
          "Cross-task learnings will appear here as tasks complete.",
        ),
      ).toBeDefined();
    });
  });

  describe("error state with no fallback", () => {
    it("shows error message when content is null and error exists", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({
            content: null,
            error: "Permission denied",
            isActive: true,
          })}
        />,
      );
      expect(screen.getByTestId("context-monitor")).toBeDefined();
      expect(
        screen.getByText(/Failed to load execution context/),
      ).toBeDefined();
      expect(screen.getByText(/Permission denied/)).toBeDefined();
    });
  });

  describe("stale indicator", () => {
    it("shows stale indicator when isStale is true and error exists", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({
            isStale: true,
            error: "Timeout reading file",
            isActive: true,
          })}
        />,
      );
      expect(
        screen.getByTestId("context-monitor-stale"),
      ).toBeDefined();
      expect(screen.getByText("Content may be stale")).toBeDefined();
      expect(
        screen.getByText("(Timeout reading file)"),
      ).toBeDefined();
    });

    it("does not show stale indicator when isStale is false", () => {
      render(
        <ExecutionContextMonitor state={makeState({ isStale: false })} />,
      );
      expect(
        screen.queryByTestId("context-monitor-stale"),
      ).toBeNull();
    });
  });

  describe("markdown rendering", () => {
    it("renders markdown content as formatted HTML", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({
            content:
              "## Project Patterns\n- Pattern 1\n- Pattern 2\n\n## Key Decisions\n- Decision A\n",
          })}
        />,
      );
      expect(screen.getByTestId("context-monitor")).toBeDefined();
      expect(screen.getByText("Project Patterns")).toBeDefined();
      expect(screen.getByText("Key Decisions")).toBeDefined();
      expect(screen.getByText("Pattern 1")).toBeDefined();
      expect(screen.getByText("Decision A")).toBeDefined();
    });

    it("renders content in a scrollable container", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({
            content: "## Section\n- Item\n",
          })}
        />,
      );
      const container = screen.getByTestId("context-monitor-content");
      expect(container.className).toContain("overflow-y-auto");
    });
  });

  describe("new content highlighting", () => {
    it("shows 'new' badge on sections with new content", () => {
      const content =
        "## Project Patterns\n- Pattern 1\n\n## Task History\n### Task [1]: Test - PASS\n- New learning\n";
      render(
        <ExecutionContextMonitor
          state={makeState({
            content,
            newLineIndices: new Set([3, 4, 5]),
            previousContent: "## Project Patterns\n- Pattern 1\n",
          })}
        />,
      );
      const badges = screen.getAllByTestId("new-content-badge");
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it("does not show 'new' badge when no new lines", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({
            content: "## Section\n- Item\n",
            newLineIndices: new Set(),
          })}
        />,
      );
      expect(screen.queryByTestId("new-content-badge")).toBeNull();
    });

    it("highlights new sections with a blue border", () => {
      const content = "## Old Section\n- Old\n\n## New Section\n- New\n";
      render(
        <ExecutionContextMonitor
          state={makeState({
            content,
            newLineIndices: new Set([3, 4]),
          })}
        />,
      );
      // The new section should have the blue border style.
      const sections = screen.getByTestId("context-monitor-content").children;
      const lastSection = sections[sections.length - 1];
      expect(lastSection.className).toContain("border-l-blue-500");
    });
  });

  describe("header", () => {
    it("displays 'Execution Context' title in header", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({ content: "## Patterns\n- P1\n" })}
        />,
      );
      // The h3 header always contains "Execution Context"
      const headings = screen.getAllByText("Execution Context");
      // At least the header h3 should be present
      const h3 = headings.find((el) => el.tagName === "H3");
      expect(h3).toBeDefined();
    });

    it("shows last updated timestamp", () => {
      const now = Date.now();
      render(
        <ExecutionContextMonitor
          state={makeState({ lastUpdated: now })}
        />,
      );
      expect(screen.getByTestId("last-updated")).toBeDefined();
      expect(
        screen.getByTestId("last-updated").textContent,
      ).toContain("Updated");
    });

    it("does not show timestamp when lastUpdated is null", () => {
      render(
        <ExecutionContextMonitor
          state={makeState({ lastUpdated: null })}
        />,
      );
      expect(screen.queryByTestId("last-updated")).toBeNull();
    });
  });

  describe("auto-scroll", () => {
    it("calls scrollTo on the container when lastUpdated changes", () => {
      const scrollToSpy = vi.fn();
      // Mock requestAnimationFrame to fire synchronously.
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb) => {
          cb(0);
          return 0;
        },
      );

      const { rerender } = render(
        <ExecutionContextMonitor
          state={makeState({ lastUpdated: 1000 })}
        />,
      );

      const container = screen.getByTestId("context-monitor-content");
      container.scrollTo = scrollToSpy;

      rerender(
        <ExecutionContextMonitor
          state={makeState({ lastUpdated: 2000 })}
        />,
      );

      expect(scrollToSpy).toHaveBeenCalledWith({
        top: container.scrollHeight,
        behavior: "smooth",
      });

      vi.restoreAllMocks();
    });
  });
});

// --- Unit tests for utility functions ---

describe("splitIntoSections", () => {
  it("splits content by ## headings", () => {
    const content =
      "## Section A\n- Item 1\n\n## Section B\n- Item 2\n";
    const sections = splitIntoSections(content);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("## Section A");
    expect(sections[1].heading).toBe("## Section B");
  });

  it("handles content before the first heading", () => {
    const content = "# Title\nSome intro\n\n## Section\n- Item\n";
    const sections = splitIntoSections(content);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("");
    expect(sections[0].body).toContain("Title");
    expect(sections[1].heading).toBe("## Section");
  });

  it("handles empty content", () => {
    const sections = splitIntoSections("");
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("");
    expect(sections[0].body).toBe("");
  });

  it("tracks start line correctly", () => {
    const content = "## A\nLine 1\n\n## B\nLine 2\n";
    const sections = splitIntoSections(content);
    expect(sections[0].startLine).toBe(0);
    expect(sections[1].startLine).toBe(3);
  });
});

describe("sectionHasNewContent", () => {
  it("returns true when section contains new lines", () => {
    const section = { heading: "## Test", body: "- Item", startLine: 5 };
    const newLines = new Set([5, 6]);
    expect(sectionHasNewContent(section, newLines, 10)).toBe(true);
  });

  it("returns false when section has no new lines", () => {
    const section = { heading: "## Test", body: "- Item", startLine: 5 };
    const newLines = new Set([0, 1, 2]);
    expect(sectionHasNewContent(section, newLines, 10)).toBe(false);
  });

  it("returns false when newLineIndices is empty", () => {
    const section = { heading: "## Test", body: "- Item", startLine: 0 };
    expect(sectionHasNewContent(section, new Set(), 10)).toBe(false);
  });
});

describe("formatTimestamp", () => {
  it("returns 'just now' for timestamps less than 5 seconds ago", () => {
    expect(formatTimestamp(Date.now() - 2000)).toBe("just now");
  });

  it("returns seconds for timestamps less than 60 seconds ago", () => {
    const result = formatTimestamp(Date.now() - 30000);
    expect(result).toMatch(/^\d+s ago$/);
  });

  it("returns minutes for timestamps less than 60 minutes ago", () => {
    const result = formatTimestamp(Date.now() - 300000);
    expect(result).toMatch(/^\d+m ago$/);
  });

  it("returns hours for timestamps 60+ minutes ago", () => {
    const result = formatTimestamp(Date.now() - 7200000);
    expect(result).toMatch(/^\d+h ago$/);
  });
});
