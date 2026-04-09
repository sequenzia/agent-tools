import { useState, useEffect, useCallback } from "react";
import { KanbanBoard } from "./components/KanbanBoard";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { SettingsPanel } from "./components/SettingsPanel";
import { AddProjectModal } from "./components/AddProjectModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/ToastContainer";
import { LiveRegionProvider } from "./components/LiveRegion";
import { useToastStore } from "./stores/toast-store";
import { useSettingsStore } from "./stores/settings-store";
import {
  useProjectStore,
  getDirectoryName,
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
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [windowNarrow, setWindowNarrow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);

  const sidebarCollapsed = userCollapsed || windowNarrow;

  const settingsLoad = useSettingsStore((s) => s.load);
  const initialize = useProjectStore((s) => s.initialize);
  const activeProjectPath = useProjectStore((s) => s.activeProjectPath);
  const isLoading = useProjectStore((s) => s.isLoading);
  const initError = useProjectStore((s) => s.initError);

  // Initialize settings and project store on mount
  useEffect(() => {
    settingsLoad();
    initialize();
  }, [settingsLoad, initialize]);

  // Show initialization errors as toasts
  useEffect(() => {
    if (initError) {
      useToastStore.getState().addToast("error", "Initialization error", initError);
    }
  }, [initError]);

  // Track narrow viewport for auto-collapse (user preference persists separately)
  useEffect(() => {
    function handleResize() {
      setWindowNarrow(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setUserCollapsed((prev) => !prev);
  }, []);

  const handleAddProject = useCallback(() => {
    setShowAddProject(true);
  }, []);

  const handleAddProjectSubmit = useCallback(async (path: string) => {
    setShowAddProject(false);
    try {
      await useProjectStore.getState().addProjectFromPath(path);
    } catch (err) {
      useToastStore.getState().addToast(
        "error",
        "Failed to add project",
        err instanceof Error ? err.message : String(err),
      );
    }
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  // Derive display name for the active project
  const activeDisplayName = activeProjectPath ? getDirectoryName(activeProjectPath) : null;

  return (
    <LiveRegionProvider>
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <ErrorBoundary sectionName="Sidebar" onError={handleBoundaryError}>
        <ProjectSidebar
          onAddProject={handleAddProject}
          collapsed={sidebarCollapsed}
          onOpenSettings={handleOpenSettings}
          onToggleCollapse={handleToggleSidebar}
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
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">Agent Task Manager</h1>

            {isLoading ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Loading...
              </span>
            ) : activeDisplayName ? (
              <span
                className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate max-w-md"
                title={activeProjectPath ?? undefined}
              >
                {activeDisplayName}
              </span>
            ) : null}
          </div>

          {/* Kanban board — fills remaining space */}
          {activeProjectPath ? (
            <div className="flex-1 overflow-hidden">
              <ErrorBoundary sectionName="Kanban Board" onError={handleBoundaryError}>
                <KanbanBoard projectPath={activeProjectPath} />
              </ErrorBoundary>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-gray-400 dark:text-gray-500">
                Add a project from the sidebar to get started
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

      {/* Global toast notifications */}
      <ToastContainer />
    </div>
    </LiveRegionProvider>
  );
}

export default App;
