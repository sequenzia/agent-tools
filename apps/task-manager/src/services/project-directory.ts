/**
 * Project directory service — replaces Tauri native dialog and plugin-store.
 *
 * Uses the Node.js backend API for validation and persistence.
 * The native directory picker is replaced by a text input in the UI.
 */

import { api } from "./api-client";

/**
 * Result returned when a project directory is validated.
 */
export interface ProjectDirectoryResult {
  path: string;
  has_tasks_dir: boolean;
}

/**
 * Result returned when loading a previously saved project directory.
 */
export interface SavedProjectDirectory {
  path: string | null;
  exists: boolean;
  has_tasks_dir: boolean;
}

/**
 * Validate a directory path: checks existence, permissions, and .agents/tasks/ presence.
 * Throws an error string on permission denied or non-existent path.
 */
export async function validateProjectDirectory(
  path: string,
): Promise<ProjectDirectoryResult> {
  return api.post<ProjectDirectoryResult>("/api/projects/validate", { path });
}

/**
 * Save a project directory path to persistent storage.
 */
export async function saveProjectPath(path: string): Promise<void> {
  await api.post("/api/projects/save", { path });
}

/**
 * Load the previously saved project directory from persistent storage.
 * If the saved directory no longer exists, the saved path is cleared automatically.
 */
export async function getSavedProjectPath(): Promise<SavedProjectDirectory> {
  return api.get<SavedProjectDirectory>("/api/projects/saved");
}

/**
 * Clear the saved project directory path from persistent storage.
 */
export async function clearSavedProjectPath(): Promise<void> {
  await api.delete("/api/projects/saved");
}

/**
 * Validate and save a project directory.
 * Returns the validation result, or null if validation fails.
 */
export async function validateAndSaveProjectDirectory(
  dirPath: string,
  onNoTasksDir?: (path: string) => void,
): Promise<ProjectDirectoryResult | null> {
  const result = await validateProjectDirectory(dirPath);

  if (!result.has_tasks_dir && onNoTasksDir) {
    onNoTasksDir(result.path);
  }

  await saveProjectPath(result.path);
  return result;
}

/**
 * Load the saved project directory on app startup.
 * Returns the project info if valid, null if no saved path or path no longer exists.
 */
export async function loadProjectOnStartup(): Promise<ProjectDirectoryResult | null> {
  const saved = await getSavedProjectPath();

  if (!saved.path) {
    return null;
  }

  if (!saved.exists) {
    // Path no longer exists; it has been auto-cleared by the backend
    return null;
  }

  return {
    path: saved.path,
    has_tasks_dir: saved.has_tasks_dir,
  };
}
