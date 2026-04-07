import { invoke } from "@tauri-apps/api/core";

/**
 * Session status representing the lifecycle state of a live session.
 */
export type SessionStatus = "active" | "interrupted" | "inactive";

/**
 * Information about a live session returned from the backend.
 */
export interface LiveSessionInfo {
  exists: boolean;
  status: SessionStatus;
  session_path: string;
  available_files: string[];
  project_path: string;
}

/**
 * Result of reading a single session file.
 */
export interface SessionFileResult {
  filename: string;
  content: string | null;
  error: string | null;
  exists: boolean;
}

/**
 * Event payload emitted when session state changes.
 */
export interface SessionChangeEvent {
  status: SessionStatus;
  project_path: string;
  session_path: string;
}

/**
 * Known session files that can be read from a live session.
 */
export const SESSION_FILES = [
  "execution_plan.md",
  "progress.md",
  "task_log.md",
  "execution_context.md",
  "session_summary.md",
] as const;

export type SessionFileName = (typeof SESSION_FILES)[number];

/**
 * Check if a live session exists for the given project.
 * Returns session info including status and available files.
 */
export async function checkLiveSession(
  projectPath: string,
): Promise<LiveSessionInfo> {
  return invoke<LiveSessionInfo>("check_live_session", {
    projectPath,
  });
}

/**
 * Read a specific file from the live session directory.
 * Returns the file content if it exists, or error information.
 */
export async function readSessionFile(
  projectPath: string,
  filename: string,
): Promise<SessionFileResult> {
  return invoke<SessionFileResult>("read_session_file", {
    projectPath,
    filename,
  });
}

/**
 * Read multiple session files at once.
 * Returns a map of filename to result.
 */
export async function readSessionFiles(
  projectPath: string,
  filenames: string[],
): Promise<Map<string, SessionFileResult>> {
  const results = new Map<string, SessionFileResult>();

  const promises = filenames.map(async (filename) => {
    const result = await readSessionFile(projectPath, filename);
    results.set(filename, result);
  });

  await Promise.all(promises);
  return results;
}

/**
 * Read all known session files for a live session.
 * Returns a map of filename to result for each known session file.
 */
export async function readAllSessionFiles(
  projectPath: string,
): Promise<Map<string, SessionFileResult>> {
  return readSessionFiles(projectPath, [...SESSION_FILES]);
}

// --- Archived Session Types ---

/**
 * Parsed summary statistics from a session's session_summary.md.
 */
export interface SessionSummary {
  tasks_passed: number;
  tasks_failed: number;
  tasks_total: number;
  headline: string;
}

/**
 * Information about an archived (completed) session.
 */
export interface ArchivedSessionInfo {
  name: string;
  path: string;
  available_files: string[];
  has_summary: boolean;
  mtime_ms: number;
  summary: SessionSummary | null;
  error: string | null;
}

// --- Archived Session Functions ---

/**
 * List all archived sessions for the given project, sorted by most recent first.
 * Returns an empty array if no archived sessions exist.
 */
export async function listArchivedSessions(
  projectPath: string,
): Promise<ArchivedSessionInfo[]> {
  return invoke<ArchivedSessionInfo[]>("list_archived_sessions_cmd", {
    projectPath,
  });
}

/**
 * Read a specific file from an archived session directory.
 * The sessionName identifies which archived session to read from.
 */
export async function readArchivedSessionFile(
  projectPath: string,
  sessionName: string,
  filename: string,
): Promise<SessionFileResult> {
  return invoke<SessionFileResult>("read_archived_session_file", {
    projectPath,
    sessionName,
    filename,
  });
}
