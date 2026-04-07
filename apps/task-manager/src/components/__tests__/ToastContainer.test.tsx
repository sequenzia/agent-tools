import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ToastContainer } from "../ToastContainer";
import { useToastStore } from "../../stores/toast-store";

beforeEach(() => {
  useToastStore.setState({ toasts: [], nextId: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ToastContainer", () => {
  it("renders nothing when there are no toasts", () => {
    render(<ToastContainer />);
    expect(screen.queryByTestId("toast-container")).toBeNull();
  });

  it("renders error toasts with correct content", () => {
    useToastStore.getState().addToast("error", "Move failed", "Conflict detected", 0);

    render(<ToastContainer />);

    expect(screen.getByTestId("toast-container")).toBeDefined();
    expect(screen.getByText("Move failed")).toBeDefined();
    expect(screen.getByText("Conflict detected")).toBeDefined();
  });

  it("renders warning toasts", () => {
    useToastStore.getState().addToast("warning", "Watcher issue", "File watch error", 0);

    render(<ToastContainer />);

    expect(screen.getByText("Watcher issue")).toBeDefined();
    expect(screen.getByText("File watch error")).toBeDefined();
  });

  it("renders info toasts", () => {
    useToastStore.getState().addToast("info", "Update", "Tasks refreshed", 0);

    render(<ToastContainer />);

    expect(screen.getByText("Update")).toBeDefined();
    expect(screen.getByText("Tasks refreshed")).toBeDefined();
  });

  it("renders multiple toasts", () => {
    useToastStore.getState().addToast("error", "Error A", "msg a", 0);
    useToastStore.getState().addToast("warning", "Warning B", "msg b", 0);

    render(<ToastContainer />);

    expect(screen.getByText("Error A")).toBeDefined();
    expect(screen.getByText("Warning B")).toBeDefined();
  });

  it("dismisses a toast when dismiss button is clicked", () => {
    const id = useToastStore.getState().addToast("error", "Dismissable", "click to dismiss", 0);

    render(<ToastContainer />);

    expect(screen.getByText("Dismissable")).toBeDefined();

    fireEvent.click(screen.getByTestId(`dismiss-toast-${id}`));

    expect(screen.queryByText("Dismissable")).toBeNull();
  });

  it("has role=alert for accessibility", () => {
    useToastStore.getState().addToast("error", "Alert", "msg", 0);

    render(<ToastContainer />);

    const toast = screen.getByTestId("toast-1");
    expect(toast.getAttribute("role")).toBe("alert");
  });

  it("has dismiss button with aria-label", () => {
    useToastStore.getState().addToast("error", "Alert", "msg", 0);

    render(<ToastContainer />);

    const dismissBtn = screen.getByTestId("dismiss-toast-1");
    expect(dismissBtn.getAttribute("aria-label")).toBe("Dismiss notification");
  });
});
