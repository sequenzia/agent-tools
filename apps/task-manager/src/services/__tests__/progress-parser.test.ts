import { describe, it, expect } from "vitest";
import {
  parseProgressMd,
  parseExecutionPlanMd,
  computeCompletionPercentage,
} from "../progress-parser";

describe("parseProgressMd", () => {
  const FULL_PROGRESS = `# Execution Progress
Status: Executing
Wave: 2 of 5
Max Parallel: 5
Updated: 2026-04-06T14:30:00Z

## Active Tasks
- [105] Build auth service -- Executing
- [107] Create user model -- Executing

## Completed This Session
- [101] Scaffold project -- PASS (45s)
- [102] Add data model -- PASS (32s)
- [103] Setup testing -- FAIL (12s)
`;

  it("parses execution status", () => {
    const result = parseProgressMd(FULL_PROGRESS);
    expect(result.executionStatus).toBe("Executing");
  });

  it("parses wave number and total", () => {
    const result = parseProgressMd(FULL_PROGRESS);
    expect(result.currentWave).toBe(2);
    expect(result.totalWaves).toBe(5);
  });

  it("parses max parallel", () => {
    const result = parseProgressMd(FULL_PROGRESS);
    expect(result.maxParallel).toBe(5);
  });

  it("parses updated timestamp", () => {
    const result = parseProgressMd(FULL_PROGRESS);
    expect(result.updatedAt).toBe("2026-04-06T14:30:00Z");
  });

  it("parses active tasks", () => {
    const result = parseProgressMd(FULL_PROGRESS);
    expect(result.activeTasks).toHaveLength(2);
    expect(result.activeTasks[0]).toEqual({
      id: "105",
      title: "Build auth service",
      status: "running",
      detail: "Executing",
    });
    expect(result.activeTasks[1]).toEqual({
      id: "107",
      title: "Create user model",
      status: "running",
      detail: "Executing",
    });
  });

  it("parses completed tasks", () => {
    const result = parseProgressMd(FULL_PROGRESS);
    expect(result.completedTasks).toHaveLength(3);
    expect(result.completedTasks[0]).toEqual({
      id: "101",
      title: "Scaffold project",
      status: "passed",
      detail: "PASS (45s)",
    });
    expect(result.completedTasks[2]).toEqual({
      id: "103",
      title: "Setup testing",
      status: "failed",
      detail: "FAIL (12s)",
    });
  });

  it("has no parse error for valid content", () => {
    const result = parseProgressMd(FULL_PROGRESS);
    expect(result.parseError).toBeNull();
  });

  it("handles Initializing status", () => {
    const content = `# Execution Progress
Status: Initializing
Wave: 0 of 3
Max Parallel: 5
Updated: 2026-04-06T14:00:00Z

## Active Tasks

## Completed This Session
`;
    const result = parseProgressMd(content);
    expect(result.executionStatus).toBe("Initializing");
    expect(result.currentWave).toBe(0);
    expect(result.totalWaves).toBe(3);
    expect(result.activeTasks).toHaveLength(0);
    expect(result.completedTasks).toHaveLength(0);
  });

  it("handles Complete status", () => {
    const content = `# Execution Progress
Status: Complete
Wave: 3 of 3
Max Parallel: 5
Updated: 2026-04-06T15:00:00Z

## Active Tasks

## Completed This Session
- [101] Scaffold project -- PASS (45s)
- [102] Add data model -- PASS (32s)
`;
    const result = parseProgressMd(content);
    expect(result.executionStatus).toBe("Complete");
    expect(result.currentWave).toBe(3);
    expect(result.completedTasks).toHaveLength(2);
  });

  it("parses retrying tasks as running", () => {
    const content = `# Execution Progress
Status: Executing
Wave: 1 of 2
Max Parallel: 3
Updated: 2026-04-06T14:10:00Z

## Active Tasks
- [105] Build auth service -- Retrying (2/3)

## Completed This Session
`;
    const result = parseProgressMd(content);
    expect(result.activeTasks[0].status).toBe("running");
    expect(result.activeTasks[0].detail).toBe("Retrying (2/3)");
  });

  it("parses PARTIAL status in completed tasks", () => {
    const content = `# Execution Progress
Status: Executing
Wave: 2 of 3
Max Parallel: 5
Updated: 2026-04-06T14:30:00Z

## Active Tasks

## Completed This Session
- [101] Some task -- PARTIAL (30s)
`;
    const result = parseProgressMd(content);
    expect(result.completedTasks[0].status).toBe("partial");
  });

  it("returns parse error for empty content", () => {
    const result = parseProgressMd("");
    expect(result.parseError).toBe("Empty progress file");
  });

  it("returns parse error for whitespace-only content", () => {
    const result = parseProgressMd("   \n  \n  ");
    expect(result.parseError).toBe("Empty progress file");
  });

  it("handles em-dash separator", () => {
    const content = `# Execution Progress
Status: Executing
Wave: 1 of 1
Max Parallel: 5
Updated: 2026-04-06T14:00:00Z

## Active Tasks
- [10] My task \u2014 Executing

## Completed This Session
`;
    const result = parseProgressMd(content);
    expect(result.activeTasks).toHaveLength(1);
    expect(result.activeTasks[0].id).toBe("10");
    expect(result.activeTasks[0].title).toBe("My task");
  });

  it("handles en-dash separator", () => {
    const content = `# Execution Progress
Status: Executing
Wave: 1 of 1
Max Parallel: 5
Updated: 2026-04-06T14:00:00Z

## Active Tasks
- [10] My task \u2013 Executing

## Completed This Session
`;
    const result = parseProgressMd(content);
    expect(result.activeTasks).toHaveLength(1);
  });

  it("gracefully handles malformed lines", () => {
    const content = `# Execution Progress
Status: Executing
Wave: 2 of 4
Max Parallel: 5
Updated: 2026-04-06T14:30:00Z

## Active Tasks
- this is not a valid task line
- [105] Valid task -- Executing
garbage text

## Completed This Session
- [101] Done task -- PASS (5s)
`;
    const result = parseProgressMd(content);
    expect(result.activeTasks).toHaveLength(1);
    expect(result.activeTasks[0].id).toBe("105");
    expect(result.completedTasks).toHaveLength(1);
    expect(result.parseError).toBeNull();
  });
});

describe("parseExecutionPlanMd", () => {
  const FULL_PLAN = `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
EXECUTION PLAN
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
Tasks to execute: 8
Retry limit: 3 per task
Max parallel: 5 per wave

WAVE 1 (3 tasks):
  1. [101] Scaffold project (high)
  2. [102] Add data model (high)
  3. [103] Setup testing (medium)

WAVE 2 (3 tasks):
  4. [104] Build service layer (high) -- after [101, 102]
  5. [105] Add validation (medium) -- after [102]
  6. [106] Create API routes (medium) -- after [101]

WAVE 3 (2 tasks):
  7. [107] Integration tests (low) -- after [104, 105]
  8. [108] Documentation (low) -- after [106]

BLOCKED (unresolvable dependencies):
  [110] Orphan task -- blocked by: 999

COMPLETED:
  5 tasks already completed
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;

  it("parses total tasks", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.totalTasks).toBe(8);
  });

  it("parses retry limit", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.retryLimit).toBe(3);
  });

  it("parses max parallel", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.maxParallel).toBe(5);
  });

  it("parses wave count", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.totalWaves).toBe(3);
  });

  it("parses wave details", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.waves).toHaveLength(3);

    expect(result.waves[0].waveNumber).toBe(1);
    expect(result.waves[0].taskCount).toBe(3);
    expect(result.waves[0].taskIds).toEqual(["101", "102", "103"]);

    expect(result.waves[1].waveNumber).toBe(2);
    expect(result.waves[1].taskCount).toBe(3);
    expect(result.waves[1].taskIds).toEqual(["104", "105", "106"]);

    expect(result.waves[2].waveNumber).toBe(3);
    expect(result.waves[2].taskCount).toBe(2);
    expect(result.waves[2].taskIds).toEqual(["107", "108"]);
  });

  it("parses blocked count", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.blockedCount).toBe(1);
  });

  it("parses completed count", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.completedCount).toBe(5);
  });

  it("has no parse error for valid content", () => {
    const result = parseExecutionPlanMd(FULL_PLAN);
    expect(result.parseError).toBeNull();
  });

  it("returns parse error for empty content", () => {
    const result = parseExecutionPlanMd("");
    expect(result.parseError).toBe("Empty execution plan");
  });

  it("handles plan with no blocked or completed sections", () => {
    const content = `EXECUTION PLAN
Tasks to execute: 3
Retry limit: 1 per task
Max parallel: 3 per wave

WAVE 1 (3 tasks):
  1. [1] Task A (high)
  2. [2] Task B (medium)
  3. [3] Task C (low)
`;
    const result = parseExecutionPlanMd(content);
    expect(result.totalTasks).toBe(3);
    expect(result.totalWaves).toBe(1);
    expect(result.waves[0].taskIds).toEqual(["1", "2", "3"]);
    expect(result.blockedCount).toBe(0);
    expect(result.completedCount).toBe(0);
  });

  it("handles single-task wave", () => {
    const content = `EXECUTION PLAN
Tasks to execute: 1
Retry limit: 3 per task
Max parallel: 1 per wave

WAVE 1 (1 task):
  1. [42] Single task (critical)
`;
    const result = parseExecutionPlanMd(content);
    expect(result.totalWaves).toBe(1);
    expect(result.waves[0].taskCount).toBe(1);
    expect(result.waves[0].taskIds).toEqual(["42"]);
  });
});

describe("computeCompletionPercentage", () => {
  it("returns 0 for 0 total", () => {
    expect(computeCompletionPercentage(0, 0)).toBe(0);
  });

  it("returns 0 for 0 completed", () => {
    expect(computeCompletionPercentage(0, 10)).toBe(0);
  });

  it("returns 100 for all completed", () => {
    expect(computeCompletionPercentage(10, 10)).toBe(100);
  });

  it("returns correct percentage", () => {
    expect(computeCompletionPercentage(3, 10)).toBe(30);
  });

  it("rounds to nearest integer", () => {
    expect(computeCompletionPercentage(1, 3)).toBe(33);
  });

  it("caps at 100", () => {
    expect(computeCompletionPercentage(15, 10)).toBe(100);
  });

  it("returns 0 for negative total", () => {
    expect(computeCompletionPercentage(5, -1)).toBe(0);
  });
});
