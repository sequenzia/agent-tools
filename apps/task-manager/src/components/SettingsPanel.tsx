import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settings-store";
import type { ColumnVisibility, ViewMode, CardDensity } from "../types/settings";

// --- Section Header ---

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
      {title}
    </h3>
  );
}

// --- Root Directory Item ---

function RootDirectoryItem({
  path,
  onRemove,
}: {
  path: string;
  onRemove: (path: string) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
      data-testid={`root-dir-${path}`}
    >
      <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
        {path}
      </span>
      <button
        type="button"
        className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
        onClick={() => onRemove(path)}
        data-testid={`remove-root-dir-btn`}
        aria-label={`Remove directory: ${path}`}
      >
        Remove
      </button>
    </div>
  );
}

// --- Root Directories Section ---

function RootDirectoriesSection() {
  const { settings, addRootDirectory, removeRootDirectory } =
    useSettingsStore();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddDirectory = useCallback(async () => {
    setIsAdding(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ path: string } | null>(
        "select_project_directory",
      );
      if (result && result.path) {
        await addRootDirectory(result.path);
      }
    } catch {
      // User cancelled or IPC error — ignore
    } finally {
      setIsAdding(false);
    }
  }, [addRootDirectory]);

  return (
    <section data-testid="settings-root-dirs">
      <SectionHeader title="Root Directories for Auto-Discovery" />
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Directories to scan for projects containing .agents/tasks/. Projects are
        discovered automatically from these roots.
      </p>

      <div className="space-y-2">
        {settings.rootDirectories.length === 0 ? (
          <p
            className="text-sm italic text-gray-400 dark:text-gray-500"
            data-testid="no-root-dirs"
          >
            No root directories configured
          </p>
        ) : (
          settings.rootDirectories.map((dir) => (
            <RootDirectoryItem
              key={dir}
              path={dir}
              onRemove={removeRootDirectory}
            />
          ))
        )}
      </div>

      <button
        type="button"
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
        onClick={handleAddDirectory}
        disabled={isAdding}
        data-testid="add-root-dir-btn"
      >
        <span className="text-lg leading-none">+</span>
        <span>{isAdding ? "Selecting..." : "Add Directory"}</span>
      </button>
    </section>
  );
}

// --- View Mode Selector ---

function ViewModeSelector() {
  const { settings, setDefaultView } = useSettingsStore();
  const currentView = settings.uiPreferences.defaultView;

  const options: { value: ViewMode; label: string }[] = [
    { value: "kanban", label: "Kanban Board" },
    { value: "list", label: "List View" },
  ];

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
        Default View
      </label>
      <div className="flex gap-2" data-testid="view-mode-selector">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              currentView === opt.value
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            onClick={() => setDefaultView(opt.value)}
            data-testid={`view-mode-${opt.value}`}
            aria-pressed={currentView === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Column Visibility Toggles ---

const COLUMN_LABELS: Record<keyof ColumnVisibility, string> = {
  backlog: "Backlog",
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
  failed: "Failed",
};

function ColumnVisibilitySection() {
  const { settings, toggleColumnVisibility } = useSettingsStore();
  const vis = settings.uiPreferences.columnVisibility;

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
        Column Visibility
      </label>
      <div
        className="grid grid-cols-2 gap-2"
        data-testid="column-visibility-toggles"
      >
        {(Object.keys(COLUMN_LABELS) as (keyof ColumnVisibility)[]).map(
          (col) => (
            <label
              key={col}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <input
                type="checkbox"
                checked={!!vis[col]}
                onChange={() => toggleColumnVisibility(col)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                data-testid={`col-toggle-${col}`}
              />
              {COLUMN_LABELS[col]}
            </label>
          ),
        )}
      </div>
    </div>
  );
}

// --- Card Density Selector ---

function CardDensitySelector() {
  const { settings, setCardDensity } = useSettingsStore();
  const currentDensity = settings.uiPreferences.cardDensity;

  const options: { value: CardDensity; label: string }[] = [
    { value: "compact", label: "Compact" },
    { value: "comfortable", label: "Comfortable" },
    { value: "spacious", label: "Spacious" },
  ];

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
        Card Density
      </label>
      <div className="flex gap-2" data-testid="card-density-selector">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              currentDensity === opt.value
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            onClick={() => setCardDensity(opt.value)}
            data-testid={`card-density-${opt.value}`}
            aria-pressed={currentDensity === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- UI Preferences Section ---

function UIPreferencesSection() {
  return (
    <section data-testid="settings-ui-prefs">
      <SectionHeader title="UI Preferences" />
      <ViewModeSelector />
      <ColumnVisibilitySection />
      <CardDensitySelector />
    </section>
  );
}

// --- Main Settings Panel ---

export interface SettingsPanelProps {
  /** Called when the panel should close. */
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { isLoaded, isSaving, saveError, load, resetToDefaults } =
    useSettingsStore();

  useEffect(() => {
    if (!isLoaded) {
      load();
    }
  }, [isLoaded, load]);

  const handleReset = useCallback(async () => {
    await resetToDefaults();
  }, [resetToDefaults]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="flex h-full flex-col bg-white dark:bg-gray-900"
      data-testid="settings-panel"
      role="dialog"
      aria-label="App Settings"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Settings
        </h2>
        <button
          type="button"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          onClick={onClose}
          data-testid="settings-close-btn"
          aria-label="Close settings"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!isLoaded ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading settings...
          </p>
        ) : (
          <div className="space-y-8">
            <RootDirectoriesSection />
            <UIPreferencesSection />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-3 dark:border-gray-700">
        {saveError && (
          <p
            className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
            data-testid="settings-save-error"
            role="alert"
          >
            {saveError}
          </p>
        )}
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            onClick={handleReset}
            data-testid="settings-reset-btn"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            {isSaving && (
              <span
                className="text-xs text-gray-500 dark:text-gray-400"
                data-testid="settings-saving-indicator"
              >
                Saving...
              </span>
            )}
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              onClick={onClose}
              data-testid="settings-done-btn"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
