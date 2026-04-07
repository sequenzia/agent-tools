/**
 * Performance monitoring utility for profiling critical paths.
 *
 * Tracks timing of key operations:
 * - file event -> store update -> UI render
 * - startup (fetchTasks -> first render)
 * - DnD feedback latency
 * - dependency graph computation
 *
 * Entries are stored in a bounded ring buffer to avoid unbounded memory growth.
 * When performance degrades beyond thresholds, a warning is logged to the console.
 */

/** A single performance measurement entry. */
export interface PerfEntry {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

/** Threshold configuration for performance warnings. */
interface PerfThresholds {
  /** Max ms for file event -> UI update (default: 200). */
  fileEventToUI: number;
  /** Max ms for startup task load (default: 2000). */
  startup: number;
  /** Max ms for DnD visual feedback (default: 50). */
  dndFeedback: number;
  /** Max ms for dependency graph computation (default: 1000). */
  depGraph: number;
}

const DEFAULT_THRESHOLDS: PerfThresholds = {
  fileEventToUI: 200,
  startup: 2000,
  dndFeedback: 50,
  depGraph: 1000,
};

const MAX_ENTRIES = 200;

class PerfMonitor {
  private entries: PerfEntry[] = [];
  private marks = new Map<string, number>();
  private thresholds: PerfThresholds;
  private enabled: boolean;

  constructor(thresholds?: Partial<PerfThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.enabled = typeof performance !== "undefined";
  }

  /** Start a named measurement. */
  mark(name: string): void {
    if (!this.enabled) return;
    this.marks.set(name, performance.now());
  }

  /** End a named measurement and record the result. Returns duration in ms. */
  measure(name: string, metadata?: Record<string, unknown>): number {
    if (!this.enabled) return 0;

    const startTime = this.marks.get(name);
    if (startTime === undefined) return 0;

    const duration = performance.now() - startTime;
    this.marks.delete(name);

    const entry: PerfEntry = { name, startTime, duration, metadata };

    // Ring buffer: evict oldest entries
    if (this.entries.length >= MAX_ENTRIES) {
      this.entries.shift();
    }
    this.entries.push(entry);

    // Check thresholds and warn on degradation
    this.checkThreshold(name, duration);

    return duration;
  }

  /** Measure a synchronous function and return its result. */
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    if (!this.enabled) return fn();

    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    const entry: PerfEntry = { name, startTime: start, duration, metadata };
    if (this.entries.length >= MAX_ENTRIES) {
      this.entries.shift();
    }
    this.entries.push(entry);

    this.checkThreshold(name, duration);

    return result;
  }

  /** Get all recorded entries. */
  getEntries(): readonly PerfEntry[] {
    return this.entries;
  }

  /** Get entries filtered by name pattern. */
  getEntriesByName(namePattern: string): PerfEntry[] {
    return this.entries.filter((e) => e.name.includes(namePattern));
  }

  /** Get the average duration for entries with a given name. */
  getAverageDuration(name: string): number {
    const matching = this.entries.filter((e) => e.name === name);
    if (matching.length === 0) return 0;
    const total = matching.reduce((sum, e) => sum + e.duration, 0);
    return total / matching.length;
  }

  /** Clear all entries and marks. */
  clear(): void {
    this.entries = [];
    this.marks.clear();
  }

  /** Get the total number of recorded entries. */
  get size(): number {
    return this.entries.length;
  }

  private checkThreshold(name: string, duration: number): void {
    const thresholdMap: Record<string, number> = {
      "file-event-to-ui": this.thresholds.fileEventToUI,
      "startup": this.thresholds.startup,
      "fetch-tasks": this.thresholds.startup,
      "dnd-feedback": this.thresholds.dndFeedback,
      "dep-graph": this.thresholds.depGraph,
      "full-dep-graph": this.thresholds.depGraph,
    };

    for (const [pattern, threshold] of Object.entries(thresholdMap)) {
      if (name.includes(pattern) && duration > threshold) {
        console.warn(
          `[PerfMonitor] Performance degradation: "${name}" took ${duration.toFixed(1)}ms (threshold: ${threshold}ms)`,
        );
        break;
      }
    }
  }
}

/** Singleton perf monitor instance for the application. */
export const perfMonitor = new PerfMonitor();
