import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import {
  useGraphAnimation,
  buildNodeStatusMap,
} from "../use-graph-animation";
import type { WaveProgressState } from "../use-wave-progress";
import type { TaskStatus } from "../../types";

afterEach(() => {
  cleanup();
});

// --- Helpers ---

function makeWaveProgressState(overrides?: Partial<WaveProgressState>): WaveProgressState {
  return {
    progress: null,
    plan: null,
    completionPct: 0,
    totalTasks: 0,
    completedCount: 0,
    isLoading: false,
    isActive: false,
    error: null,
    ...overrides,
  };
}

function makeProgressData(overrides?: Record<string, unknown>) {
  return {
    executionStatus: "Executing",
    currentWave: 1,
    totalWaves: 3,
    maxParallel: 5,
    updatedAt: "2026-04-06T10:00:00Z",
    activeTasks: [],
    completedTasks: [],
    parseError: null,
    ...overrides,
  };
}

/**
 * Flush pending rAF-based updates by waiting for a microtask cycle.
 * The hook uses requestAnimationFrame for batching; in jsdom this
 * fires asynchronously so we need to let the event loop turn.
 */
async function flushAnimationFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

// --- buildNodeStatusMap ---

describe("buildNodeStatusMap", () => {
  it("builds a map from node array", () => {
    const nodes = [
      { id: "1", status: "pending" as TaskStatus | "missing" },
      { id: "2", status: "completed" as TaskStatus | "missing" },
      { id: "3", status: "in_progress" as TaskStatus | "missing" },
    ];

    const map = buildNodeStatusMap(nodes);
    expect(map.size).toBe(3);
    expect(map.get("1")).toBe("pending");
    expect(map.get("2")).toBe("completed");
    expect(map.get("3")).toBe("in_progress");
  });

  it("handles empty array", () => {
    const map = buildNodeStatusMap([]);
    expect(map.size).toBe(0);
  });

  it("handles missing status", () => {
    const nodes = [{ id: "1", status: "missing" as TaskStatus | "missing" }];
    const map = buildNodeStatusMap(nodes);
    expect(map.get("1")).toBe("missing");
  });
});

// --- useGraphAnimation ---

describe("useGraphAnimation", () => {
  it("returns default state when waveProgress is null", async () => {
    const nodeStatuses = new Map<string, TaskStatus | "missing">();

    const { result } = renderHook(() =>
      useGraphAnimation(null, nodeStatuses, 0),
    );

    await flushAnimationFrame();

    expect(result.current.activeWave).toBe(0);
    expect(result.current.activeNodeIds.size).toBe(0);
    expect(result.current.completedWaveIndices.size).toBe(0);
    expect(result.current.animationsEnabled).toBe(true);
  });

  it("derives active wave from progress data", async () => {
    const waveProgress = makeWaveProgressState({
      progress: makeProgressData({ currentWave: 2 }) as WaveProgressState["progress"],
      isActive: true,
    });
    const nodeStatuses = new Map<string, TaskStatus | "missing">([
      ["1", "completed"],
      ["2", "in_progress"],
    ]);

    const { result } = renderHook(() =>
      useGraphAnimation(waveProgress, nodeStatuses, 3),
    );

    await flushAnimationFrame();

    expect(result.current.activeWave).toBe(2);
  });

  it("derives active node IDs from running tasks", async () => {
    const waveProgress = makeWaveProgressState({
      progress: makeProgressData({
        currentWave: 1,
        activeTasks: [
          { id: "1", title: "Task 1", status: "running", detail: "" },
          { id: "2", title: "Task 2", status: "queued", detail: "" },
          { id: "3", title: "Task 3", status: "running", detail: "" },
        ],
      }) as WaveProgressState["progress"],
      isActive: true,
    });
    const nodeStatuses = new Map<string, TaskStatus | "missing">([
      ["1", "in_progress"],
      ["2", "pending"],
      ["3", "in_progress"],
    ]);

    const { result } = renderHook(() =>
      useGraphAnimation(waveProgress, nodeStatuses, 2),
    );

    await flushAnimationFrame();

    expect(result.current.activeNodeIds.has("1")).toBe(true);
    expect(result.current.activeNodeIds.has("2")).toBe(false);
    expect(result.current.activeNodeIds.has("3")).toBe(true);
  });

  it("derives completed wave indices", async () => {
    const waveProgress = makeWaveProgressState({
      progress: makeProgressData({ currentWave: 3 }) as WaveProgressState["progress"],
      isActive: true,
    });
    const nodeStatuses = new Map<string, TaskStatus | "missing">([
      ["1", "completed"],
      ["2", "completed"],
      ["3", "in_progress"],
    ]);

    const { result } = renderHook(() =>
      useGraphAnimation(waveProgress, nodeStatuses, 4),
    );

    await flushAnimationFrame();

    // Wave 3 is current, so waves 0 and 1 (indices) are completed
    expect(result.current.completedWaveIndices.has(0)).toBe(true);
    expect(result.current.completedWaveIndices.has(1)).toBe(true);
    expect(result.current.completedWaveIndices.has(2)).toBe(false);
  });

  it("detects node status transitions", async () => {
    const nodeStatuses1 = new Map<string, TaskStatus | "missing">([
      ["1", "pending"],
    ]);

    const { result, rerender } = renderHook(
      ({ statuses }) => useGraphAnimation(null, statuses, 1),
      { initialProps: { statuses: nodeStatuses1 } },
    );

    await flushAnimationFrame();

    // Initially no transition
    const initialState = result.current.nodeStates.get("1");
    expect(initialState?.isTransitioning).toBe(false);

    // Change status
    const nodeStatuses2 = new Map<string, TaskStatus | "missing">([
      ["1", "in_progress"],
    ]);
    rerender({ statuses: nodeStatuses2 });
    await flushAnimationFrame();

    const transitionState = result.current.nodeStates.get("1");
    expect(transitionState?.isTransitioning).toBe(true);
    expect(transitionState?.previousStatus).toBe("pending");
  });

  it("animations remain enabled in normal operation", async () => {
    const nodeStatuses = new Map<string, TaskStatus | "missing">([
      ["1", "pending"],
    ]);

    const { result } = renderHook(() =>
      useGraphAnimation(null, nodeStatuses, 1),
    );

    await flushAnimationFrame();

    expect(result.current.animationsEnabled).toBe(true);
  });

  it("handles fail to pending reverse transition", async () => {
    const nodeStatuses1 = new Map<string, TaskStatus | "missing">([
      ["1", "in_progress"],
    ]);

    const { result, rerender } = renderHook(
      ({ statuses }) => useGraphAnimation(null, statuses, 1),
      { initialProps: { statuses: nodeStatuses1 } },
    );

    await flushAnimationFrame();

    // Transition back to pending (reverse direction)
    const nodeStatuses2 = new Map<string, TaskStatus | "missing">([
      ["1", "pending"],
    ]);
    rerender({ statuses: nodeStatuses2 });
    await flushAnimationFrame();

    const nodeState = result.current.nodeStates.get("1");
    expect(nodeState?.isTransitioning).toBe(true);
    expect(nodeState?.previousStatus).toBe("in_progress");
  });
});

// --- Tab visibility catch-up ---

describe("useGraphAnimation - tab focus catch-up", () => {
  it("registers visibilitychange listener", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const nodeStatuses = new Map<string, TaskStatus | "missing">();

    renderHook(() => useGraphAnimation(null, nodeStatuses, 0));

    expect(addSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );

    addSpy.mockRestore();
  });

  it("removes visibilitychange listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const nodeStatuses = new Map<string, TaskStatus | "missing">();

    const { unmount } = renderHook(() =>
      useGraphAnimation(null, nodeStatuses, 0),
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );

    removeSpy.mockRestore();
  });
});
