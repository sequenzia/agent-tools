import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ResultPanel } from "../ResultPanel";
import { useResultStore } from "../../stores/result-store";
import type { ParsedResult } from "../../services/result-service";

// Mock result-service (used by the store)
vi.mock("../../services/result-service", () => ({
  fetchResult: vi.fn(),
  fetchAllResults: vi.fn(),
}));

function makeResult(overrides: Partial<ParsedResult> = {}): ParsedResult {
  return {
    taskId: "5",
    filename: "result-5.md",
    subject: "Implement feature X",
    outcome: "PASS",
    rawContent:
      "# Task Result: [5] Implement feature X\nstatus: PASS\n\n## Files Modified\n- src/x.ts",
    isTruncated: false,
    contentSize: 100,
    isMalformed: false,
    parseWarning: null,
    receivedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useResultStore.setState({
    results: new Map(),
    isLoading: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

describe("ResultPanel", () => {
  describe("empty state", () => {
    it("shows empty message when no results", () => {
      render(<ResultPanel projectPath="/project" />);
      expect(
        screen.getByText(/No results yet/),
      ).toBeDefined();
    });
  });

  describe("loading state", () => {
    it("shows loading message when loading with no results", () => {
      useResultStore.setState({ isLoading: true });
      render(<ResultPanel projectPath="/project" />);
      expect(screen.getByText(/Loading results/)).toBeDefined();
    });
  });

  describe("error state", () => {
    it("shows error message when error with no results", () => {
      useResultStore.setState({ error: "Something went wrong" });
      render(<ResultPanel projectPath="/project" />);
      expect(
        screen.getByText(/Error loading results/),
      ).toBeDefined();
      expect(
        screen.getByText(/Something went wrong/),
      ).toBeDefined();
    });
  });

  describe("result display", () => {
    it("renders result entries with task ID and subject", () => {
      const result = makeResult();
      useResultStore.setState({
        results: new Map([["result-5.md", result]]),
      });

      render(<ResultPanel projectPath="/project" />);

      expect(screen.getByText(/\[5\] Implement feature X/)).toBeDefined();
    });

    it("shows outcome badge for PASS result", () => {
      useResultStore.setState({
        results: new Map([["result-5.md", makeResult({ outcome: "PASS" })]]),
      });

      render(<ResultPanel projectPath="/project" />);
      expect(
        screen.getByTestId("outcome-badge-pass"),
      ).toBeDefined();
    });

    it("shows outcome badge for PARTIAL result", () => {
      useResultStore.setState({
        results: new Map([
          [
            "result-10.md",
            makeResult({
              filename: "result-10.md",
              outcome: "PARTIAL",
            }),
          ],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);
      expect(
        screen.getByTestId("outcome-badge-partial"),
      ).toBeDefined();
    });

    it("shows outcome badge for FAIL result", () => {
      useResultStore.setState({
        results: new Map([
          [
            "result-42.md",
            makeResult({
              filename: "result-42.md",
              outcome: "FAIL",
            }),
          ],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);
      expect(
        screen.getByTestId("outcome-badge-fail"),
      ).toBeDefined();
    });

    it("shows total count in header", () => {
      useResultStore.setState({
        results: new Map([
          ["result-5.md", makeResult()],
          [
            "result-10.md",
            makeResult({ filename: "result-10.md", taskId: "10" }),
          ],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);
      expect(screen.getByText(/Task Results \(2\)/)).toBeDefined();
    });

    it("shows results sorted with newest first", () => {
      const older = makeResult({
        filename: "result-5.md",
        taskId: "5",
        subject: "Older task",
        receivedAt: 1000,
      });
      const newer = makeResult({
        filename: "result-10.md",
        taskId: "10",
        subject: "Newer task",
        receivedAt: 2000,
      });

      useResultStore.setState({
        results: new Map([
          ["result-5.md", older],
          ["result-10.md", newer],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);

      const entries = screen.getAllByTestId(/^result-entry-/);
      expect(entries[0].getAttribute("data-testid")).toBe(
        "result-entry-result-10.md",
      );
      expect(entries[1].getAttribute("data-testid")).toBe(
        "result-entry-result-5.md",
      );
    });
  });

  describe("expanding results", () => {
    it("expands a result entry when clicked", () => {
      useResultStore.setState({
        results: new Map([["result-5.md", makeResult()]]),
      });

      render(<ResultPanel projectPath="/project" />);

      // Content should not be visible initially
      expect(
        screen.queryByTestId("result-content-result-5.md"),
      ).toBeNull();

      // Click to expand
      const button = screen.getByRole("button", {
        name: /Task 5.*Implement feature X.*PASS/,
      });
      fireEvent.click(button);

      // Content should now be visible
      expect(
        screen.getByTestId("result-content-result-5.md"),
      ).toBeDefined();
    });

    it("collapses an expanded result when clicked again", () => {
      useResultStore.setState({
        results: new Map([["result-5.md", makeResult()]]),
      });

      render(<ResultPanel projectPath="/project" />);

      const button = screen.getByRole("button", {
        name: /Task 5/,
      });

      // Expand
      fireEvent.click(button);
      expect(
        screen.getByTestId("result-content-result-5.md"),
      ).toBeDefined();

      // Collapse
      fireEvent.click(button);
      expect(
        screen.queryByTestId("result-content-result-5.md"),
      ).toBeNull();
    });
  });

  describe("malformed results", () => {
    it("shows warning indicator for malformed results", () => {
      useResultStore.setState({
        results: new Map([
          [
            "result-7.md",
            makeResult({
              filename: "result-7.md",
              taskId: "7",
              isMalformed: true,
              parseWarning: "Could not parse outcome",
            }),
          ],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);

      // The (!) warning indicator should be present
      expect(screen.getByText("(!)")).toBeDefined();
    });
  });

  describe("unknown task", () => {
    it("shows 'Unknown Task' label for unknown task IDs", () => {
      useResultStore.setState({
        results: new Map([
          [
            "result-unknown.md",
            makeResult({
              filename: "result-unknown.md",
              taskId: "unknown",
              subject: "Some result",
            }),
          ],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);

      // The button aria-label should contain "Unknown Task"
      const button = screen.getByRole("button", {
        name: /Unknown Task/,
      });
      expect(button).toBeDefined();
    });
  });

  describe("truncated content", () => {
    it("shows 'Show full content' button for truncated results", () => {
      useResultStore.setState({
        results: new Map([
          [
            "result-5.md",
            makeResult({
              isTruncated: true,
              contentSize: 60 * 1024,
            }),
          ],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);

      // Expand first
      const expandButton = screen.getByRole("button", {
        name: /Task 5/,
      });
      fireEvent.click(expandButton);

      // Should show the full content button
      expect(
        screen.getByText(/Show full content/),
      ).toBeDefined();
    });
  });

  describe("multiple results", () => {
    it("renders multiple results simultaneously", () => {
      useResultStore.setState({
        results: new Map([
          [
            "result-5.md",
            makeResult({
              filename: "result-5.md",
              taskId: "5",
              outcome: "PASS",
              receivedAt: 1000,
            }),
          ],
          [
            "result-10.md",
            makeResult({
              filename: "result-10.md",
              taskId: "10",
              outcome: "PARTIAL",
              receivedAt: 2000,
            }),
          ],
          [
            "result-42.md",
            makeResult({
              filename: "result-42.md",
              taskId: "42",
              outcome: "FAIL",
              receivedAt: 3000,
            }),
          ],
        ]),
      });

      render(<ResultPanel projectPath="/project" />);

      const entries = screen.getAllByTestId(/^result-entry-/);
      expect(entries.length).toBe(3);

      // All outcome badges should be present
      expect(screen.getByTestId("outcome-badge-pass")).toBeDefined();
      expect(screen.getByTestId("outcome-badge-partial")).toBeDefined();
      expect(screen.getByTestId("outcome-badge-fail")).toBeDefined();
    });
  });

  describe("panel structure", () => {
    it("has scrollable container", () => {
      useResultStore.setState({
        results: new Map([["result-5.md", makeResult()]]),
      });

      render(<ResultPanel projectPath="/project" />);

      const panel = screen.getByTestId("result-panel");
      expect(panel).toBeDefined();
      // The panel should have overflow-y-auto class for scrollability
      const scrollContainer = panel.querySelector(".overflow-y-auto");
      expect(scrollContainer).not.toBeNull();
    });
  });
});
