/**
 * File system utilities ported from the Rust backend.
 * Provides atomic writes, mtime tracking, and path validation.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Get file modification time in milliseconds since epoch.
 * Returns 0 if the timestamp cannot be determined.
 */
export function getMtimeMs(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return Math.floor(stat.mtimeMs);
  } catch {
    return 0;
  }
}

/**
 * Check for a conflict between the last-known mtime and the current one.
 * Throws a descriptive error string if a conflict is detected.
 */
export function checkConflict(filePath: string, lastReadMtimeMs: number): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Conflict: task file was removed externally: ${filePath}`,
    );
  }

  const currentMtime = getMtimeMs(filePath);
  if (currentMtime !== lastReadMtimeMs) {
    throw new Error(
      `Conflict: file was modified externally since last read. ` +
        `Expected mtime ${lastReadMtimeMs} but found ${currentMtime}. ` +
        `File: ${filePath}. Refresh from disk to see the latest changes.`,
    );
  }
}

/**
 * Atomically write contents to a file: write to a temp file in the same
 * directory, then rename to the target path.
 * This prevents partial writes on crash or concurrent access.
 */
export function atomicWrite(targetPath: string, contents: string): void {
  const dir = path.dirname(targetPath);
  const basename = path.basename(targetPath);
  const tempPath = path.join(dir, `.tmp-${basename}`);

  try {
    fs.writeFileSync(tempPath, contents, "utf-8");
  } catch (e) {
    // Clean up temp file on write failure
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // ignore cleanup errors
    }
    const err = e as NodeJS.ErrnoException;
    if (err.code === "EACCES") {
      throw new Error(`Permission denied writing to ${dir}: ${err.message}`);
    }
    throw new Error(`Failed to write temp file ${tempPath}: ${err.message}`);
  }

  try {
    fs.renameSync(tempPath, targetPath);
  } catch (e) {
    // Clean up temp file if rename fails
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // ignore cleanup errors
    }
    throw new Error(
      `Failed to rename temp file to ${targetPath}: ${(e as Error).message}`,
    );
  }
}

/**
 * Validate a filename for path traversal attacks.
 * Rejects names containing /, \, .., or null bytes.
 */
export function validateFilename(filename: string): void {
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename.includes("\0")
  ) {
    throw new Error(`Invalid filename: ${filename}`);
  }
}

/**
 * Resolve a spec path against the project directory.
 * If specPath is absolute, it is used as-is.
 * If relative, it is joined to projectPath.
 * Normalizes . and .. components and rejects null bytes.
 */
export function resolveSpecPath(
  projectPath: string,
  specPath: string,
): string {
  if (specPath.includes("\0") || projectPath.includes("\0")) {
    throw new Error("Path contains invalid null byte characters");
  }

  const resolved = path.isAbsolute(specPath)
    ? specPath
    : path.join(projectPath, specPath);

  // Normalize the path (resolve . and ..)
  const normalized = path.normalize(resolved);

  // Ensure normalized path doesn't escape above root
  if (!path.isAbsolute(normalized)) {
    throw new Error(`Invalid path: resolves above filesystem root: ${specPath}`);
  }

  return normalized;
}

/**
 * Generate the current ISO 8601 timestamp string.
 */
export function nowIso8601(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}
