import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  selectProjectDirectory,
  validateProjectDirectory,
  saveProjectPath,
  getSavedProjectPath,
  clearSavedProjectPath,
  selectAndSaveProjectDirectory,
  loadProjectOnStartup,
} from "../project-directory";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("selectProjectDirectory", () => {
  it("returns directory info when user selects a folder", async () => {
    const mockResult = { path: "/Users/test/project", has_tasks_dir: true };
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await selectProjectDirectory();

    expect(mockInvoke).toHaveBeenCalledWith("select_project_directory");
    expect(result).toEqual(mockResult);
  });

  it("returns null when user cancels the dialog", async () => {
    mockInvoke.mockResolvedValueOnce(null);

    const result = await selectProjectDirectory();

    expect(result).toBeNull();
  });
});

describe("validateProjectDirectory", () => {
  it("returns validation result for a valid directory", async () => {
    const mockResult = { path: "/Users/test/project", has_tasks_dir: true };
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await validateProjectDirectory("/Users/test/project");

    expect(mockInvoke).toHaveBeenCalledWith("validate_project_directory", {
      path: "/Users/test/project",
    });
    expect(result).toEqual(mockResult);
  });

  it("throws error for non-existent directory", async () => {
    mockInvoke.mockRejectedValueOnce("Directory does not exist: /nonexistent");

    await expect(validateProjectDirectory("/nonexistent")).rejects.toBe(
      "Directory does not exist: /nonexistent",
    );
  });

  it("throws error for permission denied", async () => {
    mockInvoke.mockRejectedValueOnce(
      "Permission denied on directory /restricted: Permission denied (os error 13)",
    );

    await expect(validateProjectDirectory("/restricted")).rejects.toContain(
      "Permission denied",
    );
  });
});

describe("saveProjectPath", () => {
  it("calls invoke with the correct path", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await saveProjectPath("/Users/test/project");

    expect(mockInvoke).toHaveBeenCalledWith("save_project_path", {
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
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await getSavedProjectPath();

    expect(mockInvoke).toHaveBeenCalledWith("get_saved_project_path");
    expect(result).toEqual(mockResult);
  });

  it("returns null path when nothing is saved", async () => {
    const mockResult = { path: null, exists: false, has_tasks_dir: false };
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await getSavedProjectPath();

    expect(result.path).toBeNull();
  });

  it("returns exists=false for stale paths", async () => {
    const mockResult = {
      path: "/Users/test/deleted",
      exists: false,
      has_tasks_dir: false,
    };
    mockInvoke.mockResolvedValueOnce(mockResult);

    const result = await getSavedProjectPath();

    expect(result.path).toBe("/Users/test/deleted");
    expect(result.exists).toBe(false);
  });
});

describe("clearSavedProjectPath", () => {
  it("calls invoke to clear the path", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await clearSavedProjectPath();

    expect(mockInvoke).toHaveBeenCalledWith("clear_saved_project_path");
  });
});

describe("selectAndSaveProjectDirectory", () => {
  it("selects, validates, and saves the directory", async () => {
    const selectResult = {
      path: "/Users/test/project",
      has_tasks_dir: true,
    };
    mockInvoke
      .mockResolvedValueOnce(selectResult) // select_project_directory
      .mockResolvedValueOnce(undefined); // save_project_path

    const result = await selectAndSaveProjectDirectory();

    expect(result).toEqual(selectResult);
    expect(mockInvoke).toHaveBeenCalledWith("select_project_directory");
    expect(mockInvoke).toHaveBeenCalledWith("save_project_path", {
      path: "/Users/test/project",
    });
  });

  it("returns null when user cancels - no state change", async () => {
    mockInvoke.mockResolvedValueOnce(null); // select returns null

    const result = await selectAndSaveProjectDirectory();

    expect(result).toBeNull();
    // save_project_path should NOT have been called
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("calls onNoTasksDir callback when .agents/tasks/ is missing", async () => {
    const selectResult = {
      path: "/Users/test/no-tasks",
      has_tasks_dir: false,
    };
    mockInvoke
      .mockResolvedValueOnce(selectResult)
      .mockResolvedValueOnce(undefined);

    const onNoTasksDir = vi.fn();
    const result = await selectAndSaveProjectDirectory(onNoTasksDir);

    expect(result).toEqual(selectResult);
    expect(onNoTasksDir).toHaveBeenCalledWith("/Users/test/no-tasks");
  });

  it("does not call onNoTasksDir when .agents/tasks/ exists", async () => {
    const selectResult = {
      path: "/Users/test/project",
      has_tasks_dir: true,
    };
    mockInvoke
      .mockResolvedValueOnce(selectResult)
      .mockResolvedValueOnce(undefined);

    const onNoTasksDir = vi.fn();
    await selectAndSaveProjectDirectory(onNoTasksDir);

    expect(onNoTasksDir).not.toHaveBeenCalled();
  });
});

describe("loadProjectOnStartup", () => {
  it("returns project info when saved path exists and is valid", async () => {
    mockInvoke.mockResolvedValueOnce({
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
    mockInvoke.mockResolvedValueOnce({
      path: null,
      exists: false,
      has_tasks_dir: false,
    });

    const result = await loadProjectOnStartup();

    expect(result).toBeNull();
  });

  it("returns null when saved directory no longer exists", async () => {
    mockInvoke.mockResolvedValueOnce({
      path: "/Users/test/deleted",
      exists: false,
      has_tasks_dir: false,
    });

    const result = await loadProjectOnStartup();

    expect(result).toBeNull();
  });

  it("returns project with has_tasks_dir=false when dir exists but no .agents/tasks/", async () => {
    mockInvoke.mockResolvedValueOnce({
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
