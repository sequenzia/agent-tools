import { create } from "zustand";
import type { TasksByStatus, TaskWithPath } from "../services/task-service";

/** Summary counts for a project's tasks. */
export interface TaskCountSummary {
  pending: number;
  in_progress: number;
  completed: number;
  total: number;
}

/** A task group within a project with its task counts. */
export interface TaskGroupInfo {
  name: string;
  counts: TaskCountSummary;
}

/** A configured project entry. */
export interface ProjectEntry {
  /** Absolute path to the project root directory. */
  path: string;
  /** Directory name (last path segment). */
  name: string;
  /** Whether the project directory still exists on disk. */
  connected: boolean;
  /** Task count summary across all statuses. */
  counts: TaskCountSummary;
  /** Task groups discovered within this project. */
  taskGroups: TaskGroupInfo[];
}

interface ProjectState {
  /** All configured projects. */
  projects: ProjectEntry[];
  /** Path of the currently active project, or null. */
  activeProjectPath: string | null;
  /** Currently selected task group filters. Empty set means "all" (no filter). */
  activeTaskGroups: Set<string>;

  /** Set the list of projects. */
  setProjects: (projects: ProjectEntry[]) => void;
  /** Add a project to the list. */
  addProject: (project: ProjectEntry) => void;
  /** Remove a project by path. */
  removeProject: (path: string) => void;
  /** Set the active project. Clears group filter. */
  setActiveProject: (path: string | null) => void;
  /** Toggle a task group in the filter set. If already selected, remove it; otherwise add it. */
  toggleTaskGroup: (group: string) => void;
  /** Set all active task groups at once. Pass empty set or null for "all". */
  setActiveTaskGroups: (groups: Set<string> | null) => void;
  /** Update a project's task data (counts and groups) from loaded tasks. */
  updateProjectTasks: (path: string, tasks: TasksByStatus) => void;
  /** Mark a project as disconnected. */
  markDisconnected: (path: string) => void;
  /** Clear all project state. */
  clearProjects: () => void;
}

/**
 * Extract the directory name from a path.
 */
export function getDirectoryName(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] || path;
}

/**
 * Compute task count summary from task groups in TasksByStatus.
 */
function computeTaskCounts(tasks: TasksByStatus): TaskCountSummary {
  const pending = tasks.pending.length + tasks.backlog.length;
  const in_progress = tasks.in_progress.length;
  const completed = tasks.completed.length;
  return {
    pending,
    in_progress,
    completed,
    total: pending + in_progress + completed,
  };
}

/**
 * Extract task group information from loaded tasks.
 */
function extractTaskGroups(tasks: TasksByStatus): TaskGroupInfo[] {
  const groupMap = new Map<string, TaskCountSummary>();

  function addToGroup(twp: TaskWithPath, status: "pending" | "in_progress" | "completed") {
    const groupName = twp.task.metadata?.task_group;
    if (!groupName) return;

    let counts = groupMap.get(groupName);
    if (!counts) {
      counts = { pending: 0, in_progress: 0, completed: 0, total: 0 };
      groupMap.set(groupName, counts);
    }

    counts[status] += 1;
    counts.total += 1;
  }

  for (const twp of tasks.backlog) {
    addToGroup(twp, "pending");
  }
  for (const twp of tasks.pending) {
    addToGroup(twp, "pending");
  }
  for (const twp of tasks.in_progress) {
    addToGroup(twp, "in_progress");
  }
  for (const twp of tasks.completed) {
    addToGroup(twp, "completed");
  }

  return Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, counts]) => ({ name, counts }));
}

/**
 * Check if two projects have the same directory name and need disambiguation.
 */
export function getDisplayName(project: ProjectEntry, allProjects: ProjectEntry[]): string {
  const duplicates = allProjects.filter((p) => p.name === project.name);
  if (duplicates.length <= 1) {
    return project.name;
  }
  // Show the last two path segments for disambiguation
  const segments = project.path.replace(/\/+$/, "").split("/");
  if (segments.length >= 2) {
    return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
  }
  return project.path;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProjectPath: null,
  activeTaskGroups: new Set<string>(),

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => {
      // Avoid duplicates
      if (state.projects.some((p) => p.path === project.path)) {
        return state;
      }
      return { projects: [...state.projects, project] };
    }),

  removeProject: (path) =>
    set((state) => {
      const projects = state.projects.filter((p) => p.path !== path);
      const activeProjectPath =
        state.activeProjectPath === path ? null : state.activeProjectPath;
      const activeTaskGroups =
        state.activeProjectPath === path ? new Set<string>() : state.activeTaskGroups;
      return { projects, activeProjectPath, activeTaskGroups };
    }),

  setActiveProject: (path) =>
    set({ activeProjectPath: path, activeTaskGroups: new Set<string>() }),

  toggleTaskGroup: (group) =>
    set((state) => {
      const next = new Set(state.activeTaskGroups);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return { activeTaskGroups: next };
    }),

  setActiveTaskGroups: (groups) =>
    set({ activeTaskGroups: groups ?? new Set<string>() }),

  updateProjectTasks: (path, tasks) =>
    set((state) => {
      const projects = state.projects.map((p) => {
        if (p.path !== path) return p;
        return {
          ...p,
          counts: computeTaskCounts(tasks),
          taskGroups: extractTaskGroups(tasks),
          connected: true,
        };
      });

      // If any selected groups no longer exist in the project, remove them from the filter
      const activeProject = projects.find((p) => p.path === state.activeProjectPath);
      if (activeProject && state.activeTaskGroups.size > 0) {
        const validGroupNames = new Set(activeProject.taskGroups.map((g) => g.name));
        const cleaned = new Set<string>();
        let changed = false;
        for (const g of state.activeTaskGroups) {
          if (validGroupNames.has(g)) {
            cleaned.add(g);
          } else {
            changed = true;
          }
        }
        if (changed) {
          return { projects, activeTaskGroups: cleaned };
        }
      }

      return { projects };
    }),

  markDisconnected: (path) =>
    set((state) => {
      const projects = state.projects.map((p) => {
        if (p.path !== path) return p;
        return { ...p, connected: false };
      });
      return { projects };
    }),

  clearProjects: () =>
    set({
      projects: [],
      activeProjectPath: null,
      activeTaskGroups: new Set<string>(),
    }),
}));
