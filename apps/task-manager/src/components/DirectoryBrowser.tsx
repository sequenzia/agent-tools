import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api-client";

interface DirectoryEntry {
  name: string;
  path: string;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  directories: DirectoryEntry[];
}

interface DirectoryBrowserProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
}

export function DirectoryBrowser({ onSelect, onCancel }: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const browse = useCallback(async (path?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (path) params.path = path;
      const result = await api.get<BrowseResult>("/api/projects/browse", params);
      setCurrentPath(result.current);
      setParentPath(result.parent);
      setDirectories(result.directories);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load initial directory (home)
  useEffect(() => {
    browse();
  }, [browse]);

  // Scroll list to top when navigating
  useEffect(() => {
    listRef.current?.scrollTo(0, 0);
  }, [currentPath]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onCancel();
  }

  // Split path into breadcrumb segments
  const pathSegments = currentPath.split("/").filter(Boolean);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="mx-4 flex w-full max-w-xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
           style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Browse Directory
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

        {/* Breadcrumb path */}
        <div className="border-b border-gray-200 px-5 py-2.5 dark:border-gray-700">
          <div className="flex items-center gap-1 overflow-x-auto text-sm">
            <button
              onClick={() => browse("/")}
              className="shrink-0 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              /
            </button>
            {pathSegments.map((segment, i) => {
              const segmentPath = "/" + pathSegments.slice(0, i + 1).join("/");
              const isLast = i === pathSegments.length - 1;
              return (
                <span key={segmentPath} className="flex items-center gap-1">
                  <span className="text-gray-400 dark:text-gray-500">/</span>
                  {isLast ? (
                    <span className="rounded px-1.5 py-0.5 font-medium text-gray-900 dark:text-gray-100">
                      {segment}
                    </span>
                  ) : (
                    <button
                      onClick={() => browse(segmentPath)}
                      className="rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                      {segment}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Directory listing */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
            </div>
          ) : error ? (
            <div className="px-5 py-8">
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </p>
            </div>
          ) : (
            <ul ref={listRef} className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
              {parentPath && (
                <li>
                  <button
                    onClick={() => browse(parentPath)}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="text-gray-500 dark:text-gray-400">..</span>
                  </button>
                </li>
              )}
              {directories.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No subdirectories
                </li>
              )}
              {directories.map((dir) => (
                <li key={dir.path}>
                  <button
                    onClick={() => browse(dir.path)}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="truncate text-gray-800 dark:text-gray-200">{dir.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <span className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400" title={currentPath}>
            {currentPath}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => onSelect(currentPath)}
              disabled={!currentPath}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
