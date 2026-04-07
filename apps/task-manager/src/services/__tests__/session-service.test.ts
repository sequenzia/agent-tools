import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkLiveSession,
  readSessionFile,
  readSessionFiles,
  readAllSessionFiles,
  listArchivedSessions,
  readArchivedSessionFile,
  SESSION_FILES,
} from "../session-service";

// Mock api-client
vi.mock("../api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

import { api } from "../api-client";
const mockGet = vi.mocked(api.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkLiveSession", () => {
  it("returns inactive when no live session exists", async () => {
    mockGet.mockResolvedValueOnce({
      exists: false,
      status: "inactive",
      session_path: "/project/.agents/sessions/__live_session__",
      available_files: [],
      project_path: "/project",
    });

    const result = await checkLiveSession("/project");

    expect(mockGet).toHaveBeenCalledWith("/api/sessions/live", {
      projectPath: "/project",
    });
    expect(result.exists).toBe(false);
    expect(result.status).toBe("inactive");
    expect(result.available_files).toEqual([]);
  });

  it("returns active when live session with lock exists", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      status: "active",
      session_path: "/project/.agents/sessions/__live_session__",
      available_files: ["progress.md", "execution_plan.md"],
      project_path: "/project",
    });

    const result = await checkLiveSession("/project");

    expect(result.exists).toBe(true);
    expect(result.status).toBe("active");
    expect(result.available_files).toContain("progress.md");
    expect(result.available_files).toContain("execution_plan.md");
  });

  it("returns interrupted when live session exists without lock", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      status: "interrupted",
      session_path: "/project/.agents/sessions/__live_session__",
      available_files: ["progress.md"],
      project_path: "/project",
    });

    const result = await checkLiveSession("/project");

    expect(result.exists).toBe(true);
    expect(result.status).toBe("interrupted");
  });

  it("propagates IPC errors", async () => {
    mockGet.mockRejectedValueOnce("Permission denied");

    await expect(checkLiveSession("/project")).rejects.toBe(
      "Permission denied",
    );
  });
});

describe("readSessionFile", () => {
  it("reads a session file successfully", async () => {
    mockGet.mockResolvedValueOnce({
      filename: "progress.md",
      content: "Wave 2 of 3",
      error: null,
      exists: true,
    });

    const result = await readSessionFile("/project", "progress.md");

    expect(mockGet).toHaveBeenCalledWith("/api/sessions/file", {
      projectPath: "/project",
      filename: "progress.md",
    });
    expect(result.exists).toBe(true);
    expect(result.content).toBe("Wave 2 of 3");
    expect(result.error).toBeNull();
  });

  it("returns not found for missing file", async () => {
    mockGet.mockResolvedValueOnce({
      filename: "nonexistent.md",
      content: null,
      error: null,
      exists: false,
    });

    const result = await readSessionFile("/project", "nonexistent.md");

    expect(result.exists).toBe(false);
    expect(result.content).toBeNull();
  });

  it("returns error for unreadable file", async () => {
    mockGet.mockResolvedValueOnce({
      filename: "progress.md",
      content: null,
      error: "Failed to read file: permission denied",
      exists: true,
    });

    const result = await readSessionFile("/project", "progress.md");

    expect(result.exists).toBe(true);
    expect(result.content).toBeNull();
    expect(result.error).toBe("Failed to read file: permission denied");
  });

  it("rejects path traversal filenames", async () => {
    mockGet.mockRejectedValueOnce("Invalid filename: ../etc/passwd");

    await expect(readSessionFile("/project", "../etc/passwd")).rejects.toBe(
      "Invalid filename: ../etc/passwd",
    );
  });
});

describe("readSessionFiles", () => {
  it("reads multiple files in parallel", async () => {
    mockGet
      .mockResolvedValueOnce({
        filename: "progress.md",
        content: "Wave 1",
        error: null,
        exists: true,
      })
      .mockResolvedValueOnce({
        filename: "task_log.md",
        content: "| Task | Status |",
        error: null,
        exists: true,
      });

    const results = await readSessionFiles("/project", [
      "progress.md",
      "task_log.md",
    ]);

    expect(results.size).toBe(2);
    expect(results.get("progress.md")?.content).toBe("Wave 1");
    expect(results.get("task_log.md")?.content).toBe("| Task | Status |");
  });

  it("handles mixed success and failure", async () => {
    mockGet
      .mockResolvedValueOnce({
        filename: "progress.md",
        content: "Wave 1",
        error: null,
        exists: true,
      })
      .mockResolvedValueOnce({
        filename: "missing.md",
        content: null,
        error: null,
        exists: false,
      });

    const results = await readSessionFiles("/project", [
      "progress.md",
      "missing.md",
    ]);

    expect(results.size).toBe(2);
    expect(results.get("progress.md")?.exists).toBe(true);
    expect(results.get("missing.md")?.exists).toBe(false);
  });
});

describe("readAllSessionFiles", () => {
  it("reads all known session files", async () => {
    for (const file of SESSION_FILES) {
      mockGet.mockResolvedValueOnce({
        filename: file,
        content: `Content of ${file}`,
        error: null,
        exists: true,
      });
    }

    const results = await readAllSessionFiles("/project");

    expect(results.size).toBe(SESSION_FILES.length);
    for (const file of SESSION_FILES) {
      expect(results.has(file)).toBe(true);
    }
  });
});

describe("SESSION_FILES constant", () => {
  it("contains the expected session files", () => {
    expect(SESSION_FILES).toContain("execution_plan.md");
    expect(SESSION_FILES).toContain("progress.md");
    expect(SESSION_FILES).toContain("task_log.md");
    expect(SESSION_FILES).toContain("execution_context.md");
    expect(SESSION_FILES).toContain("session_summary.md");
  });
});

describe("listArchivedSessions", () => {
  it("returns list of archived sessions sorted by most recent first", async () => {
    const sessions = [
      {
        name: "exec-session-20260406-140000",
        path: "/project/.agents/sessions/exec-session-20260406-140000",
        available_files: ["session_summary.md", "execution_plan.md"],
        has_summary: true,
        mtime_ms: 1712404800000,
        summary: {
          tasks_passed: 8,
          tasks_failed: 2,
          tasks_total: 10,
          headline: "# Session Summary",
        },
        error: null,
      },
      {
        name: "exec-session-20260405-120000",
        path: "/project/.agents/sessions/exec-session-20260405-120000",
        available_files: ["execution_plan.md"],
        has_summary: false,
        mtime_ms: 1712318400000,
        summary: null,
        error: null,
      },
    ];
    mockGet.mockResolvedValueOnce(sessions);

    const result = await listArchivedSessions("/project");

    expect(mockGet).toHaveBeenCalledWith("/api/sessions/archived", {
      projectPath: "/project",
    });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("exec-session-20260406-140000");
    expect(result[0].summary?.tasks_passed).toBe(8);
  });

  it("returns empty array when no sessions exist", async () => {
    mockGet.mockResolvedValueOnce([]);

    const result = await listArchivedSessions("/project");

    expect(result).toEqual([]);
  });

  it("propagates IPC errors", async () => {
    mockGet.mockRejectedValueOnce("Failed to read sessions directory");

    await expect(listArchivedSessions("/project")).rejects.toBe(
      "Failed to read sessions directory",
    );
  });
});

describe("readArchivedSessionFile", () => {
  it("reads a file from an archived session", async () => {
    mockGet.mockResolvedValueOnce({
      filename: "execution_plan.md",
      content: "# Execution Plan\nWave 1: tasks 1,2,3",
      error: null,
      exists: true,
    });

    const result = await readArchivedSessionFile(
      "/project",
      "exec-session-20260406-140000",
      "execution_plan.md",
    );

    expect(mockGet).toHaveBeenCalledWith("/api/sessions/archived/file", {
      projectPath: "/project",
      sessionName: "exec-session-20260406-140000",
      filename: "execution_plan.md",
    });
    expect(result.exists).toBe(true);
    expect(result.content).toBe("# Execution Plan\nWave 1: tasks 1,2,3");
  });

  it("returns not found for missing file", async () => {
    mockGet.mockResolvedValueOnce({
      filename: "nonexistent.md",
      content: null,
      error: null,
      exists: false,
    });

    const result = await readArchivedSessionFile(
      "/project",
      "exec-session-20260406-140000",
      "nonexistent.md",
    );

    expect(result.exists).toBe(false);
    expect(result.content).toBeNull();
  });

  it("rejects access to live session", async () => {
    mockGet.mockRejectedValueOnce(
      "Use read_session_file for live session access",
    );

    await expect(
      readArchivedSessionFile("/project", "__live_session__", "progress.md"),
    ).rejects.toBe("Use read_session_file for live session access");
  });
});
