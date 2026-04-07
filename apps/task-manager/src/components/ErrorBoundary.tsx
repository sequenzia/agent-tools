import { Component, type ReactNode } from "react";

// --- Types ---

interface ErrorBoundaryProps {
  /** Section name shown in the error UI (e.g., "Kanban Board", "Dashboard"). */
  sectionName: string;
  /** Children to render when no error is present. */
  children: ReactNode;
  /** Optional custom fallback renderer. Receives error info and reset callback. */
  fallback?: (props: {
    error: Error;
    sectionName: string;
    resetError: () => void;
    retryCount: number;
  }) => ReactNode;
  /** Maximum number of automatic retries before showing manual retry only. Default: 3. */
  maxAutoRetries?: number;
  /** Callback when an error is caught. Useful for logging or global notification. */
  onError?: (error: Error, sectionName: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * React Error Boundary with per-section error recovery and retry support.
 *
 * Wraps a UI section and catches render-time errors. Displays a descriptive
 * error message with a retry button. Tracks retry count to prevent infinite
 * retry loops (stops auto-retry after maxAutoRetries).
 *
 * When children change (via key prop on parent), the error state resets
 * automatically, enabling recovery when the underlying data changes.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    const wrappedError =
      error instanceof Error ? error : new Error(String(error));
    return { hasError: true, error: wrappedError };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error, this.props.sectionName);
  }

  resetError = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render(): ReactNode {
    const { hasError, error, retryCount } = this.state;
    const { sectionName, children, fallback, maxAutoRetries = 3 } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback({
          error,
          sectionName,
          resetError: this.resetError,
          retryCount,
        });
      }

      return (
        <ErrorFallback
          error={error}
          sectionName={sectionName}
          onRetry={this.resetError}
          retryCount={retryCount}
          maxRetries={maxAutoRetries}
        />
      );
    }

    return children;
  }
}

// --- Default Fallback UI ---

interface ErrorFallbackProps {
  error: Error;
  sectionName: string;
  onRetry: () => void;
  retryCount: number;
  maxRetries: number;
}

function ErrorFallback({
  error,
  sectionName,
  onRetry,
  retryCount,
  maxRetries,
}: ErrorFallbackProps) {
  const isRetryExhausted = retryCount >= maxRetries;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20"
      data-testid={`error-boundary-${sectionName.toLowerCase().replace(/\s+/g, "-")}`}
      role="alert"
    >
      <p className="font-medium text-red-800 dark:text-red-300">
        {sectionName} encountered an error
      </p>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
        {error.message}
      </p>
      {isRetryExhausted ? (
        <p className="mt-3 text-xs text-red-500 dark:text-red-400">
          Retry limit reached ({retryCount} attempts). Try reloading the app.
        </p>
      ) : null}
      <button
        onClick={onRetry}
        className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        data-testid={`retry-${sectionName.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {isRetryExhausted ? "Retry anyway" : "Retry"}
      </button>
      {retryCount > 0 && (
        <p className="mt-2 text-xs text-red-400 dark:text-red-500">
          Attempt {retryCount} of {maxRetries}
        </p>
      )}
    </div>
  );
}
