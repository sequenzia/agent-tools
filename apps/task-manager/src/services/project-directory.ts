import { invoke } from "@tauri-apps/api/core";

/**
 * Result returned when a project directory is selected or validated.
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
 * Open a native directory picker dialog.
 * Returns the selected directory info, or null if the user cancels.
 */
export async function selectProjectDirectory(): Promise<ProjectDirectoryResult | null> {
  return invoke<ProjectDirectoryResult | null>("select_project_directory");
}

/**
 * Validate a directory path: checks existence, permissions, and .agents/tasks/ presence.
 * Throws an error string on permission denied or non-existent path.
 */
export async function validateProjectDirectory(
  path: string,
): Promise<ProjectDirectoryResult> {
  return invoke<ProjectDirectoryResult>("validate_project_directory", { path });
}

/**
 * Save a project directory path to persistent storage.
 */
export async function saveProjectPath(path: string): Promise<void> {
  return invoke<void>("save_project_path", { path });
}

/**
 * Load the previously saved project directory from persistent storage.
 * If the saved directory no longer exists, the saved path is cleared automatically.
 */
export async function getSavedProjectPath(): Promise<SavedProjectDirectory> {
  return invoke<SavedProjectDirectory>("get_saved_project_path");
}

/**
 * Clear the saved project directory path from persistent storage.
 */
export async function clearSavedProjectPath(): Promise<void> {
  return invoke<void>("clear_saved_project_path");
}

/**
 * Select a project directory via the native dialog, validate it, and persist it.
 * Returns null if the user cancels. Shows a warning via callback if no .agents/tasks/ found.
 */
export async function selectAndSaveProjectDirectory(
  onNoTasksDir?: (path: string) => void,
): Promise<ProjectDirectoryResult | null> {
  const result = await selectProjectDirectory();
  if (!result) {
    return null;
  }

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
