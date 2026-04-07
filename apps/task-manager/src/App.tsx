import { useState, useEffect, useCallback } from "react";
import { useProjectDirectory } from "./hooks/use-project-directory";
import { TaskList } from "./components/TaskList";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { DirectoryBrowser } from "./components/DirectoryBrowser";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/ToastContainer";
import { LiveRegionProvider } from "./components/LiveRegion";
import { useToastStore } from "./stores/toast-store";
import { useSettingsStore } from "./stores/settings-store";
import {
  useProjectStore,
  getDirectoryName,
  type ProjectEntry,
} from "./stores/project-store";

/** Callback for ErrorBoundary errors — surfaces as toast for non-fatal awareness. */
function handleBoundaryError(error: Error, sectionName: string) {
  useToastStore.getState().addToast(
    "error",
    `${sectionName} error`,
    error.message,
  );
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [directoryInput, setDirectoryInput] = useState("");

  const settingsLoad = useSettingsStore((s) => s.load);

  // Load settings on mount
  useEffect(() => {
    settingsLoad();
  }, [settingsLoad]);

  const {
    projectPath,
    hasTasksDir,
    isLoading,
    error: projectError,
    warning: projectWarning,
    submitDirectoryPath,
    clearProject,
  } = useProjectDirectory();

  const {
    projects,
    activeProjectPath,
    activeTaskGroups,
    addProject,
    setActiveProject,
  } = useProjectStore();

  // Sync the legacy projectPath from the hook with the project store
  useEffect(() => {
    if (projectPath && !projects.some((p) => p.path === projectPath)) {
      const entry: ProjectEntry = {
        path: projectPath,
        name: getDirectoryName(projectPath),
        connected: true,
        counts: { pending: 0, in_progress: 0, completed: 0, total: 0 },
        taskGroups: [],
      };
      addProject(entry);
      setActiveProject(projectPath);
    }
  }, [projectPath, projects, addProject, setActiveProject]);

  // Handle narrow window collapse
  useEffect(() => {
    function handleResize() {
      setSidebarCollapsed(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleAddProject = useCallback(async () => {
    if (directoryInput.trim()) {
      await submitDirectoryPath(directoryInput.trim());
      setDirectoryInput("");
    }
  }, [directoryInput, submitDirectoryPath]);

  const handleBrowseSelect = useCallback(async (path: string) => {
    setShowBrowser(false);
    await submitDirectoryPath(path);
  }, [submitDirectoryPath]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const currentProjectPath = activeProjectPath ?? projectPath;

  return (
    <LiveRegionProvider>
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <ErrorBoundary sectionName="Sidebar" onError={handleBoundaryError}>
        <ProjectSidebar
          onAddProject={handleAddProject}
          collapsed={sidebarCollapsed}
          onOpenSettings={handleOpenSettings}
        />
      </ErrorBoundary>

      {/* Settings Panel (replaces main content when open) */}
      {showSettings ? (
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl h-full">
            <ErrorBoundary sectionName="Settings" onError={handleBoundaryError}>
              <SettingsPanel onClose={handleCloseSettings} />
            </ErrorBoundary>
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-12">
            <h1 className="text-4xl font-bold text-center mb-8">Task Manager</h1>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-10">
              SDD Pipeline Task Visualization
            </p>

            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Project Directory</h2>

              {isLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Loading saved project...
                </p>
              ) : currentProjectPath ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm truncate">
                      {currentProjectPath}
                    </div>
                    <button
                      onClick={clearProject}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  {hasTasksDir ? (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      .agents/tasks/ directory found
                    </p>
                  ) : null}

                  {activeTaskGroups.size > 0 && (
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Filtered by task group{activeTaskGroups.size > 1 ? "s" : ""}:{" "}
                      <span className="font-medium">{Array.from(activeTaskGroups).join(", ")}</span>
                    </p>
                  )}
                </div>
              ) : (
                <form
                  className="flex gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddProject();
                  }}
                >
                  <input
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={directoryInput}
                    onChange={(e) => setDirectoryInput(e.currentTarget.value)}
                    placeholder="Enter project directory path..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowBrowser(true)}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Browse
                  </button>
                  <button
                    type="submit"
                    disabled={!directoryInput.trim()}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Open
                  </button>
                </form>
              )}

              {projectWarning && (
                <p className="mt-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                  Warning: {projectWarning}
                </p>
              )}

              {projectError && (
                <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-300">
                  Error: {projectError}
                </p>
              )}
            </section>

            {currentProjectPath && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4">Tasks</h2>
                <ErrorBoundary sectionName="Task List" onError={handleBoundaryError}>
                  <TaskList projectPath={currentProjectPath} />
                </ErrorBoundary>
              </section>
            )}

            <footer className="text-center text-xs text-gray-400 dark:text-gray-500">
              Built with React 19 + Vite + Tailwind CSS
            </footer>
          </div>
        </main>
      )}

      {/* Directory browser modal */}
      {showBrowser && (
        <DirectoryBrowser
          onSelect={handleBrowseSelect}
          onCancel={() => setShowBrowser(false)}
        />
      )}

      {/* Global toast notifications */}
      <ToastContainer />
    </div>
    </LiveRegionProvider>
  );
}

export default App;
