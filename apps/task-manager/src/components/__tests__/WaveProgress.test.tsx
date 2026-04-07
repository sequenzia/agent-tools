import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WaveProgress } from "../WaveProgress";
import type { WaveProgressState } from "../../hooks/use-wave-progress";
import type { ProgressData, ExecutionPlanData } from "../../services/progress-parser";

afterEach(() => {
  cleanup();
});

// --- Test helpers ---

function makeProgress(overrides?: Partial<ProgressData>): ProgressData {
  return {
    executionStatus: "Executing",
    currentWave: 2,
    totalWaves: 5,
    maxParallel: 5,
    updatedAt: "2026-04-06T14:30:00Z",
    activeTasks: [],
    completedTasks: [],
    parseError: null,
    ...overrides,
  };
}

function makePlan(overrides?: Partial<ExecutionPlanData>): ExecutionPlanData {
  return {
    totalTasks: 10,
    totalWaves: 5,
    retryLimit: 3,
    maxParallel: 5,
    waves: [],
    blockedCount: 0,
    completedCount: 0,
    parseError: null,
    ...overrides,
  };
}

function makeState(overrides?: Partial<WaveProgressState>): WaveProgressState {
  return {
    progress: makeProgress(),
    plan: makePlan(),
    completionPct: 30,
    totalTasks: 10,
    completedCount: 3,
    isLoading: false,
    isActive: true,
    error: null,
    ...overrides,
  };
}

describe("WaveProgress", () => {
  describe("when inactive", () => {
    it("renders nothing when isActive is false", () => {
      const { container } = render(
        <WaveProgress state={makeState({ isActive: false })} />,
      );
      expect(container.innerHTML).toBe("");
    });
  });

  describe("initializing state", () => {
    it("shows initializing message when progress is null", () => {
      render(
        <WaveProgress
          state={makeState({ progress: null, isActive: true })}
        />,
      );
      expect(
        screen.getByTestId("wave-progress-initializing"),
      ).toBeDefined();
      expect(
        screen.getByText("Initializing execution session..."),
      ).toBeDefined();
    });
  });

  describe("wave indicator", () => {
    it("displays current wave number and total", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({ currentWave: 2, totalWaves: 5 }),
            plan: makePlan({ totalWaves: 5 }),
          })}
        />,
      );
      expect(screen.getByTestId("wave-indicator").textContent).toBe(
        "Wave 2 of 5",
      );
    });

    it("uses plan totalWaves over progress totalWaves", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({ currentWave: 1, totalWaves: 3 }),
            plan: makePlan({ totalWaves: 7 }),
          })}
        />,
      );
      expect(screen.getByTestId("wave-indicator").textContent).toBe(
        "Wave 1 of 7",
      );
    });

    it("falls back to progress totalWaves when plan is null", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({ currentWave: 2, totalWaves: 4 }),
            plan: null,
          })}
        />,
      );
      expect(screen.getByTestId("wave-indicator").textContent).toBe(
        "Wave 2 of 4",
      );
    });
  });

  describe("execution status badge", () => {
    it("shows Executing status", () => {
      render(<WaveProgress state={makeState()} />);
      expect(
        screen.getByTestId("execution-status-badge").textContent,
      ).toBe("Executing");
    });

    it("shows Complete status with green styling", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({ executionStatus: "Complete" }),
          })}
        />,
      );
      const badge = screen.getByTestId("execution-status-badge");
      expect(badge.textContent).toBe("Complete");
      expect(badge.className).toContain("bg-green");
    });
  });

  describe("progress bar", () => {
    it("shows completion stats", () => {
      render(
        <WaveProgress
          state={makeState({
            completionPct: 30,
            completedCount: 3,
            totalTasks: 10,
          })}
        />,
      );
      expect(screen.getByTestId("completion-stats").textContent).toBe(
        "3 of 10 completed (30%)",
      );
    });

    it("renders progress bar with correct width", () => {
      render(
        <WaveProgress state={makeState({ completionPct: 50 })} />,
      );
      const fill = screen.getByTestId("progress-bar-fill");
      expect(fill.style.width).toBe("50%");
    });

    it("renders progress bar with correct ARIA attributes", () => {
      render(
        <WaveProgress state={makeState({ completionPct: 75 })} />,
      );
      const bar = screen.getByRole("progressbar");
      expect(bar.getAttribute("aria-valuenow")).toBe("75");
      expect(bar.getAttribute("aria-valuemin")).toBe("0");
      expect(bar.getAttribute("aria-valuemax")).toBe("100");
    });
  });

  describe("active tasks", () => {
    it("renders active task rows with status badges", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              activeTasks: [
                {
                  id: "105",
                  title: "Build auth service",
                  status: "running",
                  detail: "Executing",
                },
                {
                  id: "107",
                  title: "Create user model",
                  status: "running",
                  detail: "Executing",
                },
              ],
            }),
          })}
        />,
      );
      expect(screen.getByTestId("active-tasks-section")).toBeDefined();
      expect(screen.getByTestId("task-row-105")).toBeDefined();
      expect(screen.getByTestId("task-row-107")).toBeDefined();
      expect(screen.getByText("Build auth service")).toBeDefined();
      expect(screen.getByText("Create user model")).toBeDefined();
    });

    it("shows task count in section header", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              activeTasks: [
                {
                  id: "1",
                  title: "T1",
                  status: "running",
                  detail: "Executing",
                },
                {
                  id: "2",
                  title: "T2",
                  status: "queued",
                  detail: "Queued",
                },
              ],
            }),
          })}
        />,
      );
      expect(screen.getByText("Active Tasks (2)")).toBeDefined();
    });
  });

  describe("completed tasks", () => {
    it("renders completed tasks section", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              completedTasks: [
                {
                  id: "101",
                  title: "Scaffold",
                  status: "passed",
                  detail: "PASS (45s)",
                },
                {
                  id: "102",
                  title: "Data model",
                  status: "failed",
                  detail: "FAIL (12s)",
                },
              ],
            }),
          })}
        />,
      );
      expect(
        screen.getByTestId("completed-tasks-section"),
      ).toBeDefined();
      expect(screen.getByTestId("task-row-101")).toBeDefined();
      expect(screen.getByTestId("task-row-102")).toBeDefined();
    });

    it("shows correct completed task count in header", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              completedTasks: [
                {
                  id: "1",
                  title: "T1",
                  status: "passed",
                  detail: "PASS",
                },
                {
                  id: "2",
                  title: "T2",
                  status: "passed",
                  detail: "PASS",
                },
                {
                  id: "3",
                  title: "T3",
                  status: "failed",
                  detail: "FAIL",
                },
              ],
            }),
          })}
        />,
      );
      expect(
        screen.getByText("Completed This Session (3)"),
      ).toBeDefined();
    });
  });

  describe("status badges", () => {
    it("renders queued badge", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              activeTasks: [
                {
                  id: "1",
                  title: "T",
                  status: "queued",
                  detail: "Queued",
                },
              ],
            }),
          })}
        />,
      );
      expect(screen.getByTestId("status-badge-queued")).toBeDefined();
      expect(
        screen.getByTestId("status-badge-queued").textContent,
      ).toBe("Queued");
    });

    it("renders running badge", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              activeTasks: [
                {
                  id: "1",
                  title: "T",
                  status: "running",
                  detail: "Executing",
                },
              ],
            }),
          })}
        />,
      );
      expect(screen.getByTestId("status-badge-running")).toBeDefined();
    });

    it("renders passed badge", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              completedTasks: [
                {
                  id: "1",
                  title: "T",
                  status: "passed",
                  detail: "PASS",
                },
              ],
            }),
          })}
        />,
      );
      expect(screen.getByTestId("status-badge-passed")).toBeDefined();
    });

    it("renders partial badge", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              completedTasks: [
                {
                  id: "1",
                  title: "T",
                  status: "partial",
                  detail: "PARTIAL",
                },
              ],
            }),
          })}
        />,
      );
      expect(screen.getByTestId("status-badge-partial")).toBeDefined();
    });

    it("renders failed badge", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              completedTasks: [
                {
                  id: "1",
                  title: "T",
                  status: "failed",
                  detail: "FAIL",
                },
              ],
            }),
          })}
        />,
      );
      expect(screen.getByTestId("status-badge-failed")).toBeDefined();
    });
  });

  describe("parse error banner", () => {
    it("shows parse error when present", () => {
      render(
        <WaveProgress
          state={makeState({
            error: "Unexpected format in progress.md",
          })}
        />,
      );
      expect(screen.getByTestId("parse-error-banner")).toBeDefined();
      expect(
        screen.getByText("Parse warning: Unexpected format in progress.md"),
      ).toBeDefined();
    });

    it("does not show parse error when null", () => {
      render(<WaveProgress state={makeState({ error: null })} />);
      expect(
        screen.queryByTestId("parse-error-banner"),
      ).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("shows empty wave message when no active tasks and not complete", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              executionStatus: "Executing",
              activeTasks: [],
            }),
          })}
        />,
      );
      expect(
        screen.getByText("No active tasks in current wave"),
      ).toBeDefined();
    });

    it("does not show empty wave message when execution is complete", () => {
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({
              executionStatus: "Complete",
              activeTasks: [],
            }),
          })}
        />,
      );
      expect(
        screen.queryByText("No active tasks in current wave"),
      ).toBeNull();
    });

    it("handles many completed tasks with scrollable list", () => {
      const manyTasks = Array.from({ length: 60 }, (_, i) => ({
        id: String(i + 1),
        title: `Task ${i + 1}`,
        status: "passed" as const,
        detail: "PASS",
      }));
      render(
        <WaveProgress
          state={makeState({
            progress: makeProgress({ completedTasks: manyTasks }),
            totalTasks: 60,
            completedCount: 60,
            completionPct: 100,
          })}
        />,
      );
      const section = screen.getByTestId("completed-tasks-section");
      const list = section.querySelector("ul");
      expect(list?.className).toContain("max-h-48");
      expect(list?.className).toContain("overflow-y-auto");
    });
  });
});
