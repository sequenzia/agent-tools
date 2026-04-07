/**
 * IPC error handling utilities for Tauri commands.
 *
 * Provides:
 * - Timeout wrapper for IPC calls
 * - Error classification (timeout, disconnect, Rust panic, general)
 * - Human-readable error messages
 */

/** Classification of IPC errors. */
export type IpcErrorKind =
  | "timeout"
  | "disconnect"
  | "panic"
  | "validation"
  | "not_found"
  | "permission"
  | "conflict"
  | "unknown";

/** Structured IPC error with kind and user-friendly message. */
export class IpcError extends Error {
  readonly kind: IpcErrorKind;
  readonly originalError: unknown;

  constructor(kind: IpcErrorKind, message: string, originalError?: unknown) {
    super(message);
    this.name = "IpcError";
    this.kind = kind;
    this.originalError = originalError;
  }
}

/** Default IPC timeout in milliseconds. */
export const DEFAULT_IPC_TIMEOUT_MS = 5000;

/**
 * Wrap a promise with a timeout. Rejects with an IpcError of kind "timeout"
 * if the promise does not resolve within the given duration.
 */
export function withIpcTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_IPC_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new IpcError(
          "timeout",
          `IPC operation timed out after ${ms}ms`,
        ),
      );
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(classifyIpcError(err));
      },
    );
  });
}

/**
 * Classify a raw error from an IPC call into a structured IpcError.
 * Detects: timeouts, Rust panics, validation errors, conflicts, and disconnections.
 */
export function classifyIpcError(err: unknown): IpcError {
  if (err instanceof IpcError) return err;

  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const lower = message.toLowerCase();

  // Rust panics typically contain "panicked" or "panic"
  if (lower.includes("panicked") || lower.includes("panic at")) {
    return new IpcError(
      "panic",
      "Internal error: the backend encountered an unexpected failure. Please restart the app.",
      err,
    );
  }

  // Timeout detection
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return new IpcError("timeout", `IPC operation timed out: ${message}`, err);
  }

  // Disconnect / IPC channel closed
  if (
    lower.includes("ipc channel closed") ||
    lower.includes("disconnected") ||
    lower.includes("connection refused") ||
    lower.includes("failed to send")
  ) {
    return new IpcError(
      "disconnect",
      "Lost connection to the backend. The app may need to be restarted.",
      err,
    );
  }

  // Conflict (mtime-based)
  if (lower.includes("conflict") || lower.includes("modified externally")) {
    return new IpcError("conflict", message, err);
  }

  // Validation error
  if (lower.includes("validation") || lower.includes("invalid")) {
    return new IpcError("validation", message, err);
  }

  // File not found
  if (lower.includes("not found") || lower.includes("no such file")) {
    return new IpcError("not_found", message, err);
  }

  // Permission denied
  if (lower.includes("permission denied") || lower.includes("access denied")) {
    return new IpcError("permission", message, err);
  }

  return new IpcError("unknown", message, err);
}

/**
 * Get a user-friendly description for an IPC error kind.
 */
export function ipcErrorDescription(kind: IpcErrorKind): string {
  switch (kind) {
    case "timeout":
      return "The operation took too long. Please try again.";
    case "disconnect":
      return "Lost connection to the backend. Please restart the app.";
    case "panic":
      return "An internal error occurred in the backend. Please restart the app.";
    case "validation":
      return "The data did not pass validation.";
    case "not_found":
      return "The requested resource was not found.";
    case "permission":
      return "Permission denied for this operation.";
    case "conflict":
      return "The file was modified externally. Please refresh and try again.";
    case "unknown":
      return "An unexpected error occurred.";
  }
}
