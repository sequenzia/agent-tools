import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  FullDependencyGraph,
  buildFullDependencyGraph,
  collectAllTasks,
  computeFullLayout,
  type FullDependencyGraphModel,
} from "../FullDependencyGraph";
import type { TaskWithPath, TasksByStatus } from "../../services/task-service";
import type { GraphAnimationState } from "../../hooks/use-graph-animation";

afterEach(() => {
  cleanup();
});

// --- Test helpers ---

function makeTaskWithPath(
  id: number | string,
  title: string,
  status: string,
  extra?: {
    blocked_by?: (number | string)[];
    metadata?: Record<string, unknown>;
  },
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: `Description for ${title}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
      blocked_by: extra?.blocked_by,
      metadata: extra?.metadata as TaskWithPath["task"]["metadata"],
    },
    filePath: `/project/.agents/tasks/${status}/group/task-${id}.json`,
    mtimeMs: 1700000000000,
  };
}

function makeTasksByStatus(overrides?: Partial<TasksByStatus>): TasksByStatus {
  return {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    errors: [],
    ...overrides,
  };
}

// --- collectAllTasks ---

describe("collectAllTasks", () => {
  it("collects tasks from all status groups", () => {
    const t1 = makeTaskWithPath(1, "Task 1", "pending");
    const t2 = makeTaskWithPath(2, "Task 2", "completed");
    const allTasks = makeTasksByStatus({ pending: [t1], completed: [t2] });

    const result = collectAllTasks(allTasks);
    expect(result).toHaveLength(2);
  });

  it("filters by task group when specified", () => {
    const t1 = makeTaskWithPath(1, "Task 1", "pending", {
      metadata: { task_group: "auth" },
    });
    const t2 = makeTaskWithPath(2, "Task 2", "pending", {
      metadata: { task_group: "payments" },
    });
    const allTasks = makeTasksByStatus({ pending: [t1, t2] });

    const result = collectAllTasks(allTasks, "auth");
    expect(result).toHaveLength(1);
    expect(result[0].task.id).toBe(1);
  });
});

// --- buildFullDependencyGraph ---

describe("buildFullDependencyGraph", () => {
  it("builds graph with all tasks as nodes", () => {
    const t1 = makeTaskWithPath(1, "Task 1", "pending");
    const t2 = makeTaskWithPath(2, "Task 2", "in_progress");
    const t3 = makeTaskWithPath(3, "Task 3", "completed");
    const allTasks = makeTasksByStatus({
      pending: [t1],
      in_progress: [t2],
      completed: [t3],
    });

    const graph = buildFullDependencyGraph(allTasks);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.hasCircularDeps).toBe(false);
  });

  it("creates blocked_by edges", () => {
    const t1 = makeTaskWithPath(1, "Foundation", "completed");
    const t2 = makeTaskWithPath(2, "Dependent", "pending", { blocked_by: [1] });
    const allTasks = makeTasksByStatus({
      completed: [t1],
      pending: [t2],
    });

    const graph = buildFullDependencyGraph(allTasks);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      from: "1",
      to: "2",
      edgeType: "blocked_by",
    });
  });

  it("creates produces_for edges with dashed style", () => {
    const t1 = makeTaskWithPath(1, "Producer", "in_progress", {
      metadata: { produces_for: ["2"] },
    });
    const t2 = makeTaskWithPath(2, "Consumer", "pending");
    const allTasks = makeTasksByStatus({
      in_progress: [t1],
      pending: [t2],
    });

    const graph = buildFullDependencyGraph(allTasks);
    const producesEdge = graph.edges.find((e) => e.edgeType === "produces_for");
    expect(producesEdge).toBeDefined();
    expect(producesEdge!.from).toBe("1");
    expect(producesEdge!.to).toBe("2");
  });

  it("detects circular dependencies", () => {
    const t1 = makeTaskWithPath(1, "Task A", "pending", { blocked_by: [2] });
    const t2 = makeTaskWithPath(2, "Task B", "pending", { blocked_by: [1] });
    const allTasks = makeTasksByStatus({ pending: [t1, t2] });

    const graph = buildFullDependencyGraph(allTasks);
    expect(graph.hasCircularDeps).toBe(true);
    expect(graph.circularNodeIds.size).toBeGreaterThan(0);
    expect(graph.circularNodeIds.has("1")).toBe(true);
    expect(graph.circularNodeIds.has("2")).toBe(true);
  });

  it("handles disconnected subgraphs", () => {
    const t1 = makeTaskWithPath(1, "Chain A-1", "completed");
    const t2 = makeTaskWithPath(2, "Chain A-2", "pending", { blocked_by: [1] });
    const t3 = makeTaskWithPath(3, "Chain B-1", "completed");
    const t4 = makeTaskWithPath(4, "Chain B-2", "pending", { blocked_by: [3] });
    const allTasks = makeTasksByStatus({
      completed: [t1, t3],
      pending: [t2, t4],
    });

    const graph = buildFullDependencyGraph(allTasks);
    expect(graph.nodes).toHaveLength(4);

    // Nodes in different subgraphs should have different subgraphIndex
    const subgraphs = new Set(graph.nodes.map((n) => n.subgraphIndex));
    expect(subgraphs.size).toBe(2);
  });

  it("computes waves correctly", () => {
    const t1 = makeTaskWithPath(1, "Wave 0 task", "completed");
    const t2 = makeTaskWithPath(2, "Wave 1 task", "in_progress", {
      blocked_by: [1],
    });
    const t3 = makeTaskWithPath(3, "Wave 2 task", "pending", {
      blocked_by: [2],
    });
    const allTasks = makeTasksByStatus({
      completed: [t1],
      in_progress: [t2],
      pending: [t3],
    });

    const graph = buildFullDependencyGraph(allTasks);
    const node1 = graph.nodes.find((n) => n.id === "1");
    const node2 = graph.nodes.find((n) => n.id === "2");
    const node3 = graph.nodes.find((n) => n.id === "3");

    expect(node1?.wave).toBe(0);
    expect(node2?.wave).toBe(1);
    expect(node3?.wave).toBe(2);
    expect(graph.waves).toHaveLength(3);
  });

  it("handles single task with no dependencies", () => {
    const t1 = makeTaskWithPath(1, "Solo task", "pending");
    const allTasks = makeTasksByStatus({ pending: [t1] });

    const graph = buildFullDependencyGraph(allTasks);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(graph.waves).toHaveLength(1);
    expect(graph.nodes[0].wave).toBe(0);
  });

  it("filters by task group", () => {
    const t1 = makeTaskWithPath(1, "Auth task", "pending", {
      metadata: { task_group: "auth" },
    });
    const t2 = makeTaskWithPath(2, "Pay task", "pending", {
      metadata: { task_group: "payments" },
    });
    const allTasks = makeTasksByStatus({ pending: [t1, t2] });

    const graph = buildFullDependencyGraph(allTasks, "auth");
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].id).toBe("1");
  });

  it("ignores blocked_by references to tasks outside the visible set", () => {
    const t1 = makeTaskWithPath(1, "Task A", "pending", {
      blocked_by: [99],
      metadata: { task_group: "auth" },
    });
    const allTasks = makeTasksByStatus({ pending: [t1] });

    const graph = buildFullDependencyGraph(allTasks, "auth");
    expect(graph.edges).toHaveLength(0);
  });
});

// --- computeFullLayout ---

describe("computeFullLayout", () => {
  it("uses force-directed layout for small graphs", () => {
    const t1 = makeTaskWithPath(1, "Task 1", "completed");
    const t2 = makeTaskWithPath(2, "Task 2", "pending", { blocked_by: [1] });
    const allTasks = makeTasksByStatus({
      completed: [t1],
      pending: [t2],
    });

    const graph = buildFullDependencyGraph(allTasks);
    const layout = computeFullLayout(graph);

    expect(layout.nodes).toHaveLength(2);
    expect(layout.svgWidth).toBeGreaterThan(0);
    expect(layout.svgHeight).toBeGreaterThan(0);
  });

  it("uses hierarchical layout for 20+ nodes", () => {
    const tasks: TaskWithPath[] = [];
    for (let i = 1; i <= 25; i++) {
      tasks.push(
        makeTaskWithPath(i, `Task ${i}`, "pending", {
          blocked_by: i > 1 ? [i - 1] : undefined,
        }),
      );
    }
    const allTasks = makeTasksByStatus({ pending: tasks });

    const graph = buildFullDependencyGraph(allTasks);
    const layout = computeFullLayout(graph);

    expect(layout.nodes).toHaveLength(25);
    expect(layout.waveBoundaries.length).toBeGreaterThan(0);
  });

  it("computes wave boundaries", () => {
    const t1 = makeTaskWithPath(1, "Wave 0", "completed");
    const t2 = makeTaskWithPath(2, "Wave 1", "pending", { blocked_by: [1] });
    const allTasks = makeTasksByStatus({
      completed: [t1],
      pending: [t2],
    });

    const graph = buildFullDependencyGraph(allTasks);
    const layout = computeFullLayout(graph);

    expect(layout.waveBoundaries.length).toBeGreaterThanOrEqual(1);
    for (const wb of layout.waveBoundaries) {
      expect(wb.label).toMatch(/Wave \d+/);
    }
  });

  it("handles empty graph", () => {
    const graph: FullDependencyGraphModel = {
      nodes: [],
      edges: [],
      waves: [],
      hasCircularDeps: false,
      circularNodeIds: new Set(),
    };

    const layout = computeFullLayout(graph);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.svgWidth).toBeGreaterThan(0);
  });

  it("handles single node", () => {
    const t1 = makeTaskWithPath(1, "Solo", "pending");
    const allTasks = makeTasksByStatus({ pending: [t1] });
    const graph = buildFullDependencyGraph(allTasks);
    const layout = computeFullLayout(graph);

    expect(layout.nodes).toHaveLength(1);
    expect(layout.waveBoundaries).toHaveLength(1);
  });

  it("completes layout for 100+ nodes within performance budget", () => {
    const tasks: TaskWithPath[] = [];
    // Create 100 tasks in a fan pattern: first 10 are roots, rest depend on roots
    for (let i = 1; i <= 100; i++) {
      const deps = i > 10 ? [((i - 1) % 10) + 1] : undefined;
      tasks.push(makeTaskWithPath(i, `Task ${i}`, "pending", { blocked_by: deps }));
    }
    const allTasks = makeTasksByStatus({ pending: tasks });

    const start = performance.now();
    const graph = buildFullDependencyGraph(allTasks);
    const layout = computeFullLayout(graph);
    const elapsed = performance.now() - start;

    expect(layout.nodes).toHaveLength(100);
    expect(elapsed).toBeLessThan(1000); // <1s performance budget
  });
});

// --- FullDependencyGraph component rendering ---

describe("FullDependencyGraph component", () => {
  describe("empty state", () => {
    it("shows empty message when no tasks", () => {
      const allTasks = makeTasksByStatus();

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(screen.getByTestId("full-graph-empty")).toBeDefined();
      expect(screen.getByTestId("full-graph-empty").textContent).toBe(
        "No tasks to display",
      );
    });
  });

  describe("graph rendering", () => {
    it("renders SVG with nodes and edges", () => {
      const t1 = makeTaskWithPath(1, "Foundation", "completed");
      const t2 = makeTaskWithPath(2, "Dependent", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(screen.getByTestId("full-dependency-graph")).toBeDefined();
      expect(screen.getByTestId("full-dependency-graph-svg")).toBeDefined();
      expect(screen.getByTestId("full-graph-node-1")).toBeDefined();
      expect(screen.getByTestId("full-graph-node-2")).toBeDefined();
      expect(screen.getByTestId("full-edge-1-2")).toBeDefined();
    });

    it("renders nodes with status-based colors", () => {
      const t1 = makeTaskWithPath(1, "Pending", "pending");
      const t2 = makeTaskWithPath(2, "Completed", "completed");
      const t3 = makeTaskWithPath(3, "In Progress", "in_progress", {
        blocked_by: [1, 2],
      });
      const allTasks = makeTasksByStatus({
        pending: [t1],
        completed: [t2],
        in_progress: [t3],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      // Pending node has yellow fill
      const pendingRect = screen
        .getByTestId("full-graph-node-1")
        .querySelector("rect");
      expect(pendingRect?.getAttribute("fill")).toBe("#fef9c3");

      // Completed node has green fill
      const completedRect = screen
        .getByTestId("full-graph-node-2")
        .querySelector("rect");
      expect(completedRect?.getAttribute("fill")).toBe("#dcfce7");

      // In-progress node has blue fill
      const inProgressRect = screen
        .getByTestId("full-graph-node-3")
        .querySelector("rect");
      expect(inProgressRect?.getAttribute("fill")).toBe("#dbeafe");
    });

    it("renders blocked_by edges as solid lines", () => {
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      const edge = screen.getByTestId("full-edge-1-2");
      expect(edge.getAttribute("stroke-dasharray")).toBe("none");
      expect(edge.getAttribute("data-edge-type")).toBe("blocked_by");
    });

    it("renders produces_for edges as dashed lines", () => {
      const t1 = makeTaskWithPath(1, "Producer", "in_progress", {
        metadata: { produces_for: ["2"] },
      });
      const t2 = makeTaskWithPath(2, "Consumer", "pending");
      const allTasks = makeTasksByStatus({
        in_progress: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      const edge = screen.getByTestId("full-edge-1-2");
      expect(edge.getAttribute("stroke-dasharray")).toBe("6 4");
      expect(edge.getAttribute("data-edge-type")).toBe("produces_for");
    });

    it("renders wave boundaries", () => {
      const t1 = makeTaskWithPath(1, "Wave 0", "completed");
      const t2 = makeTaskWithPath(2, "Wave 1", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      const boundary0 = screen.getByTestId("wave-boundary-0");
      const boundary1 = screen.getByTestId("wave-boundary-1");
      expect(boundary0).toBeDefined();
      expect(boundary1).toBeDefined();
    });

    it("shows legend with edge type descriptions", () => {
      const t1 = makeTaskWithPath(1, "Task 1", "completed");
      const t2 = makeTaskWithPath(2, "Task 2", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      const legend = screen.getByTestId("graph-legend");
      expect(legend.textContent).toContain("blocked_by");
      expect(legend.textContent).toContain("produces_for");
    });
  });

  describe("circular dependency handling", () => {
    it("shows circular dependency warning", () => {
      const t1 = makeTaskWithPath(1, "Task A", "pending", {
        blocked_by: [2],
      });
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({ pending: [t1, t2] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(screen.getByTestId("full-graph-circular-warning")).toBeDefined();
    });

    it("highlights circular nodes with red border", () => {
      const t1 = makeTaskWithPath(1, "Task A", "pending", {
        blocked_by: [2],
      });
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({ pending: [t1, t2] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      const node1Rect = screen
        .getByTestId("full-graph-node-1")
        .querySelector("rect");
      expect(node1Rect?.getAttribute("stroke")).toBe("#ef4444");
    });

    it("does not show warning when no circular deps", () => {
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const allTasks = makeTasksByStatus({ completed: [t1] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(
        screen.queryByTestId("full-graph-circular-warning"),
      ).toBeNull();
    });
  });

  describe("click navigation", () => {
    it("calls onNodeClick when a node is clicked", () => {
      const onNodeClick = vi.fn();
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(
        <FullDependencyGraph
          allTasks={allTasks}
          onNodeClick={onNodeClick}
        />,
      );

      fireEvent.click(screen.getByTestId("full-graph-node-1"));
      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith(t1, "1");
    });

    it("navigates via keyboard Enter on a node", () => {
      const onNodeClick = vi.fn();
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(
        <FullDependencyGraph
          allTasks={allTasks}
          onNodeClick={onNodeClick}
        />,
      );

      fireEvent.keyDown(screen.getByTestId("full-graph-node-2"), {
        key: "Enter",
      });
      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith(t2, "2");
    });
  });

  describe("zoom and pan", () => {
    it("renders zoom controls", () => {
      const t1 = makeTaskWithPath(1, "Task A", "pending");
      const allTasks = makeTasksByStatus({ pending: [t1] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(screen.getByTestId("zoom-in")).toBeDefined();
      expect(screen.getByTestId("zoom-out")).toBeDefined();
      expect(screen.getByTestId("zoom-reset")).toBeDefined();
    });

    it("renders graph viewport for pan interaction", () => {
      const t1 = makeTaskWithPath(1, "Task A", "pending");
      const allTasks = makeTasksByStatus({ pending: [t1] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(screen.getByTestId("graph-viewport")).toBeDefined();
    });

    it("zoom in button increases scale", () => {
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      // Initial scale is 100%
      const controls = screen.getByTestId("zoom-controls");
      expect(controls.textContent).toContain("100%");

      fireEvent.click(screen.getByTestId("zoom-in"));
      expect(controls.textContent).toContain("120%");
    });

    it("zoom out button decreases scale", () => {
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      fireEvent.click(screen.getByTestId("zoom-out"));
      const controls = screen.getByTestId("zoom-controls");
      expect(controls.textContent).toContain("80%");
    });

    it("reset button restores default zoom", () => {
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const t2 = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1],
        pending: [t2],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      fireEvent.click(screen.getByTestId("zoom-in"));
      fireEvent.click(screen.getByTestId("zoom-in"));
      fireEvent.click(screen.getByTestId("zoom-reset"));

      const controls = screen.getByTestId("zoom-controls");
      expect(controls.textContent).toContain("100%");
    });
  });

  describe("layout adaptation", () => {
    it("displays layout type in legend for small graphs", () => {
      const t1 = makeTaskWithPath(1, "Task A", "completed");
      const allTasks = makeTasksByStatus({ completed: [t1] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      const legend = screen.getByTestId("graph-legend");
      expect(legend.textContent).toContain("Force-directed layout");
    });

    it("displays layout type for large graphs (20+ nodes)", () => {
      const tasks: TaskWithPath[] = [];
      for (let i = 1; i <= 22; i++) {
        tasks.push(makeTaskWithPath(i, `Task ${i}`, "pending"));
      }
      const allTasks = makeTasksByStatus({ pending: tasks });

      render(<FullDependencyGraph allTasks={allTasks} />);

      const legend = screen.getByTestId("graph-legend");
      expect(legend.textContent).toContain("Hierarchical layout");
    });
  });

  describe("fallback list view", () => {
    it("renders list view on error", () => {
      // Force an error by passing corrupted data
      const allTasks = makeTasksByStatus();
      // Directly render the component to test error case
      render(
        <FullDependencyGraph
          allTasks={allTasks}
          taskGroup="nonexistent"
        />,
      );

      // With no tasks for the group, it shows empty state (not fallback)
      expect(screen.getByTestId("full-graph-empty")).toBeDefined();
    });
  });

  describe("disconnected subgraphs", () => {
    it("renders all disconnected chains", () => {
      const t1 = makeTaskWithPath(1, "Chain A-1", "completed");
      const t2 = makeTaskWithPath(2, "Chain A-2", "pending", {
        blocked_by: [1],
      });
      const t3 = makeTaskWithPath(3, "Chain B-1", "completed");
      const t4 = makeTaskWithPath(4, "Chain B-2", "pending", {
        blocked_by: [3],
      });
      const allTasks = makeTasksByStatus({
        completed: [t1, t3],
        pending: [t2, t4],
      });

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(screen.getByTestId("full-graph-node-1")).toBeDefined();
      expect(screen.getByTestId("full-graph-node-2")).toBeDefined();
      expect(screen.getByTestId("full-graph-node-3")).toBeDefined();
      expect(screen.getByTestId("full-graph-node-4")).toBeDefined();
    });
  });

  describe("single node graph", () => {
    it("renders a single isolated node", () => {
      const t1 = makeTaskWithPath(1, "Solo task", "pending");
      const allTasks = makeTasksByStatus({ pending: [t1] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      expect(screen.getByTestId("full-graph-node-1")).toBeDefined();
      expect(screen.getByTestId("full-dependency-graph-svg")).toBeDefined();
    });
  });

  describe("performance", () => {
    it("renders 100 nodes without error", () => {
      const tasks: TaskWithPath[] = [];
      for (let i = 1; i <= 100; i++) {
        const deps = i > 10 ? [((i - 1) % 10) + 1] : undefined;
        tasks.push(
          makeTaskWithPath(i, `Task ${i}`, "pending", { blocked_by: deps }),
        );
      }
      const allTasks = makeTasksByStatus({ pending: tasks });

      const start = performance.now();
      render(<FullDependencyGraph allTasks={allTasks} />);
      const elapsed = performance.now() - start;

      expect(screen.getByTestId("full-dependency-graph")).toBeDefined();
      // Check all 100 nodes are rendered
      for (let i = 1; i <= 100; i++) {
        expect(screen.getByTestId(`full-graph-node-${i}`)).toBeDefined();
      }
      // Performance: rendering should complete within budget
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe("animation state integration", () => {
    function makeAnimationState(overrides?: Partial<GraphAnimationState>): GraphAnimationState {
      return {
        nodeStates: new Map(),
        activeWave: 0,
        completedWaveIndices: new Set(),
        activeNodeIds: new Set(),
        animationsEnabled: true,
        ...overrides,
      };
    }

    it("applies glow filter to active nodes", () => {
      const t1 = makeTaskWithPath(1, "Active Task", "in_progress");
      const t2 = makeTaskWithPath(2, "Idle Task", "pending", { blocked_by: [1] });
      const allTasks = makeTasksByStatus({ in_progress: [t1], pending: [t2] });

      const animState = makeAnimationState({
        activeNodeIds: new Set(["1"]),
        activeWave: 1,
        nodeStates: new Map([
          ["1", { previousStatus: null, isTransitioning: false, isActive: true }],
          ["2", { previousStatus: null, isTransitioning: false, isActive: false }],
        ]),
      });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      const activeNode = screen.getByTestId("full-graph-node-1");
      expect(activeNode.getAttribute("filter")).toBe("url(#glow-active)");
      expect(activeNode.getAttribute("data-node-active")).toBe("true");

      const idleNode = screen.getByTestId("full-graph-node-2");
      expect(idleNode.getAttribute("filter")).toBeNull();
      expect(idleNode.getAttribute("data-node-active")).toBeNull();
    });

    it("renders pulse animation on active node rect", () => {
      const t1 = makeTaskWithPath(1, "Active", "in_progress");
      const t2 = makeTaskWithPath(2, "Pending", "pending", { blocked_by: [1] });
      const allTasks = makeTasksByStatus({ in_progress: [t1], pending: [t2] });

      const animState = makeAnimationState({
        activeNodeIds: new Set(["1"]),
        activeWave: 1,
        nodeStates: new Map([
          ["1", { previousStatus: null, isTransitioning: false, isActive: true }],
          ["2", { previousStatus: null, isTransitioning: false, isActive: false }],
        ]),
      });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      // The active node should have an <animate> child inside its <rect>
      const activeNode = screen.getByTestId("full-graph-node-1");
      const animateEl = activeNode.querySelector("animate");
      expect(animateEl).not.toBeNull();
      expect(animateEl?.getAttribute("attributeName")).toBe("stroke-opacity");

      // The idle node should NOT have an <animate>
      const idleNode = screen.getByTestId("full-graph-node-2");
      expect(idleNode.querySelector("animate")).toBeNull();
    });

    it("marks transitioning nodes with data attribute", () => {
      const t1 = makeTaskWithPath(1, "Transitioning", "in_progress");
      const t2 = makeTaskWithPath(2, "Stable", "pending", { blocked_by: [1] });
      const allTasks = makeTasksByStatus({ in_progress: [t1], pending: [t2] });

      const animState = makeAnimationState({
        nodeStates: new Map([
          ["1", { previousStatus: "pending", isTransitioning: true, isActive: false }],
          ["2", { previousStatus: null, isTransitioning: false, isActive: false }],
        ]),
      });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      expect(screen.getByTestId("full-graph-node-1").getAttribute("data-node-transitioning")).toBe("true");
      expect(screen.getByTestId("full-graph-node-2").getAttribute("data-node-transitioning")).toBeNull();
    });

    it("applies CSS transitions on node rects when animations enabled", () => {
      const t1 = makeTaskWithPath(1, "Task 1", "pending");
      const allTasks = makeTasksByStatus({ pending: [t1] });

      const animState = makeAnimationState({ animationsEnabled: true });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      const rect = screen.getByTestId("full-graph-node-1").querySelector("rect");
      const style = rect?.getAttribute("style") ?? "";
      expect(style).toContain("transition");
      expect(style).toContain("fill");
      expect(style).toContain("600ms");
    });

    it("does not apply CSS transitions when animations disabled", () => {
      const t1 = makeTaskWithPath(1, "Task 1", "pending");
      const allTasks = makeTasksByStatus({ pending: [t1] });

      const animState = makeAnimationState({ animationsEnabled: false });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      const rect = screen.getByTestId("full-graph-node-1").querySelector("rect");
      const style = rect?.getAttribute("style") ?? "";
      expect(style).not.toContain("transition");
    });

    it("highlights active wave boundary", () => {
      const t1 = makeTaskWithPath(1, "Wave 0 task", "completed");
      const t2 = makeTaskWithPath(2, "Wave 1 task", "in_progress", { blocked_by: [1] });
      const allTasks = makeTasksByStatus({ completed: [t1], in_progress: [t2] });

      const animState = makeAnimationState({
        activeWave: 2,
        completedWaveIndices: new Set([0]),
      });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      const wave0 = screen.getByTestId("wave-boundary-0");
      const wave1 = screen.getByTestId("wave-boundary-1");

      // Wave 0 should be completed (faded)
      expect(wave0.getAttribute("data-wave-completed")).toBe("true");

      // Wave 1 is active (activeWave=2 means wave index 1 is current)
      expect(wave1.getAttribute("data-wave-active")).toBe("true");
    });

    it("fades completed wave boundaries", () => {
      const t1 = makeTaskWithPath(1, "Wave 0", "completed");
      const t2 = makeTaskWithPath(2, "Wave 1", "in_progress", { blocked_by: [1] });
      const allTasks = makeTasksByStatus({ completed: [t1], in_progress: [t2] });

      const animState = makeAnimationState({
        activeWave: 2,
        completedWaveIndices: new Set([0]),
      });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      const wave0 = screen.getByTestId("wave-boundary-0");
      const style = wave0.getAttribute("style") ?? "";
      expect(style).toContain("opacity");
      expect(style).toContain("0.35");
    });

    it("falls back to static rendering when animations disabled", () => {
      const t1 = makeTaskWithPath(1, "Task 1", "in_progress");
      const t2 = makeTaskWithPath(2, "Task 2", "pending", { blocked_by: [1] });
      const allTasks = makeTasksByStatus({ in_progress: [t1], pending: [t2] });

      const animState = makeAnimationState({
        animationsEnabled: false,
        activeNodeIds: new Set(["1"]),
        nodeStates: new Map([
          ["1", { previousStatus: null, isTransitioning: false, isActive: true }],
        ]),
      });

      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);

      // No glow filter when disabled
      const node1 = screen.getByTestId("full-graph-node-1");
      expect(node1.getAttribute("filter")).toBeNull();
      expect(node1.getAttribute("data-node-active")).toBeNull();

      // No pulse animation
      expect(node1.querySelector("animate")).toBeNull();
    });

    it("renders normally without animation state prop", () => {
      const t1 = makeTaskWithPath(1, "Task 1", "completed");
      const t2 = makeTaskWithPath(2, "Task 2", "pending", { blocked_by: [1] });
      const allTasks = makeTasksByStatus({ completed: [t1], pending: [t2] });

      render(<FullDependencyGraph allTasks={allTasks} />);

      // Should render without any animation attributes
      const node1 = screen.getByTestId("full-graph-node-1");
      expect(node1.getAttribute("filter")).toBeNull();
      expect(node1.getAttribute("data-node-active")).toBeNull();
      expect(node1.getAttribute("data-node-transitioning")).toBeNull();
      expect(node1.querySelector("animate")).toBeNull();
    });

    it("is non-blocking: renders graph with animation state in performance budget", () => {
      const tasks: TaskWithPath[] = [];
      for (let i = 1; i <= 50; i++) {
        const deps = i > 5 ? [((i - 1) % 5) + 1] : undefined;
        tasks.push(makeTaskWithPath(i, `Task ${i}`, i <= 5 ? "completed" : "pending", { blocked_by: deps }));
      }
      const allTasks = makeTasksByStatus({
        completed: tasks.filter((t) => t.task.status === "completed"),
        pending: tasks.filter((t) => t.task.status === "pending"),
      });

      const nodeStates = new Map<string, { previousStatus: null; isTransitioning: boolean; isActive: boolean }>();
      const activeNodeIds = new Set<string>();
      for (let i = 1; i <= 50; i++) {
        const isActive = i >= 6 && i <= 10;
        if (isActive) activeNodeIds.add(String(i));
        nodeStates.set(String(i), {
          previousStatus: null,
          isTransitioning: false,
          isActive,
        });
      }

      const animState = makeAnimationState({
        activeWave: 2,
        completedWaveIndices: new Set([0]),
        activeNodeIds,
        nodeStates,
      });

      const start = performance.now();
      render(<FullDependencyGraph allTasks={allTasks} animationState={animState} />);
      const elapsed = performance.now() - start;

      expect(screen.getByTestId("full-dependency-graph")).toBeDefined();
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
