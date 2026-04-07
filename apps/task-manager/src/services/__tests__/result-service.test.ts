import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTaskId,
  parseOutcome,
  parseSubject,
  parseResultContent,
  listResultFiles,
  fetchResult,
  fetchAllResults,
} from "../result-service";

// Mock api-client
vi.mock("../api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

// Mock session-service (readSessionFile is used by fetchResult)
vi.mock("../session-service", () => ({
  readSessionFile: vi.fn(),
}));

import { api } from "../api-client";
import { readSessionFile } from "../session-service";

const mockGet = vi.mocked(api.get);
const mockReadSessionFile = vi.mocked(readSessionFile);

beforeEach(() => {
  vi.clearAllMocks();
});

const SAMPLE_RESULT = `# Task Result: [5] Implement user authentication
status: PASS
attempt: 1/3

## Verification
- Functional: 3/3
- Edge Cases: 2/2
- Error Handling: 1/1
- Tests: 12/12 (0 failures)

## Files Modified
- src/auth.ts: Added authentication service

## Issues
None
`;

const PARTIAL_RESULT = `# Task Result: [10] Build dashboard widget
status: PARTIAL
attempt: 2/3

## Verification
- Functional: 3/3
- Edge Cases: 1/2
- Tests: 8/8 (0 failures)

## Issues
- Edge case: large data set not handled
`;

const FAIL_RESULT = `# Task Result: [42] Fix login bug
status: FAIL
attempt: 1/3

## Verification
- Functional: 1/3
- Tests: 5/8 (3 failures)

## Issues
- test_login_flow: assertion error
`;

describe("extractTaskId", () => {
  it("extracts numeric ID from standard filename", () => {
    expect(extractTaskId("result-5.md")).toBe("5");
  });

  it("extracts multi-digit ID", () => {
    expect(extractTaskId("result-152.md")).toBe("152");
  });

  it("extracts string ID with task prefix", () => {
    expect(extractTaskId("result-task-5.md")).toBe("task-5");
  });

  it("returns null for non-matching filename", () => {
    expect(extractTaskId("progress.md")).toBeNull();
    expect(extractTaskId("context-task-5.md")).toBeNull();
    expect(extractTaskId("result-.md")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTaskId("")).toBeNull();
  });
});

describe("parseOutcome", () => {
  it("parses PASS status", () => {
    expect(parseOutcome(SAMPLE_RESULT)).toBe("PASS");
  });

  it("parses PARTIAL status", () => {
    expect(parseOutcome(PARTIAL_RESULT)).toBe("PARTIAL");
  });

  it("parses FAIL status", () => {
    expect(parseOutcome(FAIL_RESULT)).toBe("FAIL");
  });

  it("handles case-insensitive status", () => {
    expect(parseOutcome("status: pass")).toBe("PASS");
    expect(parseOutcome("status: Partial")).toBe("PARTIAL");
    expect(parseOutcome("status: fail")).toBe("FAIL");
  });

  it("returns null for content without status line", () => {
    expect(parseOutcome("# Some heading\nNo status here")).toBeNull();
  });

  it("returns null for invalid status value", () => {
    expect(parseOutcome("status: UNKNOWN")).toBeNull();
  });
});

describe("parseSubject", () => {
  it("extracts subject from standard heading", () => {
    expect(parseSubject(SAMPLE_RESULT)).toBe(
      "Implement user authentication",
    );
  });

  it("extracts subject with different task ID", () => {
    expect(parseSubject(PARTIAL_RESULT)).toBe("Build dashboard widget");
  });

  it("returns heading content when no bracket pattern", () => {
    expect(parseSubject("# Just a heading\nstatus: PASS")).toBe(
      "Just a heading",
    );
  });

  it("returns 'Unknown' when no heading found", () => {
    expect(parseSubject("No heading here")).toBe("Unknown");
  });
});

describe("parseResultContent", () => {
  it("parses a well-formed PASS result", () => {
    const result = parseResultContent("result-5.md", SAMPLE_RESULT);

    expect(result.taskId).toBe("5");
    expect(result.filename).toBe("result-5.md");
    expect(result.subject).toBe("Implement user authentication");
    expect(result.outcome).toBe("PASS");
    expect(result.isMalformed).toBe(false);
    expect(result.parseWarning).toBeNull();
    expect(result.isTruncated).toBe(false);
    expect(result.rawContent).toBe(SAMPLE_RESULT);
  });

  it("parses a PARTIAL result", () => {
    const result = parseResultContent("result-10.md", PARTIAL_RESULT);

    expect(result.taskId).toBe("10");
    expect(result.outcome).toBe("PARTIAL");
    expect(result.isMalformed).toBe(false);
  });

  it("parses a FAIL result", () => {
    const result = parseResultContent("result-42.md", FAIL_RESULT);

    expect(result.taskId).toBe("42");
    expect(result.outcome).toBe("FAIL");
    expect(result.isMalformed).toBe(false);
  });

  it("handles malformed file without status line", () => {
    const content = "# Some content\nNo status here";
    const result = parseResultContent("result-7.md", content);

    expect(result.taskId).toBe("7");
    expect(result.outcome).toBe("FAIL");
    expect(result.isMalformed).toBe(true);
    expect(result.parseWarning).toContain("Could not parse outcome");
  });

  it("handles invalid filename gracefully", () => {
    const result = parseResultContent("invalid.md", SAMPLE_RESULT);

    expect(result.taskId).toBe("unknown");
    expect(result.isMalformed).toBe(true);
    expect(result.parseWarning).toContain("Could not extract task ID");
  });

  it("truncates content larger than 50KB", () => {
    const largeContent =
      "# Task Result: [1] Test\nstatus: PASS\n" + "x".repeat(60 * 1024);
    const result = parseResultContent("result-1.md", largeContent);

    expect(result.isTruncated).toBe(true);
    expect(result.contentSize).toBeGreaterThan(50 * 1024);
    expect(result.rawContent.length).toBeLessThan(largeContent.length);
    expect(result.rawContent).toContain("Content truncated");
  });

  it("does not truncate content under 50KB", () => {
    const result = parseResultContent("result-5.md", SAMPLE_RESULT);
    expect(result.isTruncated).toBe(false);
    expect(result.rawContent).toBe(SAMPLE_RESULT);
  });

  it("sets receivedAt timestamp", () => {
    const before = Date.now();
    const result = parseResultContent("result-5.md", SAMPLE_RESULT);
    const after = Date.now();

    expect(result.receivedAt).toBeGreaterThanOrEqual(before);
    expect(result.receivedAt).toBeLessThanOrEqual(after);
  });
});

describe("listResultFiles", () => {
  it("invokes the list_result_files command", async () => {
    mockGet.mockResolvedValueOnce([
      "result-5.md",
      "result-10.md",
    ]);

    const files = await listResultFiles("/project");

    expect(mockGet).toHaveBeenCalledWith("/api/sessions/results", {
      projectPath: "/project",
    });
    expect(files).toEqual(["result-5.md", "result-10.md"]);
  });

  it("returns empty array when no results", async () => {
    mockGet.mockResolvedValueOnce([]);
    const files = await listResultFiles("/project");
    expect(files).toEqual([]);
  });
});

describe("fetchResult", () => {
  it("fetches and parses a result file", async () => {
    mockReadSessionFile.mockResolvedValueOnce({
      filename: "result-5.md",
      content: SAMPLE_RESULT,
      error: null,
      exists: true,
    });

    const result = await fetchResult("/project", "result-5.md");

    expect(result).not.toBeNull();
    expect(result!.taskId).toBe("5");
    expect(result!.outcome).toBe("PASS");
    expect(result!.subject).toBe("Implement user authentication");
  });

  it("returns null for non-existent file", async () => {
    mockReadSessionFile.mockResolvedValueOnce({
      filename: "result-99.md",
      content: null,
      error: null,
      exists: false,
    });

    const result = await fetchResult("/project", "result-99.md");
    expect(result).toBeNull();
  });

  it("returns null when content is empty", async () => {
    mockReadSessionFile.mockResolvedValueOnce({
      filename: "result-5.md",
      content: null,
      error: "Read error",
      exists: true,
    });

    const result = await fetchResult("/project", "result-5.md");
    expect(result).toBeNull();
  });
});

describe("fetchAllResults", () => {
  it("fetches and parses all result files", async () => {
    mockGet.mockResolvedValueOnce(["result-5.md", "result-10.md"]);
    mockReadSessionFile
      .mockResolvedValueOnce({
        filename: "result-5.md",
        content: SAMPLE_RESULT,
        error: null,
        exists: true,
      })
      .mockResolvedValueOnce({
        filename: "result-10.md",
        content: PARTIAL_RESULT,
        error: null,
        exists: true,
      });

    const results = await fetchAllResults("/project");

    expect(results.length).toBe(2);
    // Sorted by receivedAt descending (newest first)
    expect(results[0].outcome === "PASS" || results[0].outcome === "PARTIAL").toBe(true);
  });

  it("handles empty result list", async () => {
    mockGet.mockResolvedValueOnce([]);
    const results = await fetchAllResults("/project");
    expect(results).toEqual([]);
  });

  it("skips files that fail to fetch", async () => {
    mockGet.mockResolvedValueOnce(["result-5.md", "result-99.md"]);
    mockReadSessionFile
      .mockResolvedValueOnce({
        filename: "result-5.md",
        content: SAMPLE_RESULT,
        error: null,
        exists: true,
      })
      .mockResolvedValueOnce({
        filename: "result-99.md",
        content: null,
        error: null,
        exists: false,
      });

    const results = await fetchAllResults("/project");
    expect(results.length).toBe(1);
    expect(results[0].taskId).toBe("5");
  });
});
