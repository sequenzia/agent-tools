/**
 * API error handling utilities.
 *
 * Provides:
 * - Timeout wrapper for API calls
 * - Error classification (timeout, disconnect, validation, general)
 * - Human-readable error messages
 */

/** Classification of API errors. */
export type IpcErrorKind =
  | "timeout"
  | "disconnect"
  | "panic"
  | "validation"
  | "not_found"
  | "permission"
  | "conflict"
  | "unknown";

/** Structured API error with kind and user-friendly message. */
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

/** Default API timeout in milliseconds. */
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
          `Operation timed out after ${ms}ms`,
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
 * Classify a raw error from an API call into a structured IpcError.
 * Detects: timeouts, server errors, validation errors, conflicts, and disconnections.
 */
export function classifyIpcError(err: unknown): IpcError {
  if (err instanceof IpcError) return err;

  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const lower = message.toLowerCase();

  // Timeout detection
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("aborted")) {
    return new IpcError("timeout", `Operation timed out: ${message}`, err);
  }

  // Disconnect / network errors
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("disconnected") ||
    lower.includes("connection refused") ||
    lower.includes("load failed")
  ) {
    return new IpcError(
      "disconnect",
      "Lost connection to the server. Check that the backend is running.",
      err,
    );
  }

  // Server errors (500)
  if (lower.includes("internal server error") || lower.includes("server error")) {
    return new IpcError(
      "panic",
      "Internal error: the backend encountered an unexpected failure.",
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
 * Get a user-friendly description for an API error kind.
 */
export function ipcErrorDescription(kind: IpcErrorKind): string {
  switch (kind) {
    case "timeout":
      return "The operation took too long. Please try again.";
    case "disconnect":
      return "Lost connection to the server. Please check that the backend is running.";
    case "panic":
      return "An internal error occurred in the backend.";
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
