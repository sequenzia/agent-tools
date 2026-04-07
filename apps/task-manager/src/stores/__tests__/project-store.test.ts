import { describe, it, expect, beforeEach } from "vitest";
import {
  useProjectStore,
  getDirectoryName,
  getDisplayName,
  type ProjectEntry,
} from "../project-store";
import type { TasksByStatus } from "../../services/task-service";

function makeProject(
  path: string,
  overrides?: Partial<ProjectEntry>,
): ProjectEntry {
  return {
    path,
    name: getDirectoryName(path),
    connected: true,
    counts: { pending: 0, in_progress: 0, completed: 0, total: 0 },
    taskGroups: [],
    ...overrides,
  };
}

function makeTasksByStatus(
  overrides?: Partial<TasksByStatus>,
): TasksByStatus {
  return {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
    errors: [],
    ...overrides,
  };
}

beforeEach(() => {
  useProjectStore.setState({
    projects: [],
    activeProjectPath: null,
    activeTaskGroups: new Set<string>(),
  });
});

describe("getDirectoryName", () => {
  it("extracts last path segment", () => {
    expect(getDirectoryName("/Users/dev/my-project")).toBe("my-project");
  });

  it("handles trailing slashes", () => {
    expect(getDirectoryName("/Users/dev/my-project/")).toBe("my-project");
  });

  it("returns full path for root-like paths", () => {
    expect(getDirectoryName("/")).toBe("/");
  });
});

describe("getDisplayName", () => {
  it("returns just the name when unique", () => {
    const project = makeProject("/Users/dev/alpha");
    const all = [project, makeProject("/Users/dev/beta")];
    expect(getDisplayName(project, all)).toBe("alpha");
  });

  it("returns parent/name when duplicate names exist", () => {
    const p1 = makeProject("/Users/alice/project");
    const p2 = makeProject("/Users/bob/project");
    const all = [p1, p2];
    expect(getDisplayName(p1, all)).toBe("alice/project");
    expect(getDisplayName(p2, all)).toBe("bob/project");
  });
});

describe("useProjectStore", () => {
  describe("initial state", () => {
    it("starts with empty projects and null active selections", () => {
      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(0);
      expect(state.activeProjectPath).toBeNull();
      expect(state.activeTaskGroups.size).toBe(0);
    });
  });

  describe("addProject", () => {
    it("adds a project to the list", () => {
      const project = makeProject("/Users/dev/alpha");
      useProjectStore.getState().addProject(project);
      expect(useProjectStore.getState().projects).toHaveLength(1);
      expect(useProjectStore.getState().projects[0].path).toBe(
        "/Users/dev/alpha",
      );
    });

    it("does not add duplicate projects", () => {
      const project = makeProject("/Users/dev/alpha");
      useProjectStore.getState().addProject(project);
      useProjectStore.getState().addProject(project);
      expect(useProjectStore.getState().projects).toHaveLength(1);
    });
  });

  describe("removeProject", () => {
    it("removes a project by path", () => {
      const p1 = makeProject("/Users/dev/alpha");
      const p2 = makeProject("/Users/dev/beta");
      useProjectStore.getState().addProject(p1);
      useProjectStore.getState().addProject(p2);
      useProjectStore.getState().removeProject("/Users/dev/alpha");
      expect(useProjectStore.getState().projects).toHaveLength(1);
      expect(useProjectStore.getState().projects[0].path).toBe(
        "/Users/dev/beta",
      );
    });

    it("clears active project and groups when it is removed", () => {
      const project = makeProject("/Users/dev/alpha");
      useProjectStore.getState().addProject(project);
      useProjectStore.getState().setActiveProject("/Users/dev/alpha");
      useProjectStore.getState().toggleTaskGroup("auth");
      useProjectStore.getState().removeProject("/Users/dev/alpha");
      expect(useProjectStore.getState().activeProjectPath).toBeNull();
      expect(useProjectStore.getState().activeTaskGroups.size).toBe(0);
    });
  });

  describe("setActiveProject", () => {
    it("sets the active project and clears task group filter", () => {
      useProjectStore.getState().setActiveProject("/Users/dev/alpha");
      useProjectStore.getState().toggleTaskGroup("task-manager-ui");
      expect(useProjectStore.getState().activeTaskGroups.has("task-manager-ui")).toBe(true);

      useProjectStore.getState().setActiveProject("/Users/dev/beta");
      expect(useProjectStore.getState().activeProjectPath).toBe(
        "/Users/dev/beta",
      );
      expect(useProjectStore.getState().activeTaskGroups.size).toBe(0);
    });
  });

  describe("toggleTaskGroup", () => {
    it("adds a group to the filter set", () => {
      useProjectStore.getState().toggleTaskGroup("auth");
      expect(useProjectStore.getState().activeTaskGroups.has("auth")).toBe(true);
      expect(useProjectStore.getState().activeTaskGroups.size).toBe(1);
    });

    it("removes a group from the filter set when toggled again", () => {
      useProjectStore.getState().toggleTaskGroup("auth");
      useProjectStore.getState().toggleTaskGroup("auth");
      expect(useProjectStore.getState().activeTaskGroups.has("auth")).toBe(false);
      expect(useProjectStore.getState().activeTaskGroups.size).toBe(0);
    });

    it("supports multiple groups simultaneously", () => {
      useProjectStore.getState().toggleTaskGroup("auth");
      useProjectStore.getState().toggleTaskGroup("payments");
      useProjectStore.getState().toggleTaskGroup("ui");
      const groups = useProjectStore.getState().activeTaskGroups;
      expect(groups.size).toBe(3);
      expect(groups.has("auth")).toBe(true);
      expect(groups.has("payments")).toBe(true);
      expect(groups.has("ui")).toBe(true);
    });

    it("can remove one group while keeping others", () => {
      useProjectStore.getState().toggleTaskGroup("auth");
      useProjectStore.getState().toggleTaskGroup("payments");
      useProjectStore.getState().toggleTaskGroup("auth");
      const groups = useProjectStore.getState().activeTaskGroups;
      expect(groups.size).toBe(1);
      expect(groups.has("payments")).toBe(true);
      expect(groups.has("auth")).toBe(false);
    });
  });

  describe("setActiveTaskGroups", () => {
    it("sets multiple groups at once", () => {
      useProjectStore.getState().setActiveTaskGroups(new Set(["auth", "payments"]));
      const groups = useProjectStore.getState().activeTaskGroups;
      expect(groups.size).toBe(2);
      expect(groups.has("auth")).toBe(true);
      expect(groups.has("payments")).toBe(true);
    });

    it("clears the filter when set to null", () => {
      useProjectStore.getState().toggleTaskGroup("auth");
      useProjectStore.getState().setActiveTaskGroups(null);
      expect(useProjectStore.getState().activeTaskGroups.size).toBe(0);
    });

    it("clears the filter when set to empty set", () => {
      useProjectStore.getState().toggleTaskGroup("auth");
      useProjectStore.getState().setActiveTaskGroups(new Set());
      expect(useProjectStore.getState().activeTaskGroups.size).toBe(0);
    });
  });

  describe("updateProjectTasks", () => {
    it("updates task counts from TasksByStatus data", () => {
      const project = makeProject("/Users/dev/alpha");
      useProjectStore.getState().addProject(project);

      const tasks = makeTasksByStatus({
        pending: [
          {
            task: {
              id: 1,
              title: "Task 1",
              description: "",
              status: "pending",
              metadata: { task_group: "auth" },
            },
            filePath: "/path/1.json",
            mtimeMs: 1700000000001,
          },
          {
            task: {
              id: 2,
              title: "Task 2",
              description: "",
              status: "pending",
              metadata: { task_group: "auth" },
            },
            filePath: "/path/2.json",
            mtimeMs: 1700000000002,
          },
        ],
        in_progress: [
          {
            task: {
              id: 3,
              title: "Task 3",
              description: "",
              status: "in_progress",
              metadata: { task_group: "ui" },
            },
            filePath: "/path/3.json",
            mtimeMs: 1700000000003,
          },
        ],
        completed: [
          {
            task: {
              id: 4,
              title: "Task 4",
              description: "",
              status: "completed",
              metadata: { task_group: "auth" },
            },
            filePath: "/path/4.json",
            mtimeMs: 1700000000004,
          },
        ],
      });

      useProjectStore.getState().updateProjectTasks("/Users/dev/alpha", tasks);

      const updated = useProjectStore.getState().projects[0];
      expect(updated.counts.pending).toBe(2);
      expect(updated.counts.in_progress).toBe(1);
      expect(updated.counts.completed).toBe(1);
      expect(updated.counts.total).toBe(4);

      // Task groups should be extracted
      expect(updated.taskGroups).toHaveLength(2);
      const authGroup = updated.taskGroups.find((g) => g.name === "auth");
      expect(authGroup).toBeDefined();
      expect(authGroup!.counts.pending).toBe(2);
      expect(authGroup!.counts.completed).toBe(1);

      const uiGroup = updated.taskGroups.find((g) => g.name === "ui");
      expect(uiGroup).toBeDefined();
      expect(uiGroup!.counts.in_progress).toBe(1);
    });

    it("removes disappeared groups from active filter", () => {
      const project = makeProject("/Users/dev/alpha");
      useProjectStore.getState().addProject(project);
      useProjectStore.getState().setActiveProject("/Users/dev/alpha");

      // Select a group
      useProjectStore.getState().toggleTaskGroup("old-group");
      useProjectStore.getState().toggleTaskGroup("auth");

      // Update tasks without "old-group"
      const tasks = makeTasksByStatus({
        pending: [
          {
            task: {
              id: 1,
              title: "Task 1",
              description: "",
              status: "pending",
              metadata: { task_group: "auth" },
            },
            filePath: "/path/1.json",
            mtimeMs: 1700000000001,
          },
        ],
      });

      useProjectStore.getState().updateProjectTasks("/Users/dev/alpha", tasks);

      const groups = useProjectStore.getState().activeTaskGroups;
      expect(groups.has("auth")).toBe(true);
      expect(groups.has("old-group")).toBe(false);
      expect(groups.size).toBe(1);
    });
  });

  describe("markDisconnected", () => {
    it("marks a project as disconnected", () => {
      const project = makeProject("/Users/dev/alpha");
      useProjectStore.getState().addProject(project);
      useProjectStore.getState().markDisconnected("/Users/dev/alpha");
      expect(useProjectStore.getState().projects[0].connected).toBe(false);
    });
  });

  describe("clearProjects", () => {
    it("resets all state", () => {
      useProjectStore.getState().addProject(makeProject("/a"));
      useProjectStore.getState().setActiveProject("/a");
      useProjectStore.getState().toggleTaskGroup("group");
      useProjectStore.getState().clearProjects();

      const state = useProjectStore.getState();
      expect(state.projects).toHaveLength(0);
      expect(state.activeProjectPath).toBeNull();
      expect(state.activeTaskGroups.size).toBe(0);
    });
  });
});
