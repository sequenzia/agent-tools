import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateProjectDirectory,
  loadProjects,
  addProjectPath,
  removeProjectPath,
  persistActiveProject,
} from "../project-directory";

// Mock api-client
vi.mock("../api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../api-client";
const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);
const mockPut = vi.mocked(api.put);
const mockDelete = vi.mocked(api.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateProjectDirectory", () => {
  it("returns validation result for a valid directory", async () => {
    const mockResult = { path: "/Users/test/project", has_tasks_dir: true };
    mockPost.mockResolvedValueOnce(mockResult);

    const result = await validateProjectDirectory("/Users/test/project");

    expect(mockPost).toHaveBeenCalledWith("/api/projects/validate", {
      path: "/Users/test/project",
    });
    expect(result).toEqual(mockResult);
  });

  it("throws error for non-existent directory", async () => {
    mockPost.mockRejectedValueOnce("Directory does not exist: /nonexistent");

    await expect(validateProjectDirectory("/nonexistent")).rejects.toBe(
      "Directory does not exist: /nonexistent",
    );
  });

  it("throws error for permission denied", async () => {
    mockPost.mockRejectedValueOnce(
      "Permission denied on directory /restricted: Permission denied (os error 13)",
    );

    await expect(validateProjectDirectory("/restricted")).rejects.toContain(
      "Permission denied",
    );
  });
});

describe("loadProjects", () => {
  it("returns project list and active path", async () => {
    const mockResult = {
      projects: ["/Users/test/project-a", "/Users/test/project-b"],
      activeProjectPath: "/Users/test/project-a",
    };
    mockGet.mockResolvedValueOnce(mockResult);

    const result = await loadProjects();

    expect(mockGet).toHaveBeenCalledWith("/api/projects");
    expect(result).toEqual(mockResult);
  });

  it("returns empty list when no projects configured", async () => {
    const mockResult = { projects: [], activeProjectPath: null };
    mockGet.mockResolvedValueOnce(mockResult);

    const result = await loadProjects();

    expect(result.projects).toEqual([]);
    expect(result.activeProjectPath).toBeNull();
  });
});

describe("addProjectPath", () => {
  it("calls POST /api/projects and returns result", async () => {
    const mockResult = { ok: true, has_tasks_dir: true };
    mockPost.mockResolvedValueOnce(mockResult);

    const result = await addProjectPath("/Users/test/project");

    expect(mockPost).toHaveBeenCalledWith("/api/projects", {
      path: "/Users/test/project",
    });
    expect(result).toEqual(mockResult);
  });

  it("throws on non-existent directory", async () => {
    mockPost.mockRejectedValueOnce(new Error("Directory not found: /nonexistent"));

    await expect(addProjectPath("/nonexistent")).rejects.toThrow(
      "Directory not found",
    );
  });
});

describe("removeProjectPath", () => {
  it("calls DELETE /api/projects with path in body", async () => {
    mockDelete.mockResolvedValueOnce({ ok: true, activeProjectPath: null });

    await removeProjectPath("/Users/test/project");

    expect(mockDelete).toHaveBeenCalledWith("/api/projects", {
      path: "/Users/test/project",
    });
  });
});

describe("persistActiveProject", () => {
  it("calls PUT /api/projects/active with path", async () => {
    mockPut.mockResolvedValueOnce({ ok: true });

    await persistActiveProject("/Users/test/project");

    expect(mockPut).toHaveBeenCalledWith("/api/projects/active", {
      path: "/Users/test/project",
    });
  });

  it("calls PUT /api/projects/active with null", async () => {
    mockPut.mockResolvedValueOnce({ ok: true });

    await persistActiveProject(null);

    expect(mockPut).toHaveBeenCalledWith("/api/projects/active", {
      path: null,
    });
  });
});
