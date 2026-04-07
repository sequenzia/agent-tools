import { useCallback, useEffect } from "react";
import { SpecViewer } from "./SpecViewer";

// --- Types ---

interface SpecViewerPanelProps {
  /** Absolute path to the project root directory. */
  projectPath: string;
  /** Spec file path (relative to project root or absolute). */
  specPath: string;
  /** Optional section anchor to scroll to on load. */
  scrollToSection?: string;
  /** Called when the user clicks the back button to return to the task detail. */
  onBack: () => void;
  /** The title of the source task for the back-link label. */
  sourceTaskTitle?: string;
}

/**
 * A full-screen overlay panel that wraps the SpecViewer with a back navigation
 * header. Opened from the task detail panel's source_section link.
 */
export function SpecViewerPanel({
  projectPath,
  specPath,
  scrollToSection,
  onBack,
  sourceTaskTitle,
}: SpecViewerPanelProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
      }
    },
    [onBack],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-900"
      data-testid="spec-viewer-panel"
      role="dialog"
      aria-label={`Spec viewer: ${specPath}`}
    >
      {/* Back navigation header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
          data-testid="spec-viewer-back-button"
          aria-label={
            sourceTaskTitle
              ? `Back to task: ${sourceTaskTitle}`
              : "Back to task detail"
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            {sourceTaskTitle
              ? `Back to "${sourceTaskTitle}"`
              : "Back to task"}
          </span>
        </button>

        <div className="flex-1" />

        <span
          className="truncate text-sm text-gray-500 dark:text-gray-400"
          data-testid="spec-viewer-path"
        >
          {specPath}
        </span>

        <button
          onClick={onBack}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label="Close spec viewer"
          data-testid="spec-viewer-close-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Spec viewer content */}
      <div className="flex-1 overflow-y-auto p-4" data-testid="spec-viewer-content">
        <SpecViewer
          projectPath={projectPath}
          specPath={specPath}
          scrollToSection={scrollToSection}
        />
      </div>
    </div>
  );
}
