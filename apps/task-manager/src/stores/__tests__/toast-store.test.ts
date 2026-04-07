import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useToastStore } from "../toast-store";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [], nextId: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useToastStore", () => {
  it("adds a toast with correct fields", () => {
    const id = useToastStore.getState().addToast("error", "Move failed", "Conflict detected");

    expect(id).toBe(1);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      id: 1,
      severity: "error",
      title: "Move failed",
      message: "Conflict detected",
    });
    expect(toasts[0].createdAt).toBeGreaterThan(0);
  });

  it("increments IDs for each toast", () => {
    const id1 = useToastStore.getState().addToast("error", "A", "msg");
    const id2 = useToastStore.getState().addToast("warning", "B", "msg");
    const id3 = useToastStore.getState().addToast("info", "C", "msg");

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(id3).toBe(3);
    expect(useToastStore.getState().toasts).toHaveLength(3);
  });

  it("auto-dismisses after default duration (5s)", () => {
    useToastStore.getState().addToast("error", "Temporary", "Goes away");

    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(5000);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("auto-dismisses after custom duration", () => {
    useToastStore.getState().addToast("info", "Quick", "msg", 1000);

    vi.advanceTimersByTime(999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("does not auto-dismiss when duration is 0", () => {
    useToastStore.getState().addToast("error", "Persistent", "stays", 0);

    vi.advanceTimersByTime(60000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("dismisses a specific toast by ID", () => {
    const id1 = useToastStore.getState().addToast("error", "A", "msg", 0);
    useToastStore.getState().addToast("error", "B", "msg", 0);

    useToastStore.getState().dismissToast(id1);

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].title).toBe("B");
  });

  it("dismisses all toasts", () => {
    useToastStore.getState().addToast("error", "A", "msg", 0);
    useToastStore.getState().addToast("warning", "B", "msg", 0);
    useToastStore.getState().addToast("info", "C", "msg", 0);

    useToastStore.getState().dismissAll();

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("caps at MAX_TOASTS (5), removing oldest", () => {
    for (let i = 0; i < 7; i++) {
      useToastStore.getState().addToast("error", `Toast ${i}`, "msg", 0);
    }

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(5);
    // Oldest (0, 1) should be gone
    expect(toasts[0].title).toBe("Toast 2");
    expect(toasts[4].title).toBe("Toast 6");
  });

  it("handles multiple simultaneous toasts from different sources", () => {
    useToastStore.getState().addToast("error", "IPC timeout", "Backend did not respond", 0);
    useToastStore.getState().addToast("warning", "Watcher error", "File system error", 0);
    useToastStore.getState().addToast("error", "Move failed", "Conflict detected", 0);

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(3);
    expect(toasts[0].severity).toBe("error");
    expect(toasts[1].severity).toBe("warning");
    expect(toasts[2].severity).toBe("error");
  });

  it("supports all severity levels", () => {
    useToastStore.getState().addToast("error", "E", "msg", 0);
    useToastStore.getState().addToast("warning", "W", "msg", 0);
    useToastStore.getState().addToast("info", "I", "msg", 0);

    const toasts = useToastStore.getState().toasts;
    expect(toasts.map((t) => t.severity)).toEqual(["error", "warning", "info"]);
  });
});
