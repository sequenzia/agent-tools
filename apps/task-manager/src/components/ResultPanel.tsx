import { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useResultStore } from "../stores/result-store";
import type { ParsedResult, ResultOutcome } from "../services/result-service";

// --- Markdown components (simplified) ---

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <pre className="my-2 overflow-x-auto rounded bg-gray-100 p-2 dark:bg-gray-800">
      <code className={className}>{children}</code>
    </pre>
  );
}

const markdownComponents: Components = {
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock as Components["code"],
  ul: ({ children }) => (
    <ul className="my-1 ml-5 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-5 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  p: ({ children }) => (
    <p className="my-1.5 text-sm leading-relaxed">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-lg font-bold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-base font-bold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-bold">{children}</h3>
  ),
};

// --- Outcome badge ---

const OUTCOME_STYLES: Record<ResultOutcome, string> = {
  PASS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PARTIAL:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  FAIL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const OUTCOME_BORDER: Record<ResultOutcome, string> = {
  PASS: "border-l-green-500",
  PARTIAL: "border-l-yellow-500",
  FAIL: "border-l-red-500",
};

function OutcomeBadge({ outcome }: { outcome: ResultOutcome }) {
  return (
    <span
      data-testid={`outcome-badge-${outcome.toLowerCase()}`}
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${OUTCOME_STYLES[outcome]}`}
    >
      {outcome}
    </span>
  );
}

// --- Result entry ---

interface ResultEntryProps {
  result: ParsedResult;
  isExpanded: boolean;
  onToggle: () => void;
  onShowFull?: () => void;
}

function ResultEntry({
  result,
  isExpanded,
  onToggle,
  onShowFull,
}: ResultEntryProps) {
  const taskLabel =
    result.taskId === "unknown"
      ? "Unknown Task"
      : `Task ${result.taskId}`;

  return (
    <div
      data-testid={`result-entry-${result.filename}`}
      className={`border-l-4 ${OUTCOME_BORDER[result.outcome]} rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-750"
        aria-expanded={isExpanded}
        aria-label={`${taskLabel}: ${result.subject} - ${result.outcome}`}
      >
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isExpanded ? "\u25BC" : "\u25B6"}
        </span>
        <OutcomeBadge outcome={result.outcome} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          [{result.taskId}] {result.subject}
        </span>
        {result.isMalformed && (
          <span
            className="text-xs text-orange-500"
            title={result.parseWarning || "Malformed result file"}
          >
            (!)
          </span>
        )}
      </button>

      {isExpanded && (
        <div
          data-testid={`result-content-${result.filename}`}
          className="border-t border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {result.rawContent}
          </ReactMarkdown>
          {result.isTruncated && onShowFull && (
            <button
              type="button"
              onClick={onShowFull}
              className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Show full content ({(result.contentSize / 1024).toFixed(1)} KB)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main panel ---

interface ResultPanelProps {
  /** The active project path (for fetching full content of truncated files). */
  projectPath: string | null;
}

export function ResultPanel({ projectPath }: ResultPanelProps) {
  const results = useResultStore((s) => s.results);
  const isLoading = useResultStore((s) => s.isLoading);
  const error = useResultStore((s) => s.error);
  const addResult = useResultStore((s) => s.addResult);

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const sortedResults = useMemo(() => {
    return Array.from(results.values()).sort(
      (a, b) => b.receivedAt - a.receivedAt,
    );
  }, [results]);

  const toggleExpand = useCallback((filename: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  }, []);

  const handleShowFull = useCallback(
    (filename: string) => {
      if (projectPath) {
        addResult(projectPath, filename);
      }
    },
    [projectPath, addResult],
  );

  if (isLoading && sortedResults.length === 0) {
    return (
      <div
        data-testid="result-panel"
        className="flex items-center justify-center p-4 text-sm text-gray-500 dark:text-gray-400"
      >
        Loading results...
      </div>
    );
  }

  if (error && sortedResults.length === 0) {
    return (
      <div
        data-testid="result-panel"
        className="p-4 text-sm text-red-500 dark:text-red-400"
      >
        Error loading results: {error}
      </div>
    );
  }

  if (sortedResults.length === 0) {
    return (
      <div
        data-testid="result-panel"
        className="flex items-center justify-center p-4 text-sm text-gray-500 dark:text-gray-400"
      >
        No results yet. Results will appear as tasks complete.
      </div>
    );
  }

  return (
    <div data-testid="result-panel" className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Task Results ({sortedResults.length})
        </h3>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sortedResults.map((result) => (
          <ResultEntry
            key={result.filename}
            result={result}
            isExpanded={expandedFiles.has(result.filename)}
            onToggle={() => toggleExpand(result.filename)}
            onShowFull={
              result.isTruncated
                ? () => handleShowFull(result.filename)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
