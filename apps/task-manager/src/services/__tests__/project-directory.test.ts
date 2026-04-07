import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateProjectDirectory,
  saveProjectPath,
  getSavedProjectPath,
  clearSavedProjectPath,
  validateAndSaveProjectDirectory,
  loadProjectOnStartup,
} from "../project-directory";

// Mock api-client
vi.mock("../api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../api-client";
const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);
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

describe("saveProjectPath", () => {
  it("calls api with the correct path", async () => {
    mockPost.mockResolvedValueOnce(undefined);

    await saveProjectPath("/Users/test/project");

    expect(mockPost).toHaveBeenCalledWith("/api/projects/save", {
      path: "/Users/test/project",
    });
  });
});

describe("getSavedProjectPath", () => {
  it("returns saved path when one exists", async () => {
    const mockResult = {
      path: "/Users/test/project",
      exists: true,
      has_tasks_dir: true,
    };
    mockGet.mockResolvedValueOnce(mockResult);

    const result = await getSavedProjectPath();

    expect(mockGet).toHaveBeenCalledWith("/api/projects/saved");
    expect(result).toEqual(mockResult);
  });

  it("returns null path when nothing is saved", async () => {
    const mockResult = { path: null, exists: false, has_tasks_dir: false };
    mockGet.mockResolvedValueOnce(mockResult);

    const result = await getSavedProjectPath();

    expect(result.path).toBeNull();
  });

  it("returns exists=false for stale paths", async () => {
    const mockResult = {
      path: "/Users/test/deleted",
      exists: false,
      has_tasks_dir: false,
    };
    mockGet.mockResolvedValueOnce(mockResult);

    const result = await getSavedProjectPath();

    expect(result.path).toBe("/Users/test/deleted");
    expect(result.exists).toBe(false);
  });
});

describe("clearSavedProjectPath", () => {
  it("calls api to clear the path", async () => {
    mockDelete.mockResolvedValueOnce(undefined);

    await clearSavedProjectPath();

    expect(mockDelete).toHaveBeenCalledWith("/api/projects/saved");
  });
});

describe("validateAndSaveProjectDirectory", () => {
  it("validates and saves the directory", async () => {
    const validateResult = {
      path: "/Users/test/project",
      has_tasks_dir: true,
    };
    mockPost
      .mockResolvedValueOnce(validateResult) // validate_project_directory
      .mockResolvedValueOnce(undefined); // save_project_path

    const result = await validateAndSaveProjectDirectory("/Users/test/project");

    expect(result).toEqual(validateResult);
    expect(mockPost).toHaveBeenCalledWith("/api/projects/validate", {
      path: "/Users/test/project",
    });
    expect(mockPost).toHaveBeenCalledWith("/api/projects/save", {
      path: "/Users/test/project",
    });
  });

  it("calls onNoTasksDir callback when .agents/tasks/ is missing", async () => {
    const validateResult = {
      path: "/Users/test/no-tasks",
      has_tasks_dir: false,
    };
    mockPost
      .mockResolvedValueOnce(validateResult)
      .mockResolvedValueOnce(undefined);

    const onNoTasksDir = vi.fn();
    const result = await validateAndSaveProjectDirectory("/Users/test/no-tasks", onNoTasksDir);

    expect(result).toEqual(validateResult);
    expect(onNoTasksDir).toHaveBeenCalledWith("/Users/test/no-tasks");
  });

  it("does not call onNoTasksDir when .agents/tasks/ exists", async () => {
    const validateResult = {
      path: "/Users/test/project",
      has_tasks_dir: true,
    };
    mockPost
      .mockResolvedValueOnce(validateResult)
      .mockResolvedValueOnce(undefined);

    const onNoTasksDir = vi.fn();
    await validateAndSaveProjectDirectory("/Users/test/project", onNoTasksDir);

    expect(onNoTasksDir).not.toHaveBeenCalled();
  });
});

describe("loadProjectOnStartup", () => {
  it("returns project info when saved path exists and is valid", async () => {
    mockGet.mockResolvedValueOnce({
      path: "/Users/test/project",
      exists: true,
      has_tasks_dir: true,
    });

    const result = await loadProjectOnStartup();

    expect(result).toEqual({
      path: "/Users/test/project",
      has_tasks_dir: true,
    });
  });

  it("returns null when no saved path exists", async () => {
    mockGet.mockResolvedValueOnce({
      path: null,
      exists: false,
      has_tasks_dir: false,
    });

    const result = await loadProjectOnStartup();

    expect(result).toBeNull();
  });

  it("returns null when saved directory no longer exists", async () => {
    mockGet.mockResolvedValueOnce({
      path: "/Users/test/deleted",
      exists: false,
      has_tasks_dir: false,
    });

    const result = await loadProjectOnStartup();

    expect(result).toBeNull();
  });

  it("returns project with has_tasks_dir=false when dir exists but no .agents/tasks/", async () => {
    mockGet.mockResolvedValueOnce({
      path: "/Users/test/empty-project",
      exists: true,
      has_tasks_dir: false,
    });

    const result = await loadProjectOnStartup();

    expect(result).toEqual({
      path: "/Users/test/empty-project",
      has_tasks_dir: false,
    });
  });
});
