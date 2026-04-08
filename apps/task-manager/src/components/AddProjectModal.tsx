import { useState, useEffect, useRef, useCallback } from "react";
import { DirectoryBrowser } from "./DirectoryBrowser";

interface AddProjectModalProps {
  onSubmit: (path: string) => Promise<void>;
  onCancel: () => void;
}

export function AddProjectModal({ onSubmit, onCancel }: AddProjectModalProps) {
  const [pathInput, setPathInput] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape key (only when not browsing)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !browsing) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, browsing]);

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current && !browsing) {
      onCancel();
    }
  }

  const handleSubmit = useCallback(async (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add project");
      setIsSubmitting(false);
    }
  }, [onSubmit]);

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(pathInput);
  }, [handleSubmit, pathInput]);

  const handleBrowseSelect = useCallback((path: string) => {
    setBrowsing(false);
    handleSubmit(path);
  }, [handleSubmit]);

  // If the DirectoryBrowser is open, render it instead
  if (browsing) {
    return (
      <DirectoryBrowser
        onSelect={handleBrowseSelect}
        onCancel={() => setBrowsing(false)}
      />
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-label="Add project"
      aria-modal="true"
    >
      <div className="mx-4 flex w-full max-w-md flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add Project
          </h2>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleFormSubmit} className="px-5 py-4">
          <label
            htmlFor="project-path-input"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Project directory path
          </label>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Enter the path to a project with an <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">.agents/tasks/</code> directory.
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="project-path-input"
              type="text"
              value={pathInput}
              onChange={(e) => {
                setPathInput(e.currentTarget.value);
                setError(null);
              }}
              placeholder="/path/to/project"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400"
              disabled={isSubmitting}
              data-testid="add-project-path-input"
            />
            <button
              type="button"
              onClick={() => setBrowsing(true)}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              disabled={isSubmitting}
              data-testid="add-project-browse-btn"
            >
              Browse...
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            disabled={isSubmitting}
            data-testid="add-project-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(pathInput)}
            disabled={!pathInput.trim() || isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            data-testid="add-project-submit-btn"
          >
            {isSubmitting ? "Adding..." : "Open"}
          </button>
        </div>
      </div>
    </div>
  );
}
