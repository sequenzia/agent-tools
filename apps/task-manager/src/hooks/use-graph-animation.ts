import { useRef, useEffect, useCallback, useState } from "react";
import type { WaveProgressState } from "./use-wave-progress";
import type { TaskStatus } from "../types";

/** Animation state for a single graph node. */
export interface NodeAnimationState {
  /** Previous status before the last transition. Null if no transition yet. */
  previousStatus: TaskStatus | "missing" | null;
  /** Whether this node is currently transitioning between statuses. */
  isTransitioning: boolean;
  /** Whether this node is actively executing (pulse effect). */
  isActive: boolean;
}

/** Complete animation state for the dependency graph. */
export interface GraphAnimationState {
  /** Per-node animation states, keyed by node ID. */
  nodeStates: Map<string, NodeAnimationState>;
  /** The wave number currently being executed (1-based). 0 = none. */
  activeWave: number;
  /** Set of wave indices (0-based) that are fully completed. */
  completedWaveIndices: Set<number>;
  /** IDs of nodes in the current active wave. */
  activeNodeIds: Set<string>;
  /** Whether animations are enabled (false = fallback to static). */
  animationsEnabled: boolean;
}

/** Duration of node status transition animation in ms. */
const TRANSITION_DURATION_MS = 600;

const EMPTY_STATE: GraphAnimationState = {
  nodeStates: new Map(),
  activeWave: 0,
  completedWaveIndices: new Set(),
  activeNodeIds: new Set(),
  animationsEnabled: true,
};

/**
 * Derives the active wave number (1-based) from wave progress state.
 * Returns 0 if no wave is active.
 */
function deriveActiveWave(waveProgress: WaveProgressState | null): number {
  if (!waveProgress?.progress) return 0;
  return waveProgress.progress.currentWave;
}

/**
 * Derives active node IDs from the wave progress state.
 * Active nodes are those with "running" status in the progress data.
 */
function deriveActiveNodeIds(waveProgress: WaveProgressState | null): Set<string> {
  const ids = new Set<string>();
  if (!waveProgress?.progress) return ids;

  for (const task of waveProgress.progress.activeTasks) {
    if (task.status === "running") {
      ids.add(task.id);
    }
  }
  return ids;
}

/**
 * Derives completed wave indices (0-based) from wave progress state.
 * A wave is completed when the current wave number exceeds its index + 1.
 */
function deriveCompletedWaveIndices(
  waveProgress: WaveProgressState | null,
  totalWaves: number,
): Set<number> {
  const completed = new Set<number>();
  if (!waveProgress?.progress) return completed;

  const currentWave = waveProgress.progress.currentWave;
  for (let i = 0; i < Math.min(currentWave - 1, totalWaves); i++) {
    completed.add(i);
  }
  return completed;
}

/**
 * Hook that tracks animation state for the dependency graph.
 *
 * Features:
 * - Tracks node status transitions for smooth color animations
 * - Identifies active wave and active nodes for pulse/glow effects
 * - Tracks completed waves for fading wave boundaries
 * - Batches rapid changes via requestAnimationFrame
 * - Catches up on tab focus by re-deriving state
 * - Falls back to static rendering on errors
 *
 * @param waveProgress - Current wave progress state from useWaveProgress, or null
 * @param nodeStatuses - Map of node ID to current status (from graph model)
 * @param totalWaves - Total number of waves in the graph
 */
export function useGraphAnimation(
  waveProgress: WaveProgressState | null,
  nodeStatuses: Map<string, TaskStatus | "missing">,
  totalWaves: number,
): GraphAnimationState {
  const [state, setState] = useState<GraphAnimationState>(EMPTY_STATE);

  // Previous node statuses for detecting transitions
  const prevStatusesRef = useRef<Map<string, TaskStatus | "missing">>(new Map());

  // Transition cleanup timers
  const transitionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // rAF batching
  const rafIdRef = useRef<number | null>(null);

  // Error tracking
  const errorRef = useRef(false);

  // Compute and apply new animation state from inputs
  const computeState = useCallback(() => {
    try {
      const activeWave = deriveActiveWave(waveProgress);
      const activeNodeIds = deriveActiveNodeIds(waveProgress);
      const completedWaveIndices = deriveCompletedWaveIndices(waveProgress, totalWaves);
      const prevStatuses = prevStatusesRef.current;

      setState((prev) => {
        const nodeStates = new Map<string, NodeAnimationState>();

        for (const [nodeId, currentStatus] of nodeStatuses.entries()) {
          const prevStatus = prevStatuses.get(nodeId) ?? null;
          const statusChanged = prevStatus !== null && prevStatus !== currentStatus;

          if (statusChanged) {
            // Clear existing transition timer
            const existing = transitionTimersRef.current.get(nodeId);
            if (existing) {
              clearTimeout(existing);
              transitionTimersRef.current.delete(nodeId);
            }

            nodeStates.set(nodeId, {
              previousStatus: prevStatus,
              isTransitioning: true,
              isActive: activeNodeIds.has(nodeId),
            });

            // Schedule transition end
            const timer = setTimeout(() => {
              setState((s) => {
                const current = s.nodeStates.get(nodeId);
                if (current?.isTransitioning) {
                  const updated = new Map(s.nodeStates);
                  updated.set(nodeId, { ...current, isTransitioning: false });
                  return { ...s, nodeStates: updated };
                }
                return s;
              });
              transitionTimersRef.current.delete(nodeId);
            }, TRANSITION_DURATION_MS);
            transitionTimersRef.current.set(nodeId, timer);
          } else {
            const wasTransitioning = prev.nodeStates.get(nodeId)?.isTransitioning ?? false;
            nodeStates.set(nodeId, {
              previousStatus: prevStatus,
              isTransitioning: wasTransitioning,
              isActive: activeNodeIds.has(nodeId),
            });
          }
        }

        prevStatusesRef.current = new Map(nodeStatuses);

        return {
          nodeStates,
          activeWave,
          completedWaveIndices,
          activeNodeIds,
          animationsEnabled: !errorRef.current,
        };
      });
    } catch {
      errorRef.current = true;
      setState((prev) => ({ ...prev, animationsEnabled: false }));
    }
  }, [waveProgress, nodeStatuses, totalWaves]);

  // Schedule update via rAF for batching rapid changes
  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      computeState();
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [computeState]);

  // Tab visibility catch-up
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        computeState();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [computeState]);

  // Cleanup transition timers on unmount
  useEffect(() => {
    const timers = transitionTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return state;
}

/**
 * Extracts a node ID -> status map from graph nodes for use with useGraphAnimation.
 */
export function buildNodeStatusMap(
  nodes: Array<{ id: string; status: TaskStatus | "missing" }>,
): Map<string, TaskStatus | "missing"> {
  const map = new Map<string, TaskStatus | "missing">();
  for (const node of nodes) {
    map.set(node.id, node.status);
  }
  return map;
}
