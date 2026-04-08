import { useState, useEffect, useCallback } from "react";
import { useProjectDirectory } from "./hooks/use-project-directory";
import { KanbanBoard } from "./components/KanbanBoard";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { DirectoryBrowser } from "./components/DirectoryBrowser";
import { AddProjectModal } from "./components/AddProjectModal";
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
  const [showAddProject, setShowAddProject] = useState(false);
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

  const handleAddProject = useCallback(() => {
    setShowAddProject(true);
  }, []);

  const handleAddProjectSubmit = useCallback(async (path: string) => {
    setShowAddProject(false);
    await submitDirectoryPath(path);
  }, [submitDirectoryPath]);

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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
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
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3.5 dark:border-gray-700/50 dark:bg-gray-900/80 backdrop-blur-sm">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">Task Manager</h1>

            {isLoading ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Loading...
              </span>
            ) : currentProjectPath ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                  {currentProjectPath}
                </span>
                {hasTasksDir && (
                  <span className="text-xs text-green-600 dark:text-green-400">
                    connected
                  </span>
                )}
                <button
                  onClick={clearProject}
                  className="rounded border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Clear
                </button>
              </div>
            ) : (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddProject();
                }}
              >
                <input
                  className="w-72 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={directoryInput}
                  onChange={(e) => setDirectoryInput(e.currentTarget.value)}
                  placeholder="Enter project directory path..."
                />
                <button
                  type="button"
                  onClick={() => setShowBrowser(true)}
                  className="rounded border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Browse
                </button>
                <button
                  type="submit"
                  disabled={!directoryInput.trim()}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Open
                </button>
              </form>
            )}
          </div>

          {projectWarning && (
            <div className="border-b border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30 px-6 py-2 text-sm text-yellow-800 dark:text-yellow-300">
              Warning: {projectWarning}
            </div>
          )}

          {projectError && (
            <div className="border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-6 py-2 text-sm text-red-800 dark:text-red-300">
              Error: {projectError}
            </div>
          )}

          {/* Kanban board — fills remaining space */}
          {currentProjectPath ? (
            <div className="flex-1 overflow-hidden">
              <ErrorBoundary sectionName="Kanban Board" onError={handleBoundaryError}>
                <KanbanBoard projectPath={currentProjectPath} />
              </ErrorBoundary>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-gray-400 dark:text-gray-500">
                Select a project directory to view tasks
              </p>
            </div>
          )}
        </main>
      )}

      {/* Add project modal */}
      {showAddProject && (
        <AddProjectModal
          onSubmit={handleAddProjectSubmit}
          onCancel={() => setShowAddProject(false)}
        />
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
