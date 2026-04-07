import { useMemo, useCallback, memo } from "react";
import type { TaskWithPath, TasksByStatus } from "../services/task-service";
import type { TaskStatus } from "../types";
import { perfMonitor } from "../services/perf-monitor";

// --- Types ---

export interface DependencyGraphProps {
  /** The focused task to display the graph for. */
  task: TaskWithPath;
  /** All tasks grouped by status (for resolving dependencies). */
  allTasks: TasksByStatus;
  /** Called when a graph node is clicked. Receives the TaskWithPath if found. */
  onNodeClick?: (task: TaskWithPath | null, taskId: string) => void;
}

/** A node in the dependency graph. */
export interface GraphNode {
  id: string;
  title: string;
  status: TaskStatus | "missing";
  isFocused: boolean;
  taskWithPath: TaskWithPath | null;
}

/** A directed edge in the dependency graph. */
export interface GraphEdge {
  from: string;
  to: string;
  isCircular: boolean;
}

/** The full graph model. */
export interface DependencyGraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hasCircularDeps: boolean;
}

// --- Status colors for graph nodes ---

const NODE_STATUS_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  backlog: { fill: "#f3f4f6", stroke: "#9ca3af", text: "#374151" },
  pending: { fill: "#fef9c3", stroke: "#facc15", text: "#854d0e" },
  in_progress: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
  completed: { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  missing: { fill: "#fee2e2", stroke: "#ef4444", text: "#991b1b" },
};

const FOCUSED_STROKE_WIDTH = 3;
const NORMAL_STROKE_WIDTH = 1.5;

// --- Graph building ---

/**
 * Find a task across all status groups by ID.
 */
function findTaskById(
  taskId: string,
  allTasks: TasksByStatus,
): TaskWithPath | null {
  const statuses = ["backlog", "pending", "in_progress", "completed"] as const;
  for (const status of statuses) {
    for (const twp of allTasks[status]) {
      if (String(twp.task.id) === taskId) {
        return twp;
      }
    }
  }
  return null;
}

/**
 * Get all tasks that have the given task ID in their blocked_by array.
 */
function findDownstreamDependents(
  taskId: string,
  allTasks: TasksByStatus,
): TaskWithPath[] {
  const dependents: TaskWithPath[] = [];
  const statuses = ["backlog", "pending", "in_progress", "completed"] as const;
  for (const status of statuses) {
    for (const twp of allTasks[status]) {
      const blockedBy = twp.task.blocked_by;
      if (blockedBy && blockedBy.some((dep) => String(dep) === taskId)) {
        dependents.push(twp);
      }
    }
  }
  return dependents;
}

/**
 * Detect circular dependencies in the graph edges.
 * Returns the set of edge keys ("from->to") that form cycles.
 */
function detectCircularEdges(edges: GraphEdge[]): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const existing = adjacency.get(edge.from) ?? [];
    existing.push(edge.to);
    adjacency.set(edge.from, existing);
  }

  const circularEdgeKeys = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (inStack.has(node)) {
      // Found a cycle - mark all edges in the cycle
      const cycleStart = path.indexOf(node);
      for (let i = cycleStart; i < path.length; i++) {
        const from = path[i];
        const to = i + 1 < path.length ? path[i + 1] : node;
        circularEdgeKeys.add(`${from}->${to}`);
      }
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);

    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path, node]);
    }

    inStack.delete(node);
    return false;
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return circularEdgeKeys;
}

/**
 * Build the dependency graph model for a focused task.
 * Shows the focused task, its upstream blockers (blocked_by), and downstream dependents.
 */
export function buildDependencyGraph(
  task: TaskWithPath,
  allTasks: TasksByStatus,
): DependencyGraphModel {
  const focusedId = String(task.task.id);
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  // Add the focused task
  nodeMap.set(focusedId, {
    id: focusedId,
    title: task.task.title,
    status: task.task.status as TaskStatus,
    isFocused: true,
    taskWithPath: task,
  });

  // Add upstream blockers (blocked_by)
  const blockedBy = task.task.blocked_by ?? [];
  for (const depId of blockedBy) {
    const depIdStr = String(depId);
    if (!nodeMap.has(depIdStr)) {
      const found = findTaskById(depIdStr, allTasks);
      nodeMap.set(depIdStr, {
        id: depIdStr,
        title: found ? found.task.title : `Task ${depIdStr}`,
        status: found ? (found.task.status as TaskStatus) : "missing",
        isFocused: false,
        taskWithPath: found,
      });
    }
    // Edge: blocker -> focused task (blocker blocks the focused task)
    edges.push({ from: depIdStr, to: focusedId, isCircular: false });
  }

  // Add downstream dependents (tasks that have this task in their blocked_by)
  const dependents = findDownstreamDependents(focusedId, allTasks);
  for (const dep of dependents) {
    const depIdStr = String(dep.task.id);
    if (depIdStr === focusedId) continue;
    if (!nodeMap.has(depIdStr)) {
      nodeMap.set(depIdStr, {
        id: depIdStr,
        title: dep.task.title,
        status: dep.task.status as TaskStatus,
        isFocused: false,
        taskWithPath: dep,
      });
    }
    // Edge: focused task -> dependent (focused task blocks the dependent)
    edges.push({ from: focusedId, to: depIdStr, isCircular: false });
  }

  // Detect circular dependencies
  const circularEdgeKeys = detectCircularEdges(edges);
  let hasCircularDeps = false;
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    if (circularEdgeKeys.has(key)) {
      edge.isCircular = true;
      hasCircularDeps = true;
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    hasCircularDeps,
  };
}

// --- Layout calculation ---

interface LayoutNode {
  node: GraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutResult {
  nodes: LayoutNode[];
  svgWidth: number;
  svgHeight: number;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 44;
const H_GAP = 40;
const V_GAP = 24;
const PADDING = 20;

/**
 * Compute a simple 3-column layout: upstream | focused | downstream.
 * Upstream blockers on the left, focused task in center, dependents on the right.
 */
function computeLayout(graph: DependencyGraphModel): LayoutResult {
  const upstream: GraphNode[] = [];
  const downstream: GraphNode[] = [];
  let focused: GraphNode | null = null;

  for (const node of graph.nodes) {
    if (node.isFocused) {
      focused = node;
    } else if (graph.edges.some((e) => e.to === focused?.id && e.from === node.id)) {
      upstream.push(node);
    }
  }

  // Re-classify after focused is found
  if (focused) {
    for (const node of graph.nodes) {
      if (node.isFocused) continue;
      if (graph.edges.some((e) => e.from === focused!.id && e.to === node.id)) {
        downstream.push(node);
      }
    }
  }

  // Ensure upstream is correct (nodes not in downstream that point to focused)
  const downstreamIds = new Set(downstream.map((n) => n.id));
  for (const node of graph.nodes) {
    if (node.isFocused) continue;
    if (downstreamIds.has(node.id)) continue;
    if (!upstream.some((u) => u.id === node.id)) {
      // A node that's in the graph but not classified - put in upstream
      upstream.push(node);
    }
  }

  const columns: GraphNode[][] = [];
  if (upstream.length > 0) columns.push(upstream);
  columns.push(focused ? [focused] : []);
  if (downstream.length > 0) columns.push(downstream);

  const maxColumnHeight = Math.max(...columns.map((col) => col.length));
  const totalHeight = maxColumnHeight * (NODE_HEIGHT + V_GAP) - V_GAP + PADDING * 2;
  const totalWidth = columns.length * (NODE_WIDTH + H_GAP) - H_GAP + PADDING * 2;

  const layoutNodes: LayoutNode[] = [];

  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx];
    const colX = PADDING + colIdx * (NODE_WIDTH + H_GAP);
    const colTotalHeight = col.length * (NODE_HEIGHT + V_GAP) - V_GAP;
    const colStartY = (totalHeight - colTotalHeight) / 2;

    for (let rowIdx = 0; rowIdx < col.length; rowIdx++) {
      layoutNodes.push({
        node: col[rowIdx],
        x: colX,
        y: colStartY + rowIdx * (NODE_HEIGHT + V_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }
  }

  return {
    nodes: layoutNodes,
    svgWidth: Math.max(totalWidth, 200),
    svgHeight: Math.max(totalHeight, 100),
  };
}

// --- SVG Arrow Marker ---

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

// --- Truncate text helper ---

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}

// --- Main Component ---

export const DependencyGraph = memo(function DependencyGraph({
  task,
  allTasks,
  onNodeClick,
}: DependencyGraphProps) {
  const graph = useMemo(
    () => perfMonitor.measureSync("dep-graph-build", () => buildDependencyGraph(task, allTasks), { taskId: String(task.task.id) }),
    [task, allTasks],
  );

  const layout = useMemo(() => computeLayout(graph), [graph]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (onNodeClick) {
        onNodeClick(node.taskWithPath, node.id);
      }
    },
    [onNodeClick],
  );

  // No dependencies at all (only the focused node)
  if (graph.nodes.length <= 1) {
    return (
      <div
        className="py-3 text-center text-sm italic text-gray-400 dark:text-gray-500"
        data-testid="no-dependencies-graph"
      >
        No dependencies
      </div>
    );
  }

  // Build a node position lookup for drawing edges
  const nodePositions = new Map<string, LayoutNode>();
  for (const ln of layout.nodes) {
    nodePositions.set(ln.node.id, ln);
  }

  return (
    <div data-testid="dependency-graph">
      {graph.hasCircularDeps && (
        <div
          className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          data-testid="circular-dep-warning"
          role="alert"
        >
          Circular dependency detected
        </div>
      )}
      <div className="overflow-x-auto">
        <svg
          width={layout.svgWidth}
          height={layout.svgHeight}
          viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
          data-testid="dependency-graph-svg"
          role="img"
          aria-label="Dependency graph"
        >
          <defs>
            <ArrowMarker id="arrow-normal" color="#6b7280" />
            <ArrowMarker id="arrow-circular" color="#ef4444" />
          </defs>

          {/* Edges */}
          {graph.edges.map((edge) => {
            const fromNode = nodePositions.get(edge.from);
            const toNode = nodePositions.get(edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + fromNode.width;
            const y1 = fromNode.y + fromNode.height / 2;
            const x2 = toNode.x;
            const y2 = toNode.y + toNode.height / 2;

            const markerId = edge.isCircular ? "arrow-circular" : "arrow-normal";
            const strokeColor = edge.isCircular ? "#ef4444" : "#9ca3af";
            const strokeDash = edge.isCircular ? "4 3" : "none";

            return (
              <line
                key={`${edge.from}->${edge.to}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray={strokeDash}
                markerEnd={`url(#${markerId})`}
                data-testid={`edge-${edge.from}-${edge.to}`}
              />
            );
          })}

          {/* Nodes */}
          {layout.nodes.map((ln) => {
            const colors = NODE_STATUS_COLORS[ln.node.status] ?? NODE_STATUS_COLORS.missing;
            const strokeWidth = ln.node.isFocused
              ? FOCUSED_STROKE_WIDTH
              : NORMAL_STROKE_WIDTH;

            return (
              <g
                key={ln.node.id}
                data-testid={`graph-node-${ln.node.id}`}
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
              >
                <rect
                  x={ln.x}
                  y={ln.y}
                  width={ln.width}
                  height={ln.height}
                  rx={6}
                  ry={6}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={strokeWidth}
                />
                {/* Task ID label */}
                <text
                  x={ln.x + 8}
                  y={ln.y + 16}
                  fontSize={10}
                  fill={colors.text}
                  opacity={0.6}
                >
                  #{ln.node.id}
                  {ln.node.status === "missing" ? " (missing)" : ""}
                </text>
                {/* Task title */}
                <text
                  x={ln.x + 8}
                  y={ln.y + 32}
                  fontSize={11}
                  fontWeight={ln.node.isFocused ? "600" : "400"}
                  fill={colors.text}
                >
                  {truncateText(ln.node.title, 16)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
});
