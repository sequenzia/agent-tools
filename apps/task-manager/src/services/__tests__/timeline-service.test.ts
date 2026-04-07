import { describe, it, expect } from "vitest";
import {
  parseTaskLog,
  parseDuration,
  formatDuration,
} from "../timeline-service";

describe("parseDuration", () => {
  it("parses seconds only", () => {
    expect(parseDuration("45s")).toBe(45);
  });

  it("parses minutes and seconds", () => {
    expect(parseDuration("1m 23s")).toBe(83);
  });

  it("parses minutes only", () => {
    expect(parseDuration("2m")).toBe(120);
  });

  it("parses hours, minutes, and seconds", () => {
    expect(parseDuration("1h 5m 30s")).toBe(3930);
  });

  it("parses decimal seconds", () => {
    expect(parseDuration("123.4s")).toBe(123);
  });

  it("returns null for N/A", () => {
    expect(parseDuration("N/A")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDuration("")).toBeNull();
  });

  it("parses plain number as seconds", () => {
    expect(parseDuration("90")).toBe(90);
  });

  it("handles whitespace", () => {
    expect(parseDuration("  45s  ")).toBe(45);
  });

  it("returns null for non-numeric garbage", () => {
    expect(parseDuration("abc")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(83)).toBe("1m 23s");
  });

  it("formats exact minutes", () => {
    expect(formatDuration(120)).toBe("2m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3900)).toBe("1h 5m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(3600)).toBe("1h");
  });

  it("formats 0 seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("handles negative values", () => {
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("parseTaskLog", () => {
  const FULL_LOG = `# Task Execution Log

| Task ID | Subject | Status | Attempts | Duration | Token Usage |
|---------|---------|--------|----------|----------|-------------|
| 101 | Scaffold project | PASS | 1/3 | 45s | 12345 |
| 102 | Add data model | PASS | 1/3 | 32s | 23456 |
| 103 | Setup testing | FAIL | 2/3 | 1m 23s | 34567 |
`;

  it("parses completed events from task log", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events).toHaveLength(3);
  });

  it("identifies completed events correctly", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events[0].type).toBe("completed");
    expect(result.events[0].taskId).toBe("101");
    expect(result.events[0].title).toBe("Scaffold project");
  });

  it("identifies failed events correctly", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events[2].type).toBe("failed");
    expect(result.events[2].taskId).toBe("103");
  });

  it("extracts duration strings", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events[0].duration).toBe("45s");
    expect(result.events[2].duration).toBe("1m 23s");
  });

  it("parses duration into seconds", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events[0].durationSeconds).toBe(45);
    expect(result.events[1].durationSeconds).toBe(32);
    expect(result.events[2].durationSeconds).toBe(83);
  });

  it("extracts attempt info", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events[0].attempts).toBe("1/3");
    expect(result.events[2].attempts).toBe("2/3");
  });

  it("extracts status", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events[0].status).toBe("PASS");
    expect(result.events[2].status).toBe("FAIL");
  });

  it("preserves chronological order", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.events[0].order).toBe(0);
    expect(result.events[1].order).toBe(1);
    expect(result.events[2].order).toBe(2);
  });

  it("has no parse error for valid content", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.parseError).toBeNull();
  });

  it("has zero malformed entries for valid content", () => {
    const result = parseTaskLog(FULL_LOG);
    expect(result.malformedCount).toBe(0);
  });

  describe("summary statistics", () => {
    it("counts completed tasks", () => {
      const result = parseTaskLog(FULL_LOG);
      expect(result.summary.tasksCompleted).toBe(3);
    });

    it("counts passed tasks", () => {
      const result = parseTaskLog(FULL_LOG);
      expect(result.summary.tasksPassed).toBe(2);
    });

    it("counts failed tasks", () => {
      const result = parseTaskLog(FULL_LOG);
      expect(result.summary.tasksFailed).toBe(1);
    });

    it("computes total duration", () => {
      const result = parseTaskLog(FULL_LOG);
      // 45 + 32 + 83 = 160 seconds
      expect(result.summary.totalDurationSeconds).toBe(160);
      expect(result.summary.totalDuration).toBe("2m 40s");
    });

    it("computes average duration", () => {
      const result = parseTaskLog(FULL_LOG);
      // 160 / 3 = 53.33, rounded to 53
      expect(result.summary.averageDurationSeconds).toBe(53);
      expect(result.summary.averageDuration).toBe("53s");
    });

    it("counts running tasks from active tasks", () => {
      const result = parseTaskLog(FULL_LOG, [
        { id: "104", title: "Build service" },
        { id: "105", title: "Add validation" },
      ]);
      expect(result.summary.tasksRunning).toBe(2);
    });
  });

  describe("active tasks integration", () => {
    it("includes active tasks as started events", () => {
      const result = parseTaskLog(FULL_LOG, [
        { id: "104", title: "Build service" },
      ]);
      const startedEvents = result.events.filter((e) => e.type === "started");
      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0].taskId).toBe("104");
      expect(startedEvents[0].title).toBe("Build service");
    });

    it("does not duplicate completed tasks as started", () => {
      const result = parseTaskLog(FULL_LOG, [
        { id: "101", title: "Scaffold project" },
      ]);
      // Task 101 is already completed; should not appear as started
      const events101 = result.events.filter((e) => e.taskId === "101");
      expect(events101).toHaveLength(1);
      expect(events101[0].type).toBe("completed");
    });

    it("places started events after completed events", () => {
      const result = parseTaskLog(FULL_LOG, [
        { id: "104", title: "Build service" },
      ]);
      const lastCompleted = result.events.findIndex(
        (e) => e.type === "completed" || e.type === "failed",
      );
      const firstStarted = result.events.findIndex(
        (e) => e.type === "started",
      );
      expect(firstStarted).toBeGreaterThan(lastCompleted);
    });
  });

  describe("edge cases", () => {
    it("handles null content (task_log.md not yet created)", () => {
      const result = parseTaskLog(null);
      expect(result.events).toHaveLength(0);
      expect(result.summary.tasksCompleted).toBe(0);
      expect(result.parseError).toBeNull();
    });

    it("handles empty content", () => {
      const result = parseTaskLog("");
      expect(result.events).toHaveLength(0);
    });

    it("handles header-only content", () => {
      const content = `# Task Execution Log

| Task ID | Subject | Status | Attempts | Duration | Token Usage |
|---------|---------|--------|----------|----------|-------------|
`;
      const result = parseTaskLog(content);
      expect(result.events).toHaveLength(0);
      expect(result.summary.tasksCompleted).toBe(0);
    });

    it("handles many events (50+)", () => {
      let content = `# Task Execution Log

| Task ID | Subject | Status | Attempts | Duration | Token Usage |
|---------|---------|--------|----------|----------|-------------|
`;
      for (let i = 1; i <= 55; i++) {
        content += `| ${i} | Task ${i} | PASS | 1/3 | 30s | 10000 |\n`;
      }
      const result = parseTaskLog(content);
      expect(result.events).toHaveLength(55);
      expect(result.summary.tasksCompleted).toBe(55);
      expect(result.summary.totalDurationSeconds).toBe(55 * 30);
    });

    it("sorts events by row order even if table rows are unordered", () => {
      const content = `# Task Execution Log

| Task ID | Subject | Status | Attempts | Duration | Token Usage |
|---------|---------|--------|----------|----------|-------------|
| 105 | Later task | PASS | 1/3 | 20s | 5000 |
| 101 | Earlier task | PASS | 1/3 | 30s | 6000 |
`;
      const result = parseTaskLog(content);
      // Preserves table row order
      expect(result.events[0].taskId).toBe("105");
      expect(result.events[1].taskId).toBe("101");
    });

    it("handles rows with missing duration gracefully", () => {
      const content = `# Task Execution Log

| Task ID | Subject | Status | Attempts | Duration | Token Usage |
|---------|---------|--------|----------|----------|-------------|
| 101 | A task | PASS | 1/3 |  | 5000 |
`;
      const result = parseTaskLog(content);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].durationSeconds).toBeNull();
    });

    it("counts malformed entries", () => {
      const content = `# Task Execution Log

| Task ID | Subject | Status | Attempts | Duration | Token Usage |
|---------|---------|--------|----------|----------|-------------|
| 101 | Valid task | PASS | 1/3 | 45s | 12345 |
| this is garbage |
| 102 | Another valid | FAIL | 1/3 | 30s | 5000 |
`;
      const result = parseTaskLog(content);
      expect(result.events).toHaveLength(2);
      expect(result.malformedCount).toBe(1);
    });

    it("handles PARTIAL status as completed (not failed)", () => {
      const content = `# Task Execution Log

| Task ID | Subject | Status | Attempts | Duration | Token Usage |
|---------|---------|--------|----------|----------|-------------|
| 101 | Partial task | PARTIAL | 1/3 | 45s | 12345 |
`;
      const result = parseTaskLog(content);
      expect(result.events[0].type).toBe("completed");
      expect(result.events[0].status).toBe("PARTIAL");
    });

    it("handles only active tasks (no log content)", () => {
      const result = parseTaskLog(null, [
        { id: "101", title: "Running task" },
      ]);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("started");
      expect(result.summary.tasksRunning).toBe(1);
      expect(result.summary.tasksCompleted).toBe(0);
    });
  });
});
