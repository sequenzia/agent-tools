import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useSessionHistoryStore,
  SESSIONS_PER_PAGE,
} from "../stores/session-history-store";
import type {
  ArchivedSessionInfo,
  SessionFileResult,
} from "../services/session-service";

// --- Props ---

interface SessionHistoryBrowserProps {
  /** Absolute path to the project root directory. */
  projectPath: string;
}

// --- Session Detail View ---

/** Known session files that can be viewed in detail, in display order. */
const DETAIL_TABS = [
  { key: "session_summary.md", label: "Summary" },
  { key: "execution_plan.md", label: "Execution Plan" },
  { key: "task_log.md", label: "Task Log" },
  { key: "execution_context.md", label: "Context" },
  { key: "progress.md", label: "Progress" },
] as const;

function SessionDetailView({
  session,
  projectPath,
}: {
  session: ArchivedSessionInfo;
  projectPath: string;
}) {
  const { fetchSessionFile, selectedSessionFiles, isLoadingFile, selectSession } =
    useSessionHistoryStore();
  const [activeTab, setActiveTab] = useState<string>(
    session.has_summary ? "session_summary.md" : "execution_plan.md",
  );

  // Filter tabs to only those that exist in the session
  const availableTabs = DETAIL_TABS.filter((tab) =>
    session.available_files.includes(tab.key),
  );

  const loadFile = useCallback(
    async (filename: string) => {
      await fetchSessionFile(projectPath, session.name, filename);
    },
    [fetchSessionFile, projectPath, session.name],
  );

  // Load the active tab's file when it changes
  useEffect(() => {
    if (activeTab && !selectedSessionFiles.has(activeTab)) {
      loadFile(activeTab);
    }
  }, [activeTab, selectedSessionFiles, loadFile]);

  const currentFile: SessionFileResult | undefined =
    selectedSessionFiles.get(activeTab);

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <button
          onClick={() => selectSession(null)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label="Back to session list"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
            {session.name}
          </h2>
          {session.summary && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {session.summary.tasks_passed} passed, {session.summary.tasks_failed} failed
              {" / "}
              {session.summary.tasks_total} total
            </p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      {availableTabs.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-700">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200"
              }`}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {availableTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No session files available
            </p>
          </div>
        ) : isLoadingFile && !currentFile ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400"
              role="status"
              aria-label="Loading file"
            />
          </div>
        ) : currentFile?.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">
              {currentFile.error}
            </p>
          </div>
        ) : currentFile?.content ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentFile.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              File not found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Session List Item ---

function SessionListItem({
  session,
  onSelect,
}: {
  session: ArchivedSessionInfo;
  onSelect: (name: string) => void;
}) {
  const timestamp = formatSessionTimestamp(session.name);
  const hasError = session.error !== null;

  return (
    <button
      onClick={() => onSelect(session.name)}
      className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
      data-testid={`session-item-${session.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {session.name}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {timestamp}
          </p>
        </div>

        {hasError ? (
          <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
            Error
          </span>
        ) : session.summary ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {session.summary.tasks_passed > 0 && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                {session.summary.tasks_passed} passed
              </span>
            )}
            {session.summary.tasks_failed > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                {session.summary.tasks_failed} failed
              </span>
            )}
          </div>
        ) : (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            No summary
          </span>
        )}
      </div>

      {/* File count indicator */}
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {session.available_files.length} file{session.available_files.length !== 1 ? "s" : ""}
      </p>
    </button>
  );
}

// --- Pagination ---

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
        aria-label="Previous page"
      >
        Previous
      </button>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}

// --- Empty State ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 dark:border-gray-600">
      <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
        No previous sessions
      </p>
      <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
        Completed execution sessions will appear here.
      </p>
    </div>
  );
}

// --- Loading State ---

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400"
        role="status"
        aria-label="Loading sessions"
      />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading session history...
      </p>
    </div>
  );
}

// --- Error State ---

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
      <p className="font-medium text-red-800 dark:text-red-300">
        Failed to load session history
      </p>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}

// --- Helper: format session name into readable timestamp ---

function formatSessionTimestamp(name: string): string {
  // Try to extract timestamp from common session name formats:
  // - "exec-session-20260406-140000"
  // - "task-group-20260406-140000"
  // - "2026-04-06T14-30-00"
  // - "interrupted-20260406-140000"

  // Format: *-YYYYMMDD-HHMMSS
  const dashTimestamp = name.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (dashTimestamp) {
    const [, y, mo, d, h, mi, s] = dashTimestamp;
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }

  // Format: YYYY-MM-DDTHH-MM-SS
  const isoLike = name.match(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/,
  );
  if (isoLike) {
    const [, y, mo, d, h, mi, s] = isoLike;
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }

  return name;
}

// --- Main Component ---

export function SessionHistoryBrowser({
  projectPath,
}: SessionHistoryBrowserProps) {
  const {
    sessions,
    isLoading,
    error,
    selectedSession,
    currentPage,
    fetchSessions,
    selectSession,
    setPage,
  } = useSessionHistoryStore();

  useEffect(() => {
    fetchSessions(projectPath);
  }, [projectPath, fetchSessions]);

  // Find the selected session info
  const selectedSessionInfo = selectedSession
    ? sessions.find((s) => s.name === selectedSession) ?? null
    : null;

  // If a session is selected, show its detail view
  if (selectedSessionInfo) {
    return (
      <SessionDetailView
        session={selectedSessionInfo}
        projectPath={projectPath}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} />;
  }

  // Empty state
  if (sessions.length === 0) {
    return <EmptyState />;
  }

  // Pagination
  const totalPages = Math.ceil(sessions.length / SESSIONS_PER_PAGE);
  const startIdx = currentPage * SESSIONS_PER_PAGE;
  const visibleSessions = sessions.slice(startIdx, startIdx + SESSIONS_PER_PAGE);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Session History
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {sessions.length} archived session{sessions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Session list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {visibleSessions.map((session) => (
          <SessionListItem
            key={session.name}
            session={session}
            onSelect={selectSession}
          />
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
