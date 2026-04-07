import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanForProjects, onScanProgress } from "../discovery-service";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scanForProjects", () => {
  it("calls invoke with root paths and default depth", async () => {
    const mockResult = {
      projects: [
        { path: "/Users/dev/project-a", name: "project-a" },
        { path: "/Users/dev/project-b", name: "project-b" },
      ],
      warnings: [],
      dirs_scanned: 42,
      elapsed_ms: 120,
    };
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await scanForProjects(["/Users/dev"]);

    expect(mockInvoke).toHaveBeenCalledWith("scan_for_projects", {
      rootPaths: ["/Users/dev"],
      maxDepth: undefined,
    });
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0].name).toBe("project-a");
    expect(result.dirs_scanned).toBe(42);
    expect(result.elapsed_ms).toBe(120);
  });

  it("passes custom max depth", async () => {
    const mockResult = {
      projects: [],
      warnings: [],
      dirs_scanned: 10,
      elapsed_ms: 50,
    };
    mockInvoke.mockResolvedValueOnce(mockResult);

    await scanForProjects(["/Users/dev"], 5);

    expect(mockInvoke).toHaveBeenCalledWith("scan_for_projects", {
      rootPaths: ["/Users/dev"],
      maxDepth: 5,
    });
  });

  it("accepts multiple root paths", async () => {
    const mockResult = {
      projects: [{ path: "/a/project", name: "project" }],
      warnings: ["Root directory does not exist: /nonexistent"],
      dirs_scanned: 15,
      elapsed_ms: 80,
    };
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await scanForProjects(["/a", "/nonexistent"]);

    expect(mockInvoke).toHaveBeenCalledWith("scan_for_projects", {
      rootPaths: ["/a", "/nonexistent"],
      maxDepth: undefined,
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("does not exist");
  });

  it("returns empty results when no projects found", async () => {
    const mockResult = {
      projects: [],
      warnings: [],
      dirs_scanned: 100,
      elapsed_ms: 200,
    };
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await scanForProjects(["/empty/root"]);

    expect(result.projects).toEqual([]);
    expect(result.dirs_scanned).toBe(100);
  });

  it("propagates errors from the backend", async () => {
    mockInvoke.mockRejectedValueOnce("Internal scan error");

    await expect(scanForProjects(["/bad"])).rejects.toBe(
      "Internal scan error",
    );
  });
});

describe("onScanProgress", () => {
  it("registers a listener for progress events", async () => {
    const mockUnlisten = vi.fn();
    mockListen.mockResolvedValueOnce(mockUnlisten);

    const callback = vi.fn();
    const unlisten = await onScanProgress(callback);

    expect(mockListen).toHaveBeenCalledWith(
      "project-scan-progress",
      expect.any(Function),
    );
    expect(unlisten).toBe(mockUnlisten);
  });

  it("passes progress payload to callback", async () => {
    const mockUnlisten = vi.fn();
    // Capture the event handler
    let eventHandler: ((event: unknown) => void) | undefined;
    mockListen.mockImplementation(async (_event, handler) => {
      eventHandler = handler as (event: unknown) => void;
      return mockUnlisten;
    });

    const callback = vi.fn();
    await onScanProgress(callback);

    // Simulate a progress event
    const progressPayload = {
      dirs_scanned: 50,
      projects_found: 2,
      done: false,
      current_root: "/Users/dev",
    };

    eventHandler!({ payload: progressPayload });

    expect(callback).toHaveBeenCalledWith(progressPayload);
  });

  it("returns unlisten function to stop listening", async () => {
    const mockUnlisten = vi.fn();
    mockListen.mockResolvedValueOnce(mockUnlisten);

    const unlisten = await onScanProgress(vi.fn());
    unlisten();

    expect(mockUnlisten).toHaveBeenCalled();
  });
});
