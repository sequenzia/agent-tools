import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { Priority, Complexity, AcceptanceCriteria } from "../types";
import type { TasksByStatus } from "../services/task-service";

// --- Shared field wrapper with save/cancel ---

interface FieldEditorWrapperProps {
  label: string;
  isSaving: boolean;
  error: string | null;
  warning: string | null;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export function FieldEditorWrapper({
  label,
  isSaving,
  error,
  warning,
  onSave,
  onCancel,
  children,
}: FieldEditorWrapperProps) {
  return (
    <div className="space-y-2" data-testid={`field-editor-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Editing: {label}
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
            data-testid="field-cancel-button"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            data-testid="field-save-button"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {children}

      {error && (
        <p
          className="text-xs text-red-600 dark:text-red-400"
          data-testid="field-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {warning && !error && (
        <p
          className="text-xs text-amber-600 dark:text-amber-400"
          data-testid="field-warning"
          role="status"
        >
          {warning}
        </p>
      )}
    </div>
  );
}

// --- Priority Dropdown ---

const PRIORITY_OPTIONS: Priority[] = ["critical", "high", "medium", "low"];

interface PriorityEditorProps {
  value: Priority | undefined;
  onChange: (value: Priority | undefined) => void;
}

export function PriorityEditor({ value, onChange }: PriorityEditorProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : (v as Priority));
      }}
      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      data-testid="priority-select"
      aria-label="Select priority level"
    >
      <option value="">-- No priority --</option>
      {PRIORITY_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

// --- Complexity Dropdown ---

const COMPLEXITY_OPTIONS: Complexity[] = ["XS", "S", "M", "L", "XL"];

interface ComplexityEditorProps {
  value: Complexity | undefined;
  onChange: (value: Complexity | undefined) => void;
}

export function ComplexityEditor({ value, onChange }: ComplexityEditorProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : (v as Complexity));
      }}
      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      data-testid="complexity-select"
      aria-label="Select complexity level"
    >
      <option value="">-- No complexity --</option>
      {COMPLEXITY_OPTIONS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

// --- Blocked By Multi-Select with Search ---

interface BlockedByEditorProps {
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  allTasks: TasksByStatus;
  currentTaskId: string | number;
}

export function BlockedByEditor({
  value,
  onChange,
  allTasks,
  currentTaskId,
}: BlockedByEditorProps) {
  const [searchText, setSearchText] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Collect all tasks from all statuses
  const allTaskEntries = (() => {
    const entries: Array<{ id: string; title: string }> = [];
    for (const status of ["backlog", "pending", "in_progress", "completed"] as const) {
      for (const twp of allTasks[status]) {
        const id = String(twp.task.id);
        if (id !== String(currentTaskId)) {
          entries.push({ id, title: twp.task.title });
        }
      }
    }
    return entries;
  })();

  // Filter by search text
  const filteredEntries = searchText.trim()
    ? allTaskEntries.filter(
        (entry) =>
          entry.id.includes(searchText) ||
          entry.title.toLowerCase().includes(searchText.toLowerCase()),
      )
    : allTaskEntries;

  const selectedIds = useMemo(() => new Set(value.map(String)), [value]);

  const toggleId = useCallback(
    (id: string) => {
      if (selectedIds.has(id)) {
        onChange(value.filter((v) => String(v) !== id));
      } else {
        onChange([...value, id]);
      }
    },
    [value, onChange, selectedIds],
  );

  const removeId = useCallback(
    (id: string) => {
      onChange(value.filter((v) => String(v) !== id));
    },
    [value, onChange],
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {/* Selected items as chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid="blocked-by-chips">
          {value.map((id) => {
            const idStr = String(id);
            const entry = allTaskEntries.find((e) => e.id === idStr);
            return (
              <span
                key={idStr}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                #{idStr}
                {entry ? `: ${entry.title}` : " (unknown)"}
                <button
                  onClick={() => removeId(idStr)}
                  className="ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label={`Remove dependency ${idStr}`}
                  data-testid={`remove-dep-${idStr}`}
                >
                  x
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          placeholder="Search tasks by ID or title..."
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          data-testid="blocked-by-search"
          aria-label="Search tasks to add as dependencies"
          role="combobox"
          aria-expanded={isDropdownOpen}
          aria-controls="blocked-by-listbox"
        />

        {/* Dropdown list */}
        {isDropdownOpen && (
          <div
            className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
            data-testid="blocked-by-dropdown"
            id="blocked-by-listbox"
            role="listbox"
            aria-label="Available tasks to add as dependencies"
          >
            {filteredEntries.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500">
                No tasks found
              </p>
            ) : (
              filteredEntries.map((entry) => {
                const isSelected = selectedIds.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    onClick={() => toggleId(entry.id)}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
                    data-testid={`dep-option-${entry.id}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`Task #${entry.id}: ${entry.title}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span className="shrink-0 text-xs text-gray-400">
                      #{entry.id}
                    </span>
                    <span className="truncate text-gray-700 dark:text-gray-300">
                      {entry.title}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Acceptance Criteria Text Areas ---

const AC_CATEGORIES = [
  { key: "functional" as const, label: "Functional" },
  { key: "edge_cases" as const, label: "Edge Cases" },
  { key: "error_handling" as const, label: "Error Handling" },
  { key: "performance" as const, label: "Performance" },
];

interface AcceptanceCriteriaEditorProps {
  value: AcceptanceCriteria;
  onChange: (value: AcceptanceCriteria) => void;
}

export function AcceptanceCriteriaEditor({
  value,
  onChange,
}: AcceptanceCriteriaEditorProps) {
  const handleCategoryChange = useCallback(
    (category: keyof AcceptanceCriteria, text: string) => {
      // Split by newlines, filter out empty lines
      const items = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      onChange({ ...value, [category]: items });
    },
    [value, onChange],
  );

  return (
    <div className="space-y-3" data-testid="ac-editor">
      {AC_CATEGORIES.map(({ key, label }) => {
        const items = value[key] ?? [];
        const text = items.join("\n");
        return (
          <div key={key}>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {label}
            </label>
            <textarea
              value={text}
              onChange={(e) => handleCategoryChange(key, e.target.value)}
              rows={Math.max(2, items.length + 1)}
              placeholder={`Enter ${label.toLowerCase()} criteria (one per line)...`}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              data-testid={`ac-textarea-${key}`}
            />
          </div>
        );
      })}
    </div>
  );
}
