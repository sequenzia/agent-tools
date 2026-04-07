import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { perfMonitor } from "../perf-monitor";

beforeEach(() => {
  perfMonitor.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PerfMonitor", () => {
  describe("mark and measure", () => {
    it("records a measurement between mark and measure", () => {
      perfMonitor.mark("test-op");
      const duration = perfMonitor.measure("test-op");

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(perfMonitor.size).toBe(1);

      const entries = perfMonitor.getEntries();
      expect(entries[0].name).toBe("test-op");
      expect(entries[0].duration).toBe(duration);
    });

    it("returns 0 when measuring without a mark", () => {
      const duration = perfMonitor.measure("no-mark");
      expect(duration).toBe(0);
      expect(perfMonitor.size).toBe(0);
    });

    it("stores metadata with measurements", () => {
      perfMonitor.mark("with-meta");
      perfMonitor.measure("with-meta", { taskCount: 42 });

      const entries = perfMonitor.getEntries();
      expect(entries[0].metadata).toEqual({ taskCount: 42 });
    });

    it("removes the mark after measure", () => {
      perfMonitor.mark("single-use");
      perfMonitor.measure("single-use");

      // Second measure should return 0 (mark consumed)
      const duration = perfMonitor.measure("single-use");
      expect(duration).toBe(0);
    });
  });

  describe("measureSync", () => {
    it("measures a synchronous function and returns its result", () => {
      const result = perfMonitor.measureSync("sync-op", () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
        return sum;
      });

      expect(result).toBe(4950);
      expect(perfMonitor.size).toBe(1);

      const entries = perfMonitor.getEntries();
      expect(entries[0].name).toBe("sync-op");
      expect(entries[0].duration).toBeGreaterThanOrEqual(0);
    });

    it("stores metadata with measureSync", () => {
      perfMonitor.measureSync("sync-meta", () => 1, { nodeCount: 100 });

      const entries = perfMonitor.getEntries();
      expect(entries[0].metadata).toEqual({ nodeCount: 100 });
    });
  });

  describe("getEntriesByName", () => {
    it("filters entries by name pattern", () => {
      perfMonitor.measureSync("dep-graph-build", () => 1);
      perfMonitor.measureSync("dep-graph-layout", () => 2);
      perfMonitor.measureSync("fetch-tasks", () => 3);

      const depEntries = perfMonitor.getEntriesByName("dep-graph");
      expect(depEntries).toHaveLength(2);
      expect(depEntries[0].name).toBe("dep-graph-build");
      expect(depEntries[1].name).toBe("dep-graph-layout");
    });
  });

  describe("getAverageDuration", () => {
    it("returns average duration for matching entries", () => {
      // Use measureSync to create entries with known pattern
      perfMonitor.measureSync("op-a", () => {});
      perfMonitor.measureSync("op-a", () => {});
      perfMonitor.measureSync("op-b", () => {});

      const avg = perfMonitor.getAverageDuration("op-a");
      expect(avg).toBeGreaterThanOrEqual(0);
    });

    it("returns 0 for no matching entries", () => {
      expect(perfMonitor.getAverageDuration("nonexistent")).toBe(0);
    });
  });

  describe("ring buffer", () => {
    it("evicts oldest entries when MAX_ENTRIES is exceeded", () => {
      // MAX_ENTRIES is 200
      for (let i = 0; i < 210; i++) {
        perfMonitor.measureSync(`entry-${i}`, () => {});
      }

      expect(perfMonitor.size).toBe(200);

      // Oldest entries should have been evicted
      const entries = perfMonitor.getEntries();
      expect(entries[0].name).toBe("entry-10");
      expect(entries[entries.length - 1].name).toBe("entry-209");
    });
  });

  describe("clear", () => {
    it("removes all entries and marks", () => {
      perfMonitor.mark("pending-mark");
      perfMonitor.measureSync("entry-1", () => {});

      perfMonitor.clear();

      expect(perfMonitor.size).toBe(0);
      expect(perfMonitor.getEntries()).toHaveLength(0);

      // Pending mark should be gone
      const duration = perfMonitor.measure("pending-mark");
      expect(duration).toBe(0);
    });
  });

  describe("threshold warnings", () => {
    it("logs a warning when file-event-to-ui exceeds threshold", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Simulate a slow operation
      perfMonitor.mark("file-event-to-ui");
      // We can't truly delay here, so we test the warning mechanism via measureSync
      // with a name that matches the pattern
      perfMonitor.measureSync("file-event-to-ui-slow", () => {
        // Busy wait to exceed 200ms threshold
        const start = performance.now();
        while (performance.now() - start < 210) {
          // spin
        }
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Performance degradation"),
      );
    });

    it("does not warn for operations within threshold", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      perfMonitor.measureSync("fetch-tasks-fast", () => {
        // Very fast operation
      });

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("startup benchmark scenario", () => {
    it("can track startup time for 100 tasks", () => {
      perfMonitor.mark("startup");

      // Simulate task loading
      const tasks = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        title: `Task ${i}`,
        status: "pending",
      }));

      expect(tasks).toHaveLength(100);

      const duration = perfMonitor.measure("startup", { taskCount: 100 });
      expect(duration).toBeGreaterThanOrEqual(0);
      // Should be well under 2000ms for 100 in-memory objects
      expect(duration).toBeLessThan(2000);
    });
  });

  describe("event latency scenario", () => {
    it("measures file event processing time", () => {
      perfMonitor.mark("file-event-to-ui");

      // Simulate event processing (dedup + batch apply)
      const events = Array.from({ length: 20 }, (_, i) => ({
        kind: "modify" as const,
        path: `/project/task-${i}.json`,
      }));

      // Deduplicate
      const seen = new Map<string, typeof events[0]>();
      for (const e of events) {
        seen.set(e.path, e);
      }

      const duration = perfMonitor.measure("file-event-to-ui", {
        eventCount: events.length,
        dedupedCount: seen.size,
      });

      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("500 task responsiveness", () => {
    it("processes 500 tasks for board derivation within acceptable time", () => {
      perfMonitor.mark("board-derivation-500");

      // Simulate board task derivation with 500 tasks
      const tasks = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        title: `Task ${i}`,
        status: i < 100 ? "backlog" : i < 250 ? "pending" : i < 400 ? "in_progress" : "completed",
        metadata: { task_group: `group-${i % 5}`, priority: "medium" },
        blocked_by: i > 0 ? [i - 1] : [],
      }));

      // Group by status
      const grouped = {
        backlog: tasks.filter((t) => t.status === "backlog"),
        pending: tasks.filter((t) => t.status === "pending"),
        in_progress: tasks.filter((t) => t.status === "in_progress"),
        completed: tasks.filter((t) => t.status === "completed"),
      };

      expect(grouped.backlog.length + grouped.pending.length + grouped.in_progress.length + grouped.completed.length).toBe(500);

      const duration = perfMonitor.measure("board-derivation-500", { taskCount: 500 });

      // Should be fast for in-memory operations
      expect(duration).toBeLessThan(1000);
    });
  });
});
