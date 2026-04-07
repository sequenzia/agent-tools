import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanForProjects, onScanProgress } from "../discovery-service";

// Mock api-client
vi.mock("../api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api, ws } from "../api-client";

const mockPost = vi.mocked(api.post);
const mockWsOn = vi.mocked(ws.on);

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
    mockPost.mockResolvedValueOnce(mockResult);

    const result = await scanForProjects(["/Users/dev"]);

    expect(mockPost).toHaveBeenCalledWith("/api/discovery/scan", {
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
    mockPost.mockResolvedValueOnce(mockResult);

    await scanForProjects(["/Users/dev"], 5);

    expect(mockPost).toHaveBeenCalledWith("/api/discovery/scan", {
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
    mockPost.mockResolvedValueOnce(mockResult);

    const result = await scanForProjects(["/a", "/nonexistent"]);

    expect(mockPost).toHaveBeenCalledWith("/api/discovery/scan", {
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
    mockPost.mockResolvedValueOnce(mockResult);

    const result = await scanForProjects(["/empty/root"]);

    expect(result.projects).toEqual([]);
    expect(result.dirs_scanned).toBe(100);
  });

  it("propagates errors from the backend", async () => {
    mockPost.mockRejectedValueOnce("Internal scan error");

    await expect(scanForProjects(["/bad"])).rejects.toBe(
      "Internal scan error",
    );
  });
});

describe("onScanProgress", () => {
  it("registers a listener for progress events", () => {
    const mockUnlisten = vi.fn();
    mockWsOn.mockReturnValueOnce(mockUnlisten);

    const callback = vi.fn();
    const unlisten = onScanProgress(callback);

    expect(mockWsOn).toHaveBeenCalledWith(
      "project-scan-progress",
      expect.any(Function),
    );
    expect(unlisten).toBe(mockUnlisten);
  });

  it("passes progress payload to callback", () => {
    const mockUnlisten = vi.fn();
    // Capture the event handler
    let eventHandler: ((payload: unknown) => void) | undefined;
    mockWsOn.mockImplementation((_event: string, handler: (payload: unknown) => void) => {
      eventHandler = handler;
      return mockUnlisten;
    });

    const callback = vi.fn();
    onScanProgress(callback);

    // Simulate a progress event
    const progressPayload = {
      dirs_scanned: 50,
      projects_found: 2,
      done: false,
      current_root: "/Users/dev",
    };

    eventHandler!(progressPayload);

    expect(callback).toHaveBeenCalledWith(progressPayload);
  });

  it("returns unlisten function to stop listening", () => {
    const mockUnlisten = vi.fn();
    mockWsOn.mockReturnValueOnce(mockUnlisten);

    const unlisten = onScanProgress(vi.fn());
    unlisten();

    expect(mockUnlisten).toHaveBeenCalled();
  });
});
