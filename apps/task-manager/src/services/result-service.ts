import { api } from "./api-client";
import type { SessionFileResult } from "./session-service";
import { readSessionFile } from "./session-service";

/**
 * Outcome of a task result: PASS, PARTIAL, or FAIL.
 */
export type ResultOutcome = "PASS" | "PARTIAL" | "FAIL";

/**
 * Parsed result from a result-{id}.md file.
 */
export interface ParsedResult {
  /** The task ID extracted from the filename (e.g., "5" from "result-5.md"). */
  taskId: string;
  /** The filename (e.g., "result-5.md"). */
  filename: string;
  /** The task subject (from the first heading line). */
  subject: string;
  /** The outcome: PASS, PARTIAL, or FAIL. */
  outcome: ResultOutcome;
  /** The raw markdown content. */
  rawContent: string;
  /** Whether the content was truncated (for large files). */
  isTruncated: boolean;
  /** The full content size in bytes (before truncation). */
  contentSize: number;
  /** Whether parsing encountered issues (malformed file). */
  isMalformed: boolean;
  /** Warning message if the file is malformed. */
  parseWarning: string | null;
  /** Timestamp when this result was received by the frontend. */
  receivedAt: number;
}

/** Maximum content size to display without truncation (50KB). */
const MAX_DISPLAY_SIZE = 50 * 1024;

/** Truncation marker for large files. */
const TRUNCATION_SUFFIX = "\n\n---\n*Content truncated. Original size: ";

/**
 * Extract the task ID from a result filename.
 * e.g., "result-5.md" -> "5", "result-152.md" -> "152"
 */
export function extractTaskId(filename: string): string | null {
  const match = filename.match(/^result-(.+)\.md$/);
  return match ? match[1] : null;
}

/**
 * Parse the outcome (PASS/PARTIAL/FAIL) from result file content.
 * Looks for "status: PASS|PARTIAL|FAIL" line.
 */
export function parseOutcome(content: string): ResultOutcome | null {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("status:")) {
      const value = trimmed.slice("status:".length).trim().toUpperCase();
      if (value === "PASS" || value === "PARTIAL" || value === "FAIL") {
        return value;
      }
    }
  }
  return null;
}

/**
 * Parse the task subject from the first heading line.
 * Expected format: "# Task Result: [5] Subject text here"
 */
export function parseSubject(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      // Try to extract subject after the task ID bracket
      const bracketMatch = trimmed.match(/\]\s+(.+)$/);
      if (bracketMatch) {
        return bracketMatch[1];
      }
      // Fallback: return everything after "# "
      return trimmed.slice(2);
    }
  }
  return "Unknown";
}

/**
 * Parse a result file's content into a structured ParsedResult.
 */
export function parseResultContent(
  filename: string,
  content: string,
): ParsedResult {
  const taskId = extractTaskId(filename);
  const contentSize = new Blob([content]).size;

  if (!taskId) {
    return {
      taskId: "unknown",
      filename,
      subject: "Unknown",
      outcome: "FAIL",
      rawContent: content,
      isTruncated: false,
      contentSize,
      isMalformed: true,
      parseWarning: `Could not extract task ID from filename: ${filename}`,
      receivedAt: Date.now(),
    };
  }

  const outcome = parseOutcome(content);
  const subject = parseSubject(content);

  const isTruncated = contentSize > MAX_DISPLAY_SIZE;
  const displayContent = isTruncated
    ? content.slice(0, MAX_DISPLAY_SIZE) +
      `${TRUNCATION_SUFFIX}${contentSize} bytes*`
    : content;

  if (!outcome) {
    return {
      taskId,
      filename,
      subject,
      outcome: "FAIL",
      rawContent: displayContent,
      isTruncated,
      contentSize,
      isMalformed: true,
      parseWarning:
        "Could not parse outcome (status: PASS|PARTIAL|FAIL) from result file",
      receivedAt: Date.now(),
    };
  }

  return {
    taskId,
    filename,
    subject,
    outcome,
    rawContent: displayContent,
    isTruncated,
    contentSize,
    isMalformed: false,
    parseWarning: null,
    receivedAt: Date.now(),
  };
}

/**
 * List all result files in the live session directory.
 */
export async function listResultFiles(
  projectPath: string,
): Promise<string[]> {
  return api.get<string[]>("/api/sessions/results", { projectPath });
}

/**
 * Fetch and parse a single result file from the live session.
 */
export async function fetchResult(
  projectPath: string,
  filename: string,
): Promise<ParsedResult | null> {
  const result: SessionFileResult = await readSessionFile(
    projectPath,
    filename,
  );

  if (!result.exists || !result.content) {
    return null;
  }

  return parseResultContent(filename, result.content);
}

/**
 * Fetch and parse all existing result files from the live session.
 */
export async function fetchAllResults(
  projectPath: string,
): Promise<ParsedResult[]> {
  const filenames = await listResultFiles(projectPath);
  const results: ParsedResult[] = [];

  const promises = filenames.map(async (filename) => {
    const parsed = await fetchResult(projectPath, filename);
    if (parsed) {
      results.push(parsed);
    }
  });

  await Promise.all(promises);

  // Sort by receivedAt descending (newest first)
  results.sort((a, b) => b.receivedAt - a.receivedAt);
  return results;
}
