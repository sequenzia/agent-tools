/**
 * Discovery routes — ported from Rust discovery.rs.
 * Recursively scans directories for projects containing .agents/tasks/.
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import type { DiscoveredProject, ScanResult, ScanProgress } from "../types.js";
import type { WebSocketBroadcast } from "../watcher.js";

const MAX_DIRS_SCANNED = 50_000;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "target",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  ".cache",
  ".npm",
  ".yarn",
  "vendor",
]);

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".");
}

function hasTasksDir(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, ".agents", "tasks")).isDirectory();
  } catch {
    return false;
  }
}

export function createDiscoveryRouter(broadcast: WebSocketBroadcast): Router {
  const router = Router();

  /** POST /api/discovery/scan — Scan for projects. */
  router.post("/scan", (req, res) => {
    const { rootPaths, maxDepth } = req.body as {
      rootPaths: string[];
      maxDepth?: number;
    };

    if (!rootPaths || !Array.isArray(rootPaths)) {
      res.status(400).json({ error: "Missing rootPaths array" });
      return;
    }

    const depth = maxDepth ?? 3;
    const start = Date.now();
    const discovered: DiscoveredProject[] = [];
    const warnings: string[] = [];
    const seenCanonical = new Set<string>();
    let dirsScanned = 0;

    for (const rootStr of rootPaths) {
      if (!fs.existsSync(rootStr)) {
        warnings.push(`Root directory does not exist: ${rootStr}`);
        continue;
      }

      try {
        const stat = fs.statSync(rootStr);
        if (!stat.isDirectory()) {
          warnings.push(`Not a directory: ${rootStr}`);
          continue;
        }
      } catch {
        warnings.push(`Cannot access: ${rootStr}`);
        continue;
      }

      // BFS queue: [path, depth]
      const queue: [string, number][] = [[rootStr, 0]];

      while (queue.length > 0) {
        if (dirsScanned >= MAX_DIRS_SCANNED) {
          warnings.push(
            `Safety limit reached: scanned ${MAX_DIRS_SCANNED} directories, stopping`,
          );
          break;
        }

        const [dir, currentDepth] = queue.pop()!;
        dirsScanned++;

        // Symlink cycle detection via canonical path
        let canonical: string;
        try {
          canonical = fs.realpathSync(dir);
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          if (err.code === "EACCES") {
            warnings.push(`Permission denied: ${dir}`);
          }
          continue;
        }

        if (seenCanonical.has(canonical)) continue;
        seenCanonical.add(canonical);

        // Check if this directory has .agents/tasks/
        if (hasTasksDir(dir)) {
          discovered.push({
            name: path.basename(dir) || dir,
            path: dir,
          });
        }

        // Emit progress periodically
        if (dirsScanned % 50 === 0) {
          const progress: ScanProgress = {
            dirs_scanned: dirsScanned,
            projects_found: discovered.length,
            done: false,
            current_root: rootStr,
          };
          broadcast("project-scan-progress", progress);
        }

        // Don't recurse deeper than maxDepth
        if (currentDepth >= depth) continue;

        // Skip known non-project dirs
        const dirName = path.basename(dir);
        if (currentDepth > 0 && shouldSkipDir(dirName)) continue;

        // Read directory entries
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
          const err = e as NodeJS.ErrnoException;
          if (err.code === "EACCES") {
            warnings.push(`Permission denied: ${dir}`);
          }
          continue;
        }

        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            queue.push([entryPath, currentDepth + 1]);
          } else if (entry.isSymbolicLink()) {
            // For symlinks, verify the target is a directory
            try {
              if (fs.statSync(entryPath).isDirectory()) {
                queue.push([entryPath, currentDepth + 1]);
              }
            } catch {
              // broken symlink, skip
            }
          }
        }
      }
    }

    // Emit final progress
    broadcast("project-scan-progress", {
      dirs_scanned: dirsScanned,
      projects_found: discovered.length,
      done: true,
      current_root: rootPaths[rootPaths.length - 1] ?? "",
    } satisfies ScanProgress);

    const result: ScanResult = {
      projects: discovered,
      warnings,
      dirs_scanned: dirsScanned,
      elapsed_ms: Date.now() - start,
    };
    res.json(result);
  });

  return router;
}
