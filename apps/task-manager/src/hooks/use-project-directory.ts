import { useState, useEffect, useCallback } from "react";
import {
  validateAndSaveProjectDirectory,
  loadProjectOnStartup,
  clearSavedProjectPath,
} from "../services/project-directory";

export interface UseProjectDirectoryState {
  /** The current project directory path, or null if none selected. */
  projectPath: string | null;
  /** Whether the current project has a .agents/tasks/ directory. */
  hasTasksDir: boolean;
  /** Whether the hook is loading the saved project on startup. */
  isLoading: boolean;
  /** Error message, if any. */
  error: string | null;
  /** Warning message (e.g., no .agents/tasks/ found). */
  warning: string | null;
  /** Submit a directory path (replaces the native dialog picker). */
  submitDirectoryPath: (path: string) => Promise<void>;
  /** Clear the current project selection. */
  clearProject: () => Promise<void>;
}

export function useProjectDirectory(): UseProjectDirectoryState {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [hasTasksDir, setHasTasksDir] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Load saved project on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await loadProjectOnStartup();
        if (cancelled) return;

        if (result) {
          setProjectPath(result.path);
          setHasTasksDir(result.has_tasks_dir);
          if (!result.has_tasks_dir) {
            setWarning(`No .agents/tasks/ directory found in ${result.path}`);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitDirectoryPath = useCallback(async (dirPath: string) => {
    try {
      setError(null);
      setWarning(null);

      const result = await validateAndSaveProjectDirectory(dirPath, (path) => {
        setWarning(`No .agents/tasks/ directory found in ${path}`);
      });

      if (result) {
        setProjectPath(result.path);
        setHasTasksDir(result.has_tasks_dir);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const clearProject = useCallback(async () => {
    try {
      await clearSavedProjectPath();
      setProjectPath(null);
      setHasTasksDir(false);
      setWarning(null);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  return {
    projectPath,
    hasTasksDir,
    isLoading,
    error,
    warning,
    submitDirectoryPath,
    clearProject,
  };
}
