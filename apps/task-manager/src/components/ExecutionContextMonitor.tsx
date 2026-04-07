import { useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ExecutionContextState } from "../hooks/use-execution-context";

/** Props for the ExecutionContextMonitor component. */
interface ExecutionContextMonitorProps {
  /** Execution context state from the useExecutionContext hook. */
  state: ExecutionContextState;
}

// --- Markdown components (consistent with ResultPanel) ---

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
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2 text-sm font-semibold">{children}</h4>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-3 py-1.5 text-left text-xs font-semibold dark:border-gray-600">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-600">
      {children}
    </td>
  ),
  hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
};

// --- Section splitter ---

/**
 * Split markdown content into sections delimited by `## ` headings.
 * Returns an array of { heading, body, startLine } objects.
 */
interface MarkdownSection {
  heading: string;
  body: string;
  startLine: number;
}

function splitIntoSections(content: string): MarkdownSection[] {
  const lines = content.split("\n");
  const sections: MarkdownSection[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];
  let currentStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      // Save previous section if it exists.
      if (currentHeading || currentBody.length > 0) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join("\n"),
          startLine: currentStartLine,
        });
      }
      currentHeading = line;
      currentBody = [];
      currentStartLine = i;
    } else {
      currentBody.push(line);
    }
  }

  // Push the last section.
  if (currentHeading || currentBody.length > 0) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join("\n"),
      startLine: currentStartLine,
    });
  }

  return sections;
}

/**
 * Determine if a section contains new content based on new line indices.
 */
function sectionHasNewContent(
  section: MarkdownSection,
  newLineIndices: Set<number>,
  totalLines: number,
): boolean {
  if (newLineIndices.size === 0) return false;

  const sectionLineCount = (section.heading ? 1 : 0) +
    section.body.split("\n").length;
  const endLine = section.startLine + sectionLineCount;

  for (let i = section.startLine; i < endLine && i < totalLines; i++) {
    if (newLineIndices.has(i)) return true;
  }
  return false;
}

// --- Placeholder state ---

function EmptyState() {
  return (
    <div
      data-testid="context-monitor-empty"
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="mb-3 text-3xl text-gray-300 dark:text-gray-600">
        &#128218;
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        No learnings yet
      </p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        Cross-task learnings will appear here as tasks complete.
      </p>
    </div>
  );
}

// --- Stale indicator ---

function StaleIndicator({ error }: { error: string }) {
  return (
    <div
      data-testid="context-monitor-stale"
      className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 dark:border-yellow-800 dark:bg-yellow-900/20"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-yellow-600 dark:text-yellow-400">
          Content may be stale
        </span>
        <span className="text-xs text-yellow-500 dark:text-yellow-500">
          ({error})
        </span>
      </div>
    </div>
  );
}

// --- New badge ---

function NewBadge() {
  return (
    <span
      data-testid="new-content-badge"
      className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    >
      new
    </span>
  );
}

// --- Section renderer ---

function SectionBlock({
  section,
  isNew,
}: {
  section: MarkdownSection;
  isNew: boolean;
}) {
  return (
    <div
      data-testid={`context-section-${section.startLine}`}
      className={`rounded-md px-3 py-2 transition-colors ${
        isNew
          ? "border-l-2 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
          : ""
      }`}
    >
      {section.heading && (
        <div className="flex items-center">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {section.heading}
          </ReactMarkdown>
          {isNew && <NewBadge />}
        </div>
      )}
      {section.body.trim() && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {section.body}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

/**
 * Execution Context Monitor component for the execution dashboard.
 *
 * Shows:
 * - Rendered markdown content from execution_context.md
 * - Visual distinction for newly added content (blue highlight + "new" badge)
 * - Auto-scroll to latest content when updates arrive
 * - Placeholder when file doesn't exist yet
 * - Stale indicator when file read fails but previous content is available
 *
 * The component auto-refreshes as execution_context.md changes on disk
 * via the useExecutionContext hook's polling mechanism.
 */
export function ExecutionContextMonitor({
  state,
}: ExecutionContextMonitorProps) {
  const {
    content,
    newLineIndices,
    isLoading,
    isActive,
    error,
    isStale,
    lastUpdated,
  } = state;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevLastUpdatedRef = useRef<number | null>(null);

  // Auto-scroll to bottom when new content arrives.
  useEffect(() => {
    if (
      lastUpdated !== null &&
      lastUpdated !== prevLastUpdatedRef.current &&
      scrollContainerRef.current
    ) {
      const container = scrollContainerRef.current;
      // Use requestAnimationFrame to ensure DOM has updated.
      requestAnimationFrame(() => {
        if (typeof container.scrollTo === "function") {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
    prevLastUpdatedRef.current = lastUpdated;
  }, [lastUpdated]);

  // Split content into sections and determine which have new content.
  const sections = useMemo(() => {
    if (!content) return [];
    return splitIntoSections(content);
  }, [content]);

  const totalLines = useMemo(() => {
    if (!content) return 0;
    return content.split("\n").length;
  }, [content]);

  const sectionNewStatus = useMemo(() => {
    return sections.map((section) =>
      sectionHasNewContent(section, newLineIndices, totalLines),
    );
  }, [sections, newLineIndices, totalLines]);

  // Not active -- don't render anything.
  if (!isActive) {
    return null;
  }

  // Session active but loading with no content yet.
  if (isLoading && content === null) {
    return (
      <div
        data-testid="context-monitor-loading"
        className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Loading execution context...
          </span>
        </div>
      </div>
    );
  }

  // File doesn't exist yet.
  if (content === null && !error) {
    return (
      <div
        data-testid="context-monitor"
        className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      >
        <EmptyState />
      </div>
    );
  }

  // Error state with no fallback content.
  if (content === null && error) {
    return (
      <div
        data-testid="context-monitor"
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load execution context: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="context-monitor"
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Execution Context
        </h3>
        {lastUpdated && (
          <span
            data-testid="last-updated"
            className="text-xs text-gray-400 dark:text-gray-500"
          >
            Updated {formatTimestamp(lastUpdated)}
          </span>
        )}
      </div>

      {/* Stale indicator */}
      {isStale && error && (
        <div className="px-4 pt-3">
          <StaleIndicator error={error} />
        </div>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        data-testid="context-monitor-content"
        className="flex-1 space-y-1 overflow-y-auto p-4"
      >
        {sections.map((section, idx) => (
          <SectionBlock
            key={`${section.startLine}-${section.heading}`}
            section={section}
            isNew={sectionNewStatus[idx]}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Format a timestamp as a relative time string (e.g., "just now", "2m ago").
 */
function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// Exported for testing.
export { splitIntoSections, sectionHasNewContent, formatTimestamp };
