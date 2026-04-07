import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  DependencyGraph,
  buildDependencyGraph,
} from "../DependencyGraph";
import type { TaskWithPath, TasksByStatus } from "../../services/task-service";

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
  },
): TaskWithPath {
  return {
    task: {
      id,
      title,
      description: `Description for ${title}`,
      status: status as "backlog" | "pending" | "in_progress" | "completed",
      blocked_by: extra?.blocked_by,
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

// --- buildDependencyGraph unit tests ---

describe("buildDependencyGraph", () => {
  it("returns only the focused node when task has no dependencies", () => {
    const task = makeTaskWithPath(1, "Solo task", "pending");
    const allTasks = makeTasksByStatus({ pending: [task] });

    const graph = buildDependencyGraph(task, allTasks);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].id).toBe("1");
    expect(graph.nodes[0].isFocused).toBe(true);
    expect(graph.edges).toHaveLength(0);
    expect(graph.hasCircularDeps).toBe(false);
  });

  it("includes upstream blockers from blocked_by", () => {
    const blocker = makeTaskWithPath(10, "Blocker", "in_progress");
    const task = makeTaskWithPath(1, "Blocked task", "pending", {
      blocked_by: [10],
    });
    const allTasks = makeTasksByStatus({
      pending: [task],
      in_progress: [blocker],
    });

    const graph = buildDependencyGraph(task, allTasks);

    expect(graph.nodes).toHaveLength(2);
    const focusedNode = graph.nodes.find((n) => n.id === "1");
    const blockerNode = graph.nodes.find((n) => n.id === "10");
    expect(focusedNode?.isFocused).toBe(true);
    expect(blockerNode?.isFocused).toBe(false);
    expect(blockerNode?.status).toBe("in_progress");

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe("10");
    expect(graph.edges[0].to).toBe("1");
  });

  it("includes downstream dependents", () => {
    const task = makeTaskWithPath(1, "Foundation task", "completed");
    const dependent = makeTaskWithPath(5, "Dependent", "pending", {
      blocked_by: [1],
    });
    const allTasks = makeTasksByStatus({
      completed: [task],
      pending: [dependent],
    });

    const graph = buildDependencyGraph(task, allTasks);

    expect(graph.nodes).toHaveLength(2);
    const depNode = graph.nodes.find((n) => n.id === "5");
    expect(depNode?.status).toBe("pending");

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe("1");
    expect(graph.edges[0].to).toBe("5");
  });

  it("marks missing task IDs with 'missing' status", () => {
    const task = makeTaskWithPath(1, "Task with missing dep", "pending", {
      blocked_by: [999],
    });
    const allTasks = makeTasksByStatus({ pending: [task] });

    const graph = buildDependencyGraph(task, allTasks);

    expect(graph.nodes).toHaveLength(2);
    const missingNode = graph.nodes.find((n) => n.id === "999");
    expect(missingNode?.status).toBe("missing");
    expect(missingNode?.title).toBe("Task 999");
    expect(missingNode?.taskWithPath).toBeNull();
  });

  it("detects circular dependencies", () => {
    // Task A blocked by B, Task B blocked by A
    const taskA = makeTaskWithPath(1, "Task A", "pending", {
      blocked_by: [2],
    });
    const taskB = makeTaskWithPath(2, "Task B", "pending", {
      blocked_by: [1],
    });
    const allTasks = makeTasksByStatus({ pending: [taskA, taskB] });

    const graph = buildDependencyGraph(taskA, allTasks);

    expect(graph.hasCircularDeps).toBe(true);
    const circularEdges = graph.edges.filter((e) => e.isCircular);
    expect(circularEdges.length).toBeGreaterThan(0);
  });

  it("handles both upstream and downstream simultaneously", () => {
    const blocker = makeTaskWithPath(10, "Blocker", "completed");
    const task = makeTaskWithPath(1, "Middle task", "in_progress", {
      blocked_by: [10],
    });
    const dependent = makeTaskWithPath(20, "Dependent", "pending", {
      blocked_by: [1],
    });
    const allTasks = makeTasksByStatus({
      completed: [blocker],
      in_progress: [task],
      pending: [dependent],
    });

    const graph = buildDependencyGraph(task, allTasks);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);

    const upstreamEdge = graph.edges.find((e) => e.from === "10");
    expect(upstreamEdge?.to).toBe("1");

    const downstreamEdge = graph.edges.find((e) => e.from === "1");
    expect(downstreamEdge?.to).toBe("20");
  });
});

// --- DependencyGraph component rendering tests ---

describe("DependencyGraph", () => {
  describe("empty state", () => {
    it("shows 'No dependencies' when task has no deps and no dependents", () => {
      const task = makeTaskWithPath(1, "Solo task", "pending");
      const allTasks = makeTasksByStatus({ pending: [task] });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      expect(screen.getByTestId("no-dependencies-graph")).toBeDefined();
      expect(
        screen.getByTestId("no-dependencies-graph").textContent,
      ).toBe("No dependencies");
    });
  });

  describe("graph rendering", () => {
    it("renders SVG with nodes and edges for task with dependencies", () => {
      const blocker = makeTaskWithPath(10, "Blocker task", "in_progress");
      const task = makeTaskWithPath(1, "Main task", "pending", {
        blocked_by: [10],
      });
      const allTasks = makeTasksByStatus({
        in_progress: [blocker],
        pending: [task],
      });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      expect(screen.getByTestId("dependency-graph")).toBeDefined();
      expect(screen.getByTestId("dependency-graph-svg")).toBeDefined();
      expect(screen.getByTestId("graph-node-1")).toBeDefined();
      expect(screen.getByTestId("graph-node-10")).toBeDefined();
      expect(screen.getByTestId("edge-10-1")).toBeDefined();
    });

    it("renders nodes colored by status", () => {
      const pendingTask = makeTaskWithPath(10, "Pending dep", "pending");
      const completedTask = makeTaskWithPath(20, "Completed dep", "completed");
      const task = makeTaskWithPath(1, "Main", "in_progress", {
        blocked_by: [10, 20],
      });
      const allTasks = makeTasksByStatus({
        pending: [pendingTask],
        completed: [completedTask],
        in_progress: [task],
      });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      // Verify nodes exist for each status
      const node10 = screen.getByTestId("graph-node-10");
      const node20 = screen.getByTestId("graph-node-20");
      const node1 = screen.getByTestId("graph-node-1");

      // Each node should have a rect (the SVG shape)
      expect(node10.querySelector("rect")).not.toBeNull();
      expect(node20.querySelector("rect")).not.toBeNull();
      expect(node1.querySelector("rect")).not.toBeNull();

      // In-progress (focused) node gets thicker stroke
      const focusedRect = node1.querySelector("rect");
      expect(focusedRect?.getAttribute("stroke-width")).toBe("3");

      // Non-focused nodes get normal stroke
      const depRect = node10.querySelector("rect");
      expect(depRect?.getAttribute("stroke-width")).toBe("1.5");
    });

    it("renders edge arrows between nodes", () => {
      const blocker = makeTaskWithPath(10, "Blocker", "completed");
      const task = makeTaskWithPath(1, "Task", "pending", {
        blocked_by: [10],
      });
      const allTasks = makeTasksByStatus({
        completed: [blocker],
        pending: [task],
      });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      const edge = screen.getByTestId("edge-10-1");
      expect(edge.getAttribute("marker-end")).toContain("url(#arrow-");
    });

    it("shows missing node for unresolvable task IDs", () => {
      const task = makeTaskWithPath(1, "Task", "pending", {
        blocked_by: [999],
      });
      const allTasks = makeTasksByStatus({ pending: [task] });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      const missingNode = screen.getByTestId("graph-node-999");
      expect(missingNode).toBeDefined();

      // Missing nodes have red-tinted fill
      const rect = missingNode.querySelector("rect");
      expect(rect?.getAttribute("fill")).toBe("#fee2e2");
    });
  });

  describe("circular dependency warning", () => {
    it("shows warning when circular deps are detected", () => {
      const taskA = makeTaskWithPath(1, "Task A", "pending", {
        blocked_by: [2],
      });
      const taskB = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({ pending: [taskA, taskB] });

      render(
        <DependencyGraph task={taskA} allTasks={allTasks} />,
      );

      expect(screen.getByTestId("circular-dep-warning")).toBeDefined();
      expect(
        screen.getByTestId("circular-dep-warning").textContent,
      ).toBe("Circular dependency detected");
    });

    it("does not show warning when no circular deps", () => {
      const blocker = makeTaskWithPath(10, "Blocker", "completed");
      const task = makeTaskWithPath(1, "Task", "pending", {
        blocked_by: [10],
      });
      const allTasks = makeTasksByStatus({
        completed: [blocker],
        pending: [task],
      });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      expect(screen.queryByTestId("circular-dep-warning")).toBeNull();
    });

    it("renders circular edges with dashed red styling", () => {
      const taskA = makeTaskWithPath(1, "Task A", "pending", {
        blocked_by: [2],
      });
      const taskB = makeTaskWithPath(2, "Task B", "pending", {
        blocked_by: [1],
      });
      const allTasks = makeTasksByStatus({ pending: [taskA, taskB] });

      render(
        <DependencyGraph task={taskA} allTasks={allTasks} />,
      );

      // Find edges that are circular
      const svg = screen.getByTestId("dependency-graph-svg");
      const edges = svg.querySelectorAll("line");
      const circularEdge = Array.from(edges).find(
        (e) => e.getAttribute("stroke-dasharray") === "4 3",
      );
      expect(circularEdge).toBeDefined();
      expect(circularEdge?.getAttribute("stroke")).toBe("#ef4444");
    });
  });

  describe("node click navigation", () => {
    it("calls onNodeClick when a graph node is clicked", () => {
      const onNodeClick = vi.fn();
      const blocker = makeTaskWithPath(10, "Blocker", "completed");
      const task = makeTaskWithPath(1, "Task", "pending", {
        blocked_by: [10],
      });
      const allTasks = makeTasksByStatus({
        completed: [blocker],
        pending: [task],
      });

      render(
        <DependencyGraph
          task={task}
          allTasks={allTasks}
          onNodeClick={onNodeClick}
        />,
      );

      fireEvent.click(screen.getByTestId("graph-node-10"));
      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith(blocker, "10");
    });

    it("passes null taskWithPath for missing task nodes", () => {
      const onNodeClick = vi.fn();
      const task = makeTaskWithPath(1, "Task", "pending", {
        blocked_by: [999],
      });
      const allTasks = makeTasksByStatus({ pending: [task] });

      render(
        <DependencyGraph
          task={task}
          allTasks={allTasks}
          onNodeClick={onNodeClick}
        />,
      );

      fireEvent.click(screen.getByTestId("graph-node-999"));
      expect(onNodeClick).toHaveBeenCalledWith(null, "999");
    });

    it("navigates via keyboard Enter on a node", () => {
      const onNodeClick = vi.fn();
      const blocker = makeTaskWithPath(10, "Blocker", "completed");
      const task = makeTaskWithPath(1, "Task", "pending", {
        blocked_by: [10],
      });
      const allTasks = makeTasksByStatus({
        completed: [blocker],
        pending: [task],
      });

      render(
        <DependencyGraph
          task={task}
          allTasks={allTasks}
          onNodeClick={onNodeClick}
        />,
      );

      fireEvent.keyDown(screen.getByTestId("graph-node-10"), {
        key: "Enter",
      });
      expect(onNodeClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("readability with many deps", () => {
    it("renders 10+ dependencies without errors", () => {
      const blockers: TaskWithPath[] = [];
      const blockerIds: number[] = [];
      for (let i = 100; i < 112; i++) {
        blockers.push(makeTaskWithPath(i, `Dep ${i}`, "pending"));
        blockerIds.push(i);
      }

      const task = makeTaskWithPath(1, "Main task", "in_progress", {
        blocked_by: blockerIds,
      });

      const allTasks = makeTasksByStatus({
        pending: blockers,
        in_progress: [task],
      });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      expect(screen.getByTestId("dependency-graph")).toBeDefined();

      // All 12 blocker nodes + the focused task should render
      for (const id of blockerIds) {
        expect(screen.getByTestId(`graph-node-${id}`)).toBeDefined();
      }
      expect(screen.getByTestId("graph-node-1")).toBeDefined();
    });

    it("provides scrollable container for overflow", () => {
      const blocker = makeTaskWithPath(10, "Blocker", "completed");
      const task = makeTaskWithPath(1, "Task", "pending", {
        blocked_by: [10],
      });
      const allTasks = makeTasksByStatus({
        completed: [blocker],
        pending: [task],
      });

      render(
        <DependencyGraph task={task} allTasks={allTasks} />,
      );

      const graphContainer = screen.getByTestId("dependency-graph");
      const scrollContainer = graphContainer.querySelector(".overflow-x-auto");
      expect(scrollContainer).not.toBeNull();
    });
  });
});
