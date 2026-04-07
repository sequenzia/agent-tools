import { useMemo, useCallback, useState, useRef, memo } from "react";
import type { TaskWithPath, TasksByStatus } from "../services/task-service";
import type { TaskStatus } from "../types";
import { perfMonitor } from "../services/perf-monitor";
import type { GraphAnimationState } from "../hooks/use-graph-animation";

// --- Types ---

export interface FullDependencyGraphProps {
  /** All tasks grouped by status. */
  allTasks: TasksByStatus;
  /** Called when a graph node is clicked. Receives the TaskWithPath if found. */
  onNodeClick?: (task: TaskWithPath | null, taskId: string) => void;
  /** Optional task group filter. When set, only tasks matching this group are included. */
  taskGroup?: string;
  /** Animation state from useGraphAnimation hook. When provided, enables animated transitions. */
  animationState?: GraphAnimationState;
}

/** A node in the full dependency graph. */
export interface FullGraphNode {
  id: string;
  title: string;
  status: TaskStatus | "missing";
  taskWithPath: TaskWithPath | null;
  wave: number;
  subgraphIndex: number;
}

/** Edge type for visual styling. */
export type EdgeType = "blocked_by" | "produces_for" | "circular";

/** A directed edge in the full dependency graph. */
export interface FullGraphEdge {
  from: string;
  to: string;
  edgeType: EdgeType;
}

/** The full graph model for the entire DAG. */
export interface FullDependencyGraphModel {
  nodes: FullGraphNode[];
  edges: FullGraphEdge[];
  waves: number[][];
  hasCircularDeps: boolean;
  circularNodeIds: Set<string>;
}

// --- Status colors for graph nodes ---

const NODE_STATUS_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  backlog: { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151" },
  pending: { fill: "#fef9c3", stroke: "#facc15", text: "#854d0e" },
  in_progress: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
  completed: { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  missing: { fill: "#fee2e2", stroke: "#ef4444", text: "#991b1b" },
};

// --- Layout constants ---

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;
const H_GAP = 60;
const V_GAP = 30;
const PADDING = 40;
const WAVE_LABEL_HEIGHT = 24;

// Large graph threshold for switching layout strategy
const HIERARCHICAL_THRESHOLD = 20;

// --- Helpers ---

/** Collect all tasks into a flat array, optionally filtered by task group. */
export function collectAllTasks(
  allTasks: TasksByStatus,
  taskGroup?: string,
): TaskWithPath[] {
  const statuses: TaskStatus[] = ["backlog", "pending", "in_progress", "completed"];
  const result: TaskWithPath[] = [];
  for (const status of statuses) {
    for (const twp of allTasks[status]) {
      if (taskGroup && twp.task.metadata?.task_group !== taskGroup) continue;
      result.push(twp);
    }
  }
  return result;
}

// --- Graph building ---

/**
 * Detect circular dependencies using DFS.
 * Returns set of node IDs that participate in cycles.
 */
function detectCircularNodes(
  adjacency: Map<string, string[]>,
): Set<string> {
  const circularIds = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      for (let i = cycleStart; i < path.length; i++) {
        circularIds.add(path[i]);
      }
      circularIds.add(node);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path, node]);
    }

    inStack.delete(node);
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return circularIds;
}

/**
 * Compute topological waves (levels) for all nodes.
 * Wave 0 = no dependencies, Wave 1 = depends only on Wave 0, etc.
 * Nodes in cycles are placed in wave -1 (handled separately).
 */
function computeWaves(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
  circularIds: Set<string>,
): { waveAssignment: Map<string, number>; waves: number[][] } {
  const waveAssignment = new Map<string, number>();

  // Build reverse adjacency (who blocks me)
  const inDegree = new Map<string, number>();
  const reverseDeps = new Map<string, Set<string>>();
  const nodeSet = new Set(nodeIds);

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    reverseDeps.set(id, new Set());
  }

  for (const [from, tos] of adjacency.entries()) {
    if (!nodeSet.has(from)) continue;
    for (const to of tos) {
      if (!nodeSet.has(to)) continue;
      if (circularIds.has(from) || circularIds.has(to)) continue;
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
      const rev = reverseDeps.get(to) ?? new Set();
      rev.add(from);
      reverseDeps.set(to, rev);
    }
  }

  // BFS-based topological level assignment
  const queue: string[] = [];
  for (const id of nodeIds) {
    if (circularIds.has(id)) {
      waveAssignment.set(id, -1);
      continue;
    }
    if ((inDegree.get(id) ?? 0) === 0) {
      waveAssignment.set(id, 0);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentWave = waveAssignment.get(current)!;

    // Find all nodes that current blocks
    for (const [target, deps] of reverseDeps.entries()) {
      if (deps.has(current)) {
        const newInDeg = (inDegree.get(target) ?? 1) - 1;
        inDegree.set(target, newInDeg);
        const existingWave = waveAssignment.get(target);
        const proposedWave = currentWave + 1;
        if (existingWave === undefined || proposedWave > existingWave) {
          waveAssignment.set(target, proposedWave);
        }
        if (newInDeg === 0) {
          queue.push(target);
        }
      }
    }
  }

  // Any non-circular node not yet assigned gets wave 0
  for (const id of nodeIds) {
    if (!waveAssignment.has(id)) {
      waveAssignment.set(id, 0);
    }
  }

  // Organize into wave arrays
  const maxWave = Math.max(0, ...Array.from(waveAssignment.values()).filter((w) => w >= 0));
  const waves: number[][] = [];
  for (let w = 0; w <= maxWave; w++) {
    const waveNodes: number[] = [];
    for (const [id, wave] of waveAssignment.entries()) {
      if (wave === w) waveNodes.push(Number(id));
    }
    if (waveNodes.length > 0) {
      waves.push(waveNodes);
    }
  }

  // Add circular nodes as a separate "wave" at the end
  const circularWave: number[] = [];
  for (const id of circularIds) {
    if (nodeSet.has(id)) circularWave.push(Number(id));
  }
  if (circularWave.length > 0) {
    waves.push(circularWave);
  }

  return { waveAssignment, waves };
}

/**
 * Find disconnected subgraphs using union-find.
 */
function findSubgraphs(
  nodeIds: string[],
  edges: FullGraphEdge[],
): Map<string, number> {
  const parent = new Map<string, string>();
  for (const id of nodeIds) {
    parent.set(id, id);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }

  for (const edge of edges) {
    if (nodeIds.includes(edge.from) && nodeIds.includes(edge.to)) {
      union(edge.from, edge.to);
    }
  }

  // Assign subgraph indices
  const rootToIndex = new Map<string, number>();
  const result = new Map<string, number>();
  let nextIndex = 0;

  for (const id of nodeIds) {
    const root = find(id);
    if (!rootToIndex.has(root)) {
      rootToIndex.set(root, nextIndex++);
    }
    result.set(id, rootToIndex.get(root)!);
  }

  return result;
}

/**
 * Build the full dependency graph model for all tasks.
 */
export function buildFullDependencyGraph(
  allTasks: TasksByStatus,
  taskGroup?: string,
): FullDependencyGraphModel {
  const tasks = collectAllTasks(allTasks, taskGroup);
  const nodeIds = tasks.map((t) => String(t.task.id));
  const nodeIdSet = new Set(nodeIds);
  const edges: FullGraphEdge[] = [];

  // Build adjacency (from blocker -> blocked task) for blocked_by edges
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) {
    adjacency.set(id, []);
  }

  for (const twp of tasks) {
    const taskId = String(twp.task.id);

    // blocked_by edges: blockerIds -> this task
    const blockedBy = twp.task.blocked_by ?? [];
    for (const depId of blockedBy) {
      const depIdStr = String(depId);
      if (nodeIdSet.has(depIdStr)) {
        edges.push({ from: depIdStr, to: taskId, edgeType: "blocked_by" });
        const existing = adjacency.get(depIdStr) ?? [];
        existing.push(taskId);
        adjacency.set(depIdStr, existing);
      }
    }

    // produces_for edges: this task -> downstream tasks
    const producesFor = twp.task.metadata?.produces_for ?? [];
    for (const downId of producesFor) {
      const downIdStr = String(downId);
      if (nodeIdSet.has(downIdStr)) {
        // Only add if not already a blocked_by edge
        const exists = edges.some(
          (e) => e.from === taskId && e.to === downIdStr && e.edgeType === "blocked_by",
        );
        if (!exists) {
          edges.push({ from: taskId, to: downIdStr, edgeType: "produces_for" });
        }
      }
    }
  }

  // Detect circular dependencies
  const circularIds = detectCircularNodes(adjacency);
  const hasCircularDeps = circularIds.size > 0;

  // Mark circular edges
  for (const edge of edges) {
    if (circularIds.has(edge.from) && circularIds.has(edge.to)) {
      edge.edgeType = "circular";
    }
  }

  // Compute waves
  const { waveAssignment, waves } = computeWaves(nodeIds, adjacency, circularIds);

  // Find disconnected subgraphs
  const subgraphMap = findSubgraphs(nodeIds, edges);

  // Build node objects
  const nodes: FullGraphNode[] = tasks.map((twp) => {
    const id = String(twp.task.id);
    return {
      id,
      title: twp.task.title,
      status: twp.task.status as TaskStatus,
      taskWithPath: twp,
      wave: waveAssignment.get(id) ?? 0,
      subgraphIndex: subgraphMap.get(id) ?? 0,
    };
  });

  return {
    nodes,
    edges,
    waves,
    hasCircularDeps,
    circularNodeIds: circularIds,
  };
}

// --- Layout ---

interface LayoutNode {
  node: FullGraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WaveBoundary {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface LayoutResult {
  nodes: LayoutNode[];
  waveBoundaries: WaveBoundary[];
  svgWidth: number;
  svgHeight: number;
}

/**
 * Simple force-directed layout for small graphs.
 * Uses iterative spring/repulsion simulation.
 */
function forceDirectedLayout(graph: FullDependencyGraphModel): LayoutResult {
  const n = graph.nodes.length;
  if (n === 0) return { nodes: [], waveBoundaries: [], svgWidth: 200, svgHeight: 100 };

  // Single node case
  if (n === 1) {
    return {
      nodes: [
        {
          node: graph.nodes[0],
          x: PADDING,
          y: PADDING + WAVE_LABEL_HEIGHT,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        },
      ],
      waveBoundaries: [
        {
          x: PADDING / 2,
          y: PADDING / 2,
          width: NODE_WIDTH + PADDING,
          height: NODE_HEIGHT + PADDING + WAVE_LABEL_HEIGHT,
          label: "Wave 1",
        },
      ],
      svgWidth: NODE_WIDTH + PADDING * 2,
      svgHeight: NODE_HEIGHT + PADDING * 2 + WAVE_LABEL_HEIGHT,
    };
  }

  // Initialize positions using wave as x-hint
  const positions: { x: number; y: number }[] = graph.nodes.map((node, i) => {
    const waveX = Math.max(0, node.wave) * (NODE_WIDTH + H_GAP * 2) + PADDING;
    const ySpread = (i % 5) * (NODE_HEIGHT + V_GAP);
    return { x: waveX + Math.random() * 20, y: ySpread + PADDING + WAVE_LABEL_HEIGHT };
  });

  const nodeIdToIndex = new Map<string, number>();
  graph.nodes.forEach((node, i) => nodeIdToIndex.set(node.id, i));

  // Run force simulation iterations
  const iterations = 50;
  const repulsion = 8000;
  const attraction = 0.005;
  const damping = 0.85;

  const velocities = positions.map(() => ({ x: 0, y: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const distSq = Math.max(dx * dx + dy * dy, 100);
        const force = repulsion / distSq;
        const dist = Math.sqrt(distSq);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        velocities[i].x += fx;
        velocities[i].y += fy;
        velocities[j].x -= fx;
        velocities[j].y -= fy;
      }
    }

    // Attraction along edges
    for (const edge of graph.edges) {
      const si = nodeIdToIndex.get(edge.from);
      const ti = nodeIdToIndex.get(edge.to);
      if (si === undefined || ti === undefined) continue;
      const dx = positions[ti].x - positions[si].x;
      const dy = positions[ti].y - positions[si].y;
      const fx = dx * attraction;
      const fy = dy * attraction;
      velocities[si].x += fx;
      velocities[si].y += fy;
      velocities[ti].x -= fx;
      velocities[ti].y -= fy;
    }

    // Wave ordering constraint: push nodes toward their wave column
    for (let i = 0; i < n; i++) {
      const targetX = Math.max(0, graph.nodes[i].wave) * (NODE_WIDTH + H_GAP * 2) + PADDING;
      velocities[i].x += (targetX - positions[i].x) * 0.1;
    }

    // Apply velocities with damping
    for (let i = 0; i < n; i++) {
      positions[i].x += velocities[i].x * damping;
      positions[i].y += velocities[i].y * damping;
      velocities[i].x *= damping;
      velocities[i].y *= damping;
    }
  }

  // Normalize positions to avoid negative values
  let minX = Infinity;
  let minY = Infinity;
  for (const pos of positions) {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
  }

  const offsetX = PADDING - minX;
  const offsetY = PADDING + WAVE_LABEL_HEIGHT - minY;
  for (const pos of positions) {
    pos.x += offsetX;
    pos.y += offsetY;
  }

  const layoutNodes: LayoutNode[] = graph.nodes.map((node, i) => ({
    node,
    x: positions[i].x,
    y: positions[i].y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }));

  // Compute wave boundaries
  const waveBoundaries = computeWaveBoundaries(layoutNodes, graph.waves);

  let maxX = 0;
  let maxY = 0;
  for (const ln of layoutNodes) {
    if (ln.x + ln.width > maxX) maxX = ln.x + ln.width;
    if (ln.y + ln.height > maxY) maxY = ln.y + ln.height;
  }

  return {
    nodes: layoutNodes,
    waveBoundaries,
    svgWidth: Math.max(maxX + PADDING, 200),
    svgHeight: Math.max(maxY + PADDING, 100),
  };
}

/**
 * Hierarchical layout for large graphs.
 * Nodes are placed in columns by wave, rows within each wave.
 */
function hierarchicalLayout(graph: FullDependencyGraphModel): LayoutResult {
  const n = graph.nodes.length;
  if (n === 0) return { nodes: [], waveBoundaries: [], svgWidth: 200, svgHeight: 100 };

  // Group nodes by wave
  const waveGroups = new Map<number, FullGraphNode[]>();
  for (const node of graph.nodes) {
    const w = Math.max(0, node.wave);
    const group = waveGroups.get(w) ?? [];
    group.push(node);
    waveGroups.set(w, group);
  }

  // Add circular nodes to a special wave at the end
  const circularNodes = graph.nodes.filter((n) => n.wave === -1);
  const maxRegularWave = Math.max(0, ...Array.from(waveGroups.keys()));
  if (circularNodes.length > 0) {
    waveGroups.set(maxRegularWave + 1, circularNodes);
  }

  const sortedWaves = Array.from(waveGroups.keys()).sort((a, b) => a - b);

  const layoutNodes: LayoutNode[] = [];
  let currentX = PADDING;

  for (const waveNum of sortedWaves) {
    const group = waveGroups.get(waveNum)!;
    const startY = PADDING + WAVE_LABEL_HEIGHT;

    for (let row = 0; row < group.length; row++) {
      layoutNodes.push({
        node: group[row],
        x: currentX,
        y: startY + row * (NODE_HEIGHT + V_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }

    currentX += NODE_WIDTH + H_GAP;
  }

  // Compute wave boundaries
  const waveBoundaries = computeWaveBoundaries(layoutNodes, graph.waves);

  let maxX = 0;
  let maxY = 0;
  for (const ln of layoutNodes) {
    if (ln.x + ln.width > maxX) maxX = ln.x + ln.width;
    if (ln.y + ln.height > maxY) maxY = ln.y + ln.height;
  }

  return {
    nodes: layoutNodes,
    waveBoundaries,
    svgWidth: Math.max(maxX + PADDING, 200),
    svgHeight: Math.max(maxY + PADDING, 100),
  };
}

/**
 * Compute wave boundary rectangles from layout positions.
 */
function computeWaveBoundaries(
  layoutNodes: LayoutNode[],
  waves: number[][],
): WaveBoundary[] {
  const boundaries: WaveBoundary[] = [];

  for (let wIdx = 0; wIdx < waves.length; wIdx++) {
    const waveNodeIds = new Set(waves[wIdx].map(String));
    const waveLayoutNodes = layoutNodes.filter((ln) => waveNodeIds.has(ln.node.id));

    if (waveLayoutNodes.length === 0) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const ln of waveLayoutNodes) {
      if (ln.x < minX) minX = ln.x;
      if (ln.y < minY) minY = ln.y;
      if (ln.x + ln.width > maxX) maxX = ln.x + ln.width;
      if (ln.y + ln.height > maxY) maxY = ln.y + ln.height;
    }

    const pad = 12;
    boundaries.push({
      x: minX - pad,
      y: minY - WAVE_LABEL_HEIGHT - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + WAVE_LABEL_HEIGHT + pad * 2,
      label: `Wave ${wIdx + 1}`,
    });
  }

  return boundaries;
}

/**
 * Choose and execute the appropriate layout strategy based on node count.
 */
export function computeFullLayout(graph: FullDependencyGraphModel): LayoutResult {
  if (graph.nodes.length >= HIERARCHICAL_THRESHOLD) {
    return hierarchicalLayout(graph);
  }
  return forceDirectedLayout(graph);
}

// --- SVG Helpers ---

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="6"
      markerHeight="6"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

// --- Edge styling ---

function getEdgeStyle(edgeType: EdgeType): {
  stroke: string;
  strokeDasharray: string;
  markerId: string;
} {
  switch (edgeType) {
    case "blocked_by":
      return { stroke: "#6b7280", strokeDasharray: "none", markerId: "arrow-blocked-by" };
    case "produces_for":
      return { stroke: "#8b5cf6", strokeDasharray: "6 4", markerId: "arrow-produces-for" };
    case "circular":
      return { stroke: "#ef4444", strokeDasharray: "4 3", markerId: "arrow-circular" };
  }
}

// --- Zoom/Pan state ---

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

// --- Fallback List View ---

function FallbackListView({
  allTasks,
  taskGroup,
  onNodeClick,
  error,
}: {
  allTasks: TasksByStatus;
  taskGroup?: string;
  onNodeClick?: (task: TaskWithPath | null, taskId: string) => void;
  error: string;
}) {
  const tasks = collectAllTasks(allTasks, taskGroup);

  return (
    <div data-testid="dependency-graph-fallback" className="p-4">
      <div
        className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        role="alert"
      >
        Graph rendering failed: {error}. Showing list view.
      </div>
      <ul className="space-y-1">
        {tasks.map((twp) => (
          <li key={String(twp.task.id)}>
            <button
              className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => onNodeClick?.(twp, String(twp.task.id))}
              data-testid={`fallback-task-${twp.task.id}`}
            >
              <span className="font-medium">#{String(twp.task.id)}</span>{" "}
              <span>{twp.task.title}</span>{" "}
              <span className="text-xs text-gray-500">({twp.task.status})</span>
            </button>
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="py-2 text-center text-sm italic text-gray-400">No tasks</li>
        )}
      </ul>
    </div>
  );
}

// --- Main Component ---

export const FullDependencyGraph = memo(function FullDependencyGraph({
  allTasks,
  onNodeClick,
  taskGroup,
  animationState,
}: FullDependencyGraphProps) {
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const [isPanningState, setIsPanningState] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Build graph model — derive error during render instead of setState in useMemo
  const graphResult = useMemo<{ graph: FullDependencyGraphModel | null; error: string | null }>(() => {
    try {
      const graph = perfMonitor.measureSync("full-dep-graph-build", () => buildFullDependencyGraph(allTasks, taskGroup), { taskGroup });
      return { graph, error: null };
    } catch (err) {
      return { graph: null, error: err instanceof Error ? err.message : "Unknown error building graph" };
    }
  }, [allTasks, taskGroup]);

  const layoutResult = useMemo<{ layout: LayoutResult | null; error: string | null }>(() => {
    if (!graphResult.graph) return { layout: null, error: null };
    try {
      const layout = perfMonitor.measureSync("full-dep-graph-layout", () => computeFullLayout(graphResult.graph!), { nodeCount: graphResult.graph.nodes.length });
      return { layout, error: null };
    } catch (err) {
      return { layout: null, error: err instanceof Error ? err.message : "Unknown error computing layout" };
    }
  }, [graphResult.graph]);

  const graph = graphResult.graph;
  const layout = layoutResult.layout;
  const renderError = graphResult.error ?? layoutResult.error;

  const handleNodeClick = useCallback(
    (node: FullGraphNode) => {
      if (onNodeClick) {
        onNodeClick(node.taskWithPath, node.id);
      }
    },
    [onNodeClick],
  );

  // Zoom handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((prev) => {
        const newScale = Math.max(0.1, Math.min(3, prev.scale * scaleChange));
        // Zoom toward mouse position
        const rect = svgContainerRef.current?.getBoundingClientRect();
        if (!rect) return { ...prev, scale: newScale };
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const newX = mx - ((mx - prev.x) / prev.scale) * newScale;
        const newY = my - ((my - prev.y) / prev.scale) * newScale;
        return { x: newX, y: newY, scale: newScale };
      });
    },
    [],
  );

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Only pan if clicking on the SVG background, not on a node
      const target = e.target as SVGElement;
      if (target.closest("[data-node-group]")) return;
      isPanning.current = true;
      setIsPanningState(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    },
    [transform],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTransform((prev) => ({
        ...prev,
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
      }));
    },
    [],
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setIsPanningState(false);
  }, []);

  // Fallback on error
  if (renderError || !graph || !layout) {
    return (
      <FallbackListView
        allTasks={allTasks}
        taskGroup={taskGroup}
        onNodeClick={onNodeClick}
        error={renderError ?? "Failed to build graph"}
      />
    );
  }

  // Empty state
  if (graph.nodes.length === 0) {
    return (
      <div
        className="py-6 text-center text-sm italic text-gray-400 dark:text-gray-500"
        data-testid="full-graph-empty"
      >
        No tasks to display
      </div>
    );
  }

  // Build node position lookup for edge drawing
  const nodePositions = new Map<string, LayoutNode>();
  for (const ln of layout.nodes) {
    nodePositions.set(ln.node.id, ln);
  }

  const isLargeGraph = graph.nodes.length >= HIERARCHICAL_THRESHOLD;

  return (
    <div data-testid="full-dependency-graph">
      {graph.hasCircularDeps && (
        <div
          className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          data-testid="full-graph-circular-warning"
          role="alert"
        >
          Circular dependency detected
        </div>
      )}

      {/* Legend */}
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400" data-testid="graph-legend">
        <span className="flex items-center gap-1">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#6b7280" strokeWidth="2" /></svg>
          blocked_by
        </span>
        <span className="flex items-center gap-1">
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="6 4" /></svg>
          produces_for
        </span>
        {graph.hasCircularDeps && (
          <span className="flex items-center gap-1">
            <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 3" /></svg>
            circular
          </span>
        )}
        <span className="ml-auto text-gray-400">
          {isLargeGraph ? "Hierarchical layout" : "Force-directed layout"} ({graph.nodes.length} nodes)
        </span>
      </div>

      {/* Graph container with zoom/pan */}
      <div
        ref={svgContainerRef}
        className="overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        style={{ cursor: isPanningState ? "grabbing" : "grab" }}
        data-testid="graph-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height={Math.min(layout.svgHeight * transform.scale + 40, 600)}
          data-testid="full-dependency-graph-svg"
          role="img"
          aria-label={`Full dependency graph with ${graph.nodes.length} tasks`}
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            <defs>
              <ArrowMarker id="arrow-blocked-by" color="#6b7280" />
              <ArrowMarker id="arrow-produces-for" color="#8b5cf6" />
              <ArrowMarker id="arrow-circular" color="#ef4444" />
              {/* Glow filter for active wave nodes */}
              <filter id="glow-active" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Wave boundaries */}
            {layout.waveBoundaries.map((wb, i) => {
              const isAnimated = animationState?.animationsEnabled ?? false;
              const isCompletedWave = isAnimated && (animationState?.completedWaveIndices.has(i) ?? false);
              const isActiveWave = isAnimated && animationState?.activeWave === i + 1;
              const waveBorderStroke = isActiveWave ? "#3b82f6" : "#e5e7eb";
              const waveBorderWidth = isActiveWave ? 2 : 1;
              const waveOpacity = isCompletedWave ? 0.35 : 1;
              const waveFill = isActiveWave ? "rgba(59, 130, 246, 0.04)" : "none";

              return (
                <g
                  key={`wave-${i}`}
                  data-testid={`wave-boundary-${i}`}
                  data-wave-active={isActiveWave ? "true" : undefined}
                  data-wave-completed={isCompletedWave ? "true" : undefined}
                  style={{
                    opacity: waveOpacity,
                    transition: isAnimated ? "opacity 600ms ease-in-out" : undefined,
                  }}
                >
                  <rect
                    x={wb.x}
                    y={wb.y}
                    width={wb.width}
                    height={wb.height}
                    rx={8}
                    ry={8}
                    fill={waveFill}
                    stroke={waveBorderStroke}
                    strokeWidth={waveBorderWidth}
                    strokeDasharray="8 4"
                    style={{
                      transition: isAnimated
                        ? "stroke 400ms ease-in-out, stroke-width 400ms ease-in-out, fill 400ms ease-in-out"
                        : undefined,
                    }}
                  />
                  <text
                    x={wb.x + 8}
                    y={wb.y + 14}
                    fontSize={11}
                    fontWeight="600"
                    fill={isActiveWave ? "#3b82f6" : "#9ca3af"}
                    style={{
                      transition: isAnimated ? "fill 400ms ease-in-out" : undefined,
                    }}
                  >
                    {wb.label}
                  </text>
                </g>
              );
            })}

            {/* Edges */}
            {graph.edges.map((edge) => {
              const fromNode = nodePositions.get(edge.from);
              const toNode = nodePositions.get(edge.to);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.x + fromNode.width;
              const y1 = fromNode.y + fromNode.height / 2;
              const x2 = toNode.x;
              const y2 = toNode.y + toNode.height / 2;

              const style = getEdgeStyle(edge.edgeType);

              return (
                <line
                  key={`${edge.from}->${edge.to}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={style.stroke}
                  strokeWidth={1.5}
                  strokeDasharray={style.strokeDasharray}
                  markerEnd={`url(#${style.markerId})`}
                  data-testid={`full-edge-${edge.from}-${edge.to}`}
                  data-edge-type={edge.edgeType}
                />
              );
            })}

            {/* Nodes */}
            {layout.nodes.map((ln) => {
              const colors = NODE_STATUS_COLORS[ln.node.status] ?? NODE_STATUS_COLORS.missing;
              const isCircular = graph.circularNodeIds.has(ln.node.id);
              const isAnimated = animationState?.animationsEnabled ?? false;
              const nodeAnim = isAnimated ? animationState?.nodeStates.get(ln.node.id) : undefined;
              const isNodeActive = isAnimated && (nodeAnim?.isActive ?? false);
              const isNodeTransitioning = isAnimated && (nodeAnim?.isTransitioning ?? false);
              const nodeStroke = isCircular ? "#ef4444" : colors.stroke;
              const nodeStrokeWidth = isCircular ? 2.5 : isNodeActive ? 2.5 : 1.5;

              return (
                <g
                  key={ln.node.id}
                  data-testid={`full-graph-node-${ln.node.id}`}
                  data-node-group="true"
                  data-node-active={isNodeActive ? "true" : undefined}
                  data-node-transitioning={isNodeTransitioning ? "true" : undefined}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(ln.node)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Task #${ln.node.id}: ${ln.node.title} (${ln.node.status})`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNodeClick(ln.node);
                    }
                  }}
                  filter={isNodeActive ? "url(#glow-active)" : undefined}
                >
                  <rect
                    x={ln.x}
                    y={ln.y}
                    width={ln.width}
                    height={ln.height}
                    rx={6}
                    ry={6}
                    fill={colors.fill}
                    stroke={nodeStroke}
                    strokeWidth={nodeStrokeWidth}
                    style={{
                      transition: isAnimated
                        ? "fill 600ms ease-in-out, stroke 600ms ease-in-out, stroke-width 300ms ease-in-out"
                        : undefined,
                    }}
                  >
                    {/* Pulse animation for active nodes */}
                    {isNodeActive && (
                      <animate
                        attributeName="stroke-opacity"
                        values="1;0.4;1"
                        dur="2s"
                        repeatCount="indefinite"
                        data-testid={`pulse-${ln.node.id}`}
                      />
                    )}
                  </rect>
                  {/* Task ID label */}
                  <text
                    x={ln.x + 8}
                    y={ln.y + 16}
                    fontSize={10}
                    fill={colors.text}
                    opacity={0.6}
                    style={{
                      transition: isAnimated ? "fill 600ms ease-in-out" : undefined,
                    }}
                  >
                    #{ln.node.id}
                  </text>
                  {/* Task title */}
                  <text
                    x={ln.x + 8}
                    y={ln.y + 34}
                    fontSize={11}
                    fontWeight="400"
                    fill={colors.text}
                    style={{
                      transition: isAnimated ? "fill 600ms ease-in-out" : undefined,
                    }}
                  >
                    {truncateText(ln.node.title, 18)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Zoom controls */}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400" data-testid="zoom-controls">
        <button
          className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(3, prev.scale * 1.2),
            }))
          }
          aria-label="Zoom in"
          data-testid="zoom-in"
        >
          +
        </button>
        <button
          className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.max(0.1, prev.scale * 0.8),
            }))
          }
          aria-label="Zoom out"
          data-testid="zoom-out"
        >
          -
        </button>
        <button
          className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          aria-label="Reset zoom"
          data-testid="zoom-reset"
        >
          Reset
        </button>
        <span>{Math.round(transform.scale * 100)}%</span>
      </div>
    </div>
  );
});
