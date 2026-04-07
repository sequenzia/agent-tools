import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "../stores/settings-store";
import type { ColumnVisibility, ViewMode, CardDensity, BoardColumnValue } from "../types/settings";
import { DEFAULT_COLUMN_ORDER } from "../types/settings";

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
  const [newDir, setNewDir] = useState("");

  const handleAddDirectory = useCallback(async () => {
    const trimmed = newDir.trim();
    if (!trimmed) return;
    await addRootDirectory(trimmed);
    setNewDir("");
  }, [newDir, addRootDirectory]);

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

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleAddDirectory();
        }}
      >
        <input
          className="flex-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newDir}
          onChange={(e) => setNewDir(e.currentTarget.value)}
          placeholder="Enter directory path..."
          data-testid="add-root-dir-input"
        />
        <button
          type="submit"
          className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-400 disabled:opacity-50"
          disabled={!newDir.trim()}
          data-testid="add-root-dir-btn"
        >
          <span className="text-lg leading-none">+</span>
          <span> Add</span>
        </button>
      </form>
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

// --- Column Order Section ---

const ORDER_COLUMN_LABELS: Record<BoardColumnValue, string> = {
  backlog: "Backlog",
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
  failed: "Failed",
};

function ColumnOrderSection() {
  const { settings, setColumnOrder } = useSettingsStore();
  const columnOrder = useMemo(
    () => (settings.uiPreferences.columnOrder ?? [...DEFAULT_COLUMN_ORDER]) as BoardColumnValue[],
    [settings.uiPreferences.columnOrder],
  );

  const moveColumn = useCallback(
    (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= columnOrder.length) return;
      const newOrder = [...columnOrder];
      const [moved] = newOrder.splice(index, 1);
      newOrder.splice(newIndex, 0, moved);
      void setColumnOrder(newOrder);
    },
    [columnOrder, setColumnOrder],
  );

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
        Column Order
      </label>
      <div className="space-y-1" data-testid="column-order-list">
        {columnOrder.map((col, idx) => (
          <div
            key={col}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-600 dark:bg-gray-800"
            data-testid={`column-order-${col}`}
          >
            {/* Grip icon (decorative) */}
            <svg className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="3" r="1.5" />
              <circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" />
              <circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" />
              <circle cx="11" cy="13" r="1.5" />
            </svg>
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {ORDER_COLUMN_LABELS[col]}
            </span>
            <button
              type="button"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              onClick={() => moveColumn(idx, -1)}
              disabled={idx === 0}
              aria-label={`Move ${ORDER_COLUMN_LABELS[col]} up`}
              data-testid={`column-order-up-${col}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              onClick={() => moveColumn(idx, 1)}
              disabled={idx === columnOrder.length - 1}
              aria-label={`Move ${ORDER_COLUMN_LABELS[col]} down`}
              data-testid={`column-order-down-${col}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
        ))}
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
      <ColumnOrderSection />
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
