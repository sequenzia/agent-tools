/**
 * Project directory service — multi-project management via the Node.js backend.
 *
 * Provides functions to load, add, remove, and activate projects,
 * as well as validate project directories.
 */

import { api } from "./api-client";

/** Result returned when a project directory is validated. */
export interface ProjectDirectoryResult {
  path: string;
  has_tasks_dir: boolean;
}

/** Response from loading the persisted project list. */
export interface ProjectListResponse {
  projects: string[];
  activeProjectPath: string | null;
}

/** Response from adding a project. */
export interface AddProjectResponse {
  ok: boolean;
  has_tasks_dir: boolean;
}

/**
 * Load all persisted projects and the active project path.
 */
export async function loadProjects(): Promise<ProjectListResponse> {
  return api.get<ProjectListResponse>("/api/projects");
}

/**
 * Add a project path to the persisted list.
 * The backend validates that the directory exists.
 */
export async function addProjectPath(
  path: string,
): Promise<AddProjectResponse> {
  return api.post<AddProjectResponse>("/api/projects", { path });
}

/**
 * Remove a project path from the persisted list.
 * If it was the active project, the backend auto-selects the next one.
 */
export async function removeProjectPath(path: string): Promise<void> {
  await api.delete("/api/projects", { path });
}

/**
 * Persist the active project selection.
 */
export async function persistActiveProject(
  path: string | null,
): Promise<void> {
  await api.put("/api/projects/active", { path });
}

/**
 * Validate a directory path: checks existence, permissions, and .agents/tasks/ presence.
 */
export async function validateProjectDirectory(
  path: string,
): Promise<ProjectDirectoryResult> {
  return api.post<ProjectDirectoryResult>("/api/projects/validate", { path });
}
