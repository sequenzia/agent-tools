import { describe, it, expect, vi, afterEach } from "vitest";
import {
  IpcError,
  classifyIpcError,
  withIpcTimeout,
  ipcErrorDescription,
  type IpcErrorKind,
} from "../ipc-error-handler";

afterEach(() => {
  vi.useRealTimers();
});

describe("IpcError", () => {
  it("has correct properties", () => {
    const err = new IpcError("timeout", "Timed out", new Error("original"));

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(IpcError);
    expect(err.name).toBe("IpcError");
    expect(err.kind).toBe("timeout");
    expect(err.message).toBe("Timed out");
    expect(err.originalError).toBeInstanceOf(Error);
  });
});

describe("classifyIpcError", () => {
  it("returns IpcError unchanged", () => {
    const original = new IpcError("timeout", "Already classified");
    const result = classifyIpcError(original);
    expect(result).toBe(original);
  });

  it("classifies internal server error messages", () => {
    const result = classifyIpcError(new Error("Internal server error in task handler"));
    expect(result.kind).toBe("panic");
    expect(result.message).toContain("backend encountered an unexpected failure");
  });

  it("classifies timeout messages", () => {
    const result = classifyIpcError(new Error("Request timed out after 5000ms"));
    expect(result.kind).toBe("timeout");
  });

  it("classifies disconnect messages", () => {
    const result = classifyIpcError(new Error("Failed to fetch from server"));
    expect(result.kind).toBe("disconnect");
    expect(result.message).toContain("Lost connection");
  });

  it("classifies conflict messages", () => {
    const result = classifyIpcError(new Error("File was modified externally"));
    expect(result.kind).toBe("conflict");
  });

  it("classifies validation messages", () => {
    const result = classifyIpcError(new Error("Validation failed: missing title"));
    expect(result.kind).toBe("validation");
  });

  it("classifies not found messages", () => {
    const result = classifyIpcError(new Error("File not found: task-42.json"));
    expect(result.kind).toBe("not_found");
  });

  it("classifies permission denied messages", () => {
    const result = classifyIpcError(new Error("Permission denied on /path"));
    expect(result.kind).toBe("permission");
  });

  it("classifies string errors", () => {
    const result = classifyIpcError("Something went wrong");
    expect(result.kind).toBe("unknown");
    expect(result.message).toBe("Something went wrong");
  });

  it("classifies unknown errors", () => {
    const result = classifyIpcError(42);
    expect(result.kind).toBe("unknown");
    expect(result.message).toBe("42");
  });

  it("classifies network error as disconnect", () => {
    const result = classifyIpcError(new Error("Network error connecting to server"));
    expect(result.kind).toBe("disconnect");
  });

  it("preserves original error reference", () => {
    const original = new Error("panicked at some code");
    const result = classifyIpcError(original);
    expect(result.originalError).toBe(original);
  });
});

describe("withIpcTimeout", () => {
  it("resolves when promise resolves before timeout", async () => {
    const result = await withIpcTimeout(Promise.resolve("data"), 1000);
    expect(result).toBe("data");
  });

  it("rejects with IpcError timeout when promise takes too long", async () => {
    vi.useFakeTimers();

    const slowPromise = new Promise<string>(() => {
      // Never resolves
    });

    const resultPromise = withIpcTimeout(slowPromise, 100);

    vi.advanceTimersByTime(100);

    await expect(resultPromise).rejects.toThrow(IpcError);
    await expect(resultPromise).rejects.toMatchObject({
      kind: "timeout",
      message: expect.stringContaining("timed out after 100ms"),
    });
  });

  it("classifies rejection errors from the wrapped promise", async () => {
    const failing = Promise.reject(new Error("Internal server error"));

    try {
      await withIpcTimeout(failing, 5000);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IpcError);
      expect((err as IpcError).kind).toBe("panic");
    }
  });

  it("handles network disconnect errors", async () => {
    const failing = Promise.reject(new Error("Failed to fetch"));

    try {
      await withIpcTimeout(failing, 5000);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IpcError);
      expect((err as IpcError).kind).toBe("disconnect");
    }
  });
});

describe("ipcErrorDescription", () => {
  const kinds: IpcErrorKind[] = [
    "timeout",
    "disconnect",
    "panic",
    "validation",
    "not_found",
    "permission",
    "conflict",
    "unknown",
  ];

  it("returns a string for every error kind", () => {
    for (const kind of kinds) {
      const desc = ipcErrorDescription(kind);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    }
  });

  it("timeout description mentions trying again", () => {
    expect(ipcErrorDescription("timeout")).toContain("try again");
  });

  it("disconnect description mentions server", () => {
    expect(ipcErrorDescription("disconnect")).toContain("server");
  });

  it("panic description mentions backend", () => {
    expect(ipcErrorDescription("panic")).toContain("backend");
  });
});
