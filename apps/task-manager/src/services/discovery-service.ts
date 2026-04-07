/**
 * Project auto-discovery service.
 *
 * Invokes the Rust `scan_for_projects` command to recursively search
 * configured root directories for `.agents/tasks/` patterns.
 */

/** A discovered project directory. */
export interface DiscoveredProject {
  /** Absolute path to the project root. */
  path: string;
  /** The directory name (last path segment). */
  name: string;
}

/** Progress update emitted during scanning. */
export interface ScanProgress {
  /** Number of directories scanned so far. */
  dirs_scanned: number;
  /** Number of projects found so far. */
  projects_found: number;
  /** Whether the scan is complete. */
  done: boolean;
  /** The root path currently being scanned. */
  current_root: string;
}

/** Result of a full project scan. */
export interface ScanResult {
  /** All discovered projects (deduplicated). */
  projects: DiscoveredProject[];
  /** Warnings encountered during the scan. */
  warnings: string[];
  /** Total number of directories scanned. */
  dirs_scanned: number;
  /** Elapsed time in milliseconds. */
  elapsed_ms: number;
}

/**
 * Scan root directories for projects containing `.agents/tasks/`.
 *
 * @param rootPaths - Array of absolute paths to root directories to scan.
 * @param maxDepth - Maximum recursion depth (default: 3).
 * @returns Scan results with discovered projects, warnings, and timing.
 */
export async function scanForProjects(
  rootPaths: string[],
  maxDepth?: number,
): Promise<ScanResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ScanResult>("scan_for_projects", {
    rootPaths,
    maxDepth,
  });
}

/**
 * Listen for scan progress events.
 *
 * @param callback - Called with each progress update during scanning.
 * @returns An unlisten function to stop listening.
 */
export async function onScanProgress(
  callback: (progress: ScanProgress) => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ScanProgress>(
    "project-scan-progress",
    (event) => {
      callback(event.payload);
    },
  );
  return unlisten;
}
