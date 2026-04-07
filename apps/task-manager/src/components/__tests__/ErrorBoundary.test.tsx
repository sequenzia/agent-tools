import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

// Suppress console.error for expected errors in error boundaries
const originalConsoleError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  cleanup();
  vi.restoreAllMocks();
});

// --- Helper: A component that throws on demand ---

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test component error");
  }
  return <div data-testid="child-content">Healthy content</div>;
}

function ThrowingChildWithMessage({ message }: { message: string }) {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary sectionName="Test Section">
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("child-content")).toBeDefined();
  });

  it("renders error fallback when child throws", () => {
    render(
      <ErrorBoundary sectionName="Kanban Board">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("error-boundary-kanban-board")).toBeDefined();
    expect(screen.getByText("Kanban Board encountered an error")).toBeDefined();
    expect(screen.getByText("Test component error")).toBeDefined();
    expect(screen.getByTestId("retry-kanban-board")).toBeDefined();
  });

  it("displays section name in error message", () => {
    render(
      <ErrorBoundary sectionName="Task Detail">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Task Detail encountered an error")).toBeDefined();
  });

  it("displays descriptive error message from the thrown error", () => {
    render(
      <ErrorBoundary sectionName="Test">
        <ThrowingChildWithMessage message="IPC operation timed out after 5000ms" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("IPC operation timed out after 5000ms")).toBeDefined();
  });

  it("recovers when retry button is clicked", () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error("First render fails");
      return <div data-testid="recovered-content">Recovered!</div>;
    }

    render(
      <ErrorBoundary sectionName="Board">
        <ConditionalThrower />
      </ErrorBoundary>,
    );

    // Error state shown
    expect(screen.getByTestId("error-boundary-board")).toBeDefined();

    // Fix the error and click retry
    shouldThrow = false;
    fireEvent.click(screen.getByTestId("retry-board"));

    // Should now show recovered content
    expect(screen.getByTestId("recovered-content")).toBeDefined();
  });

  it("shows retry count after first retry attempt", () => {
    render(
      <ErrorBoundary sectionName="Board" maxAutoRetries={3}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Click retry once — it will throw again
    fireEvent.click(screen.getByTestId("retry-board"));

    // Should show attempt count
    expect(screen.getByText("Attempt 1 of 3")).toBeDefined();
  });

  it("shows retry limit message when maxAutoRetries exceeded", () => {
    render(
      <ErrorBoundary sectionName="Board" maxAutoRetries={2}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Retry twice to exhaust limit
    fireEvent.click(screen.getByTestId("retry-board"));
    fireEvent.click(screen.getByTestId("retry-board"));

    expect(
      screen.getByText("Retry limit reached (2 attempts). Try reloading the app."),
    ).toBeDefined();
    // Button still available for manual retry
    expect(screen.getByText("Retry anyway")).toBeDefined();
  });

  it("still allows retry after limit is reached", () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error("Fails");
      return <div data-testid="recovered">OK</div>;
    }

    render(
      <ErrorBoundary sectionName="Board" maxAutoRetries={1}>
        <ConditionalThrower />
      </ErrorBoundary>,
    );

    // Exhaust the limit
    fireEvent.click(screen.getByTestId("retry-board"));
    expect(screen.getByText("Retry anyway")).toBeDefined();

    // Fix and retry
    shouldThrow = false;
    fireEvent.click(screen.getByTestId("retry-board"));
    expect(screen.getByTestId("recovered")).toBeDefined();
  });

  it("calls onError callback when error is caught", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary sectionName="Dashboard" onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test component error" }),
      "Dashboard",
    );
  });

  it("errors in one boundary do not affect sibling boundaries", () => {
    render(
      <div>
        <ErrorBoundary sectionName="Board">
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>
        <ErrorBoundary sectionName="Detail">
          <ThrowingChild shouldThrow={false} />
        </ErrorBoundary>
      </div>,
    );

    // Board should show error
    expect(screen.getByTestId("error-boundary-board")).toBeDefined();
    // Detail should render normally
    expect(screen.getByTestId("child-content")).toBeDefined();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary
        sectionName="Board"
        fallback={({ error, sectionName, resetError }) => (
          <div data-testid="custom-fallback">
            <p>Custom: {sectionName} - {error.message}</p>
            <button onClick={resetError} data-testid="custom-retry">
              Custom retry
            </button>
          </div>
        )}
      >
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeDefined();
    expect(screen.getByText("Custom: Board - Test component error")).toBeDefined();
  });

  it("does not cause infinite retry loop when error persists", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary sectionName="Board" maxAutoRetries={2} onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Retry multiple times
    fireEvent.click(screen.getByTestId("retry-board"));
    fireEvent.click(screen.getByTestId("retry-board"));
    fireEvent.click(screen.getByTestId("retry-board"));

    // Should show exhaustion message (retryCount = 3, maxRetries = 2)
    expect(
      screen.getByText(/Retry limit reached/),
    ).toBeDefined();

    // onError was called each time (initial + 3 retries = 4 calls)
    expect(onError).toHaveBeenCalledTimes(4);
  });
});
