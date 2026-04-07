import { useState, useEffect, useCallback, useRef, Component } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  readSpec,
  checkSpecAnalysis,
  readSpecAnalysis,
  generateAnchorId,
  type SpecContent,
} from "../services/spec-service";
import { SpecLifecyclePipeline } from "./SpecLifecyclePipeline";

// --- Types ---

interface SpecViewerProps {
  /** Absolute path to the project root directory. */
  projectPath: string;
  /** Spec file path (relative to project root or absolute). */
  specPath: string;
  /** Optional section anchor to scroll to on load (from task metadata.source_section). */
  scrollToSection?: string;
  /** Optional task group name for lifecycle pipeline stage detection. */
  taskGroup?: string;
}

type ActiveTab = "spec" | "analysis";

// --- Heading component with anchor IDs ---

function createHeadingRenderer(level: number) {
  const HeadingComponent = ({
    children,
  }: {
    children?: React.ReactNode;
  }) => {
    const text = extractTextFromChildren(children);
    const id = generateAnchorId(text);
    const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;

    return (
      <Tag id={id} className="group scroll-mt-4">
        {children}
        <a
          href={`#${id}`}
          className="ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Link to ${text}`}
        >
          #
        </a>
      </Tag>
    );
  };
  HeadingComponent.displayName = `Heading${level}`;
  return HeadingComponent;
}

/**
 * Extract plain text from React children (handles strings, arrays, nested elements).
 */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractTextFromChildren(
      (children as { props: { children?: React.ReactNode } }).props.children,
    );
  }
  return "";
}

// --- Mermaid code block handler ---

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const match = /language-(\w+)/.exec(className ?? "");
  const language = match ? match[1] : undefined;
  const code = String(children).replace(/\n$/, "");

  if (language === "mermaid") {
    return (
      <div className="my-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
          <span>Mermaid Diagram</span>
        </div>
        <pre className="overflow-x-auto text-sm text-blue-900 dark:text-blue-200">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <pre className="my-4 overflow-x-auto rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
      <code className={className}>{children}</code>
    </pre>
  );
}

// --- Markdown components configuration ---

const markdownComponents: Components = {
  h1: createHeadingRenderer(1),
  h2: createHeadingRenderer(2),
  h3: createHeadingRenderer(3),
  h4: createHeadingRenderer(4),
  h5: createHeadingRenderer(5),
  h6: createHeadingRenderer(6),
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock as Components["code"],
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold dark:border-gray-600">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-4 py-2 text-sm dark:border-gray-600">
      {children}
    </td>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-6 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-6 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  p: ({ children }) => <p className="my-2 text-sm leading-relaxed">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:border-gray-600 dark:text-gray-400">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-gray-300 dark:border-gray-600" />,
};

// --- Loading state ---

function SpecLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-400"
        role="status"
        aria-label="Loading spec"
      />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading spec...</p>
    </div>
  );
}

// --- Error state ---

function SpecErrorState({
  message,
  rawContent,
}: {
  message: string;
  rawContent?: string;
}) {
  return (
    <div>
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
        <p className="font-medium text-yellow-800 dark:text-yellow-300">
          Markdown rendering issue
        </p>
        <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
          {message}
        </p>
      </div>
      {rawContent && (
        <pre className="mt-4 max-h-[600px] overflow-auto rounded-lg bg-gray-100 p-4 text-sm dark:bg-gray-800">
          {rawContent}
        </pre>
      )}
    </div>
  );
}

// --- Section not found notification ---

function SectionNotFoundNotice({ section }: { section: string }) {
  return (
    <div
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
      role="alert"
    >
      <p className="text-sm text-amber-800 dark:text-amber-300">
        Section &quot;{section}&quot; not found. Showing spec from the top.
      </p>
    </div>
  );
}

// --- Tab button ---

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

// --- Error boundary for markdown rendering ---

interface MarkdownErrorBoundaryProps {
  content: string;
  children: React.ReactNode;
}

interface MarkdownErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class MarkdownErrorBoundary extends Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  constructor(props: MarkdownErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): MarkdownErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : "Unknown rendering error";
    return { hasError: true, errorMessage: message };
  }

  componentDidUpdate(prevProps: MarkdownErrorBoundaryProps) {
    if (prevProps.content !== this.props.content && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <SpecErrorState
          message={this.state.errorMessage ?? "Unknown rendering error"}
          rawContent={this.props.content}
        />
      );
    }
    return this.props.children;
  }
}

// --- Markdown renderer ---

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <MarkdownErrorBoundary content={content}>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
}

// --- Main SpecViewer Component ---

export function SpecViewer({
  projectPath,
  specPath,
  scrollToSection,
  taskGroup,
}: SpecViewerProps) {
  const [specContent, setSpecContent] = useState<SpecContent | null>(null);
  const [analysisContent, setAnalysisContent] = useState<SpecContent | null>(
    null,
  );
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("spec");
  const [sectionNotFound, setSectionNotFound] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToAnchor = useCallback(
    (sectionText: string): boolean => {
      if (!contentRef.current) return false;

      const anchorId = generateAnchorId(sectionText);
      const escapedId =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(anchorId)
          : anchorId;
      const element = contentRef.current.querySelector(`#${escapedId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      }
      return false;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSpec() {
      setIsLoading(true);
      setError(null);
      setSectionNotFound(false);
      setAnalysisContent(null);
      setHasAnalysis(false);

      try {
        const [spec, analysisCheck] = await Promise.all([
          readSpec(projectPath, specPath),
          checkSpecAnalysis(projectPath, specPath),
        ]);

        if (cancelled) return;

        setSpecContent(spec);
        setHasAnalysis(analysisCheck.exists);

        if (analysisCheck.exists) {
          const analysis = await readSpecAnalysis(
            projectPath,
            analysisCheck.analysis_path,
          );
          if (!cancelled) {
            setAnalysisContent(analysis);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Failed to load spec",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSpec();

    return () => {
      cancelled = true;
    };
  }, [projectPath, specPath]);

  // Scroll to section after content is rendered
  useEffect(() => {
    if (!scrollToSection || isLoading || !specContent) return;
    if (activeTab !== "spec") return;

    // Wait for the DOM to render the markdown
    const timer = setTimeout(() => {
      const found = scrollToAnchor(scrollToSection);
      if (!found) {
        setSectionNotFound(true);
        if (typeof contentRef.current?.scrollTo === "function") {
          contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [scrollToSection, isLoading, specContent, scrollToAnchor, activeTab]);

  if (isLoading) {
    return <SpecLoadingState />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="font-medium text-red-800 dark:text-red-300">
          Failed to load spec
        </p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!specContent) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {/* Spec lifecycle pipeline indicator */}
      <SpecLifecyclePipeline
        projectPath={projectPath}
        specPath={specPath}
        taskGroup={taskGroup}
      />

      {/* Tab bar — only show if analysis exists */}
      {hasAnalysis && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <TabButton
            label="Spec"
            isActive={activeTab === "spec"}
            onClick={() => setActiveTab("spec")}
          />
          <TabButton
            label="Analysis"
            isActive={activeTab === "analysis"}
            onClick={() => setActiveTab("analysis")}
          />
        </div>
      )}

      {/* Section not found notification */}
      {sectionNotFound && scrollToSection && (
        <SectionNotFoundNotice section={scrollToSection} />
      )}

      {/* Content area */}
      <div
        ref={contentRef}
        className="max-h-[80vh] overflow-y-auto p-4"
        data-testid="spec-content"
      >
        {activeTab === "spec" && (
          <MarkdownRenderer content={specContent.content} />
        )}
        {activeTab === "analysis" && analysisContent && (
          <MarkdownRenderer content={analysisContent.content} />
        )}
        {activeTab === "analysis" && !analysisContent && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No analysis content available.
          </p>
        )}
      </div>
    </div>
  );
}
