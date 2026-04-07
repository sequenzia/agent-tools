import { create } from "zustand";

/** Toast severity levels. */
export type ToastSeverity = "error" | "warning" | "info";

/** A single toast notification. */
export interface Toast {
  id: number;
  severity: ToastSeverity;
  title: string;
  message: string;
  /** Timestamp when the toast was created. */
  createdAt: number;
}

interface ToastState {
  /** Active toasts, ordered by creation time (newest last). */
  toasts: Toast[];
  /** Auto-incrementing ID counter. */
  nextId: number;

  /** Add a toast notification. Returns the toast ID. Auto-dismisses after duration (default 5s). */
  addToast: (
    severity: ToastSeverity,
    title: string,
    message: string,
    durationMs?: number,
  ) => number;
  /** Dismiss a specific toast by ID. */
  dismissToast: (id: number) => void;
  /** Dismiss all toasts. */
  dismissAll: () => void;
}

/** Maximum number of simultaneous toasts displayed. Oldest are removed when exceeded. */
const MAX_TOASTS = 5;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  nextId: 1,

  addToast: (
    severity: ToastSeverity,
    title: string,
    message: string,
    durationMs = 5000,
  ): number => {
    const id = get().nextId;
    const toast: Toast = {
      id,
      severity,
      title,
      message,
      createdAt: Date.now(),
    };

    set((state) => {
      let newToasts = [...state.toasts, toast];
      // Cap at MAX_TOASTS — remove oldest
      if (newToasts.length > MAX_TOASTS) {
        newToasts = newToasts.slice(newToasts.length - MAX_TOASTS);
      }
      return { toasts: newToasts, nextId: state.nextId + 1 };
    });

    // Auto-dismiss after duration (0 = no auto-dismiss)
    if (durationMs > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, durationMs);
    }

    return id;
  },

  dismissToast: (id: number): void => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  dismissAll: (): void => {
    set({ toasts: [] });
  },
}));
