/**
 * Project directory routes — replaces Tauri dialog and storage plugins.
 * Validates project directories and persists the selected path.
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ProjectDirectoryResult, SavedProjectDirectory, BrowseResult, DirectoryEntry } from "../types.js";

const router = Router();

// --- Settings file path ---

function settingsDir(): string {
  return path.join(os.homedir(), ".task-manager");
}

function settingsFilePath(): string {
  return path.join(settingsDir(), "settings.json");
}

interface SettingsFile {
  projectPath?: string;
  appSettings?: unknown;
}

function readSettingsFile(): SettingsFile {
  try {
    const content = fs.readFileSync(settingsFilePath(), "utf-8");
    return JSON.parse(content) as SettingsFile;
  } catch {
    return {};
  }
}

function writeSettingsFile(settings: SettingsFile): void {
  const dir = settingsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsFilePath(), JSON.stringify(settings, null, 2), "utf-8");
}

// --- Routes ---

/** GET /api/projects/browse — List directories at a given path. */
router.get("/browse", (req, res) => {
  const dirPath = (req.query.path as string) || os.homedir();

  if (!fs.existsSync(dirPath)) {
    res.status(404).json({ error: `Directory not found: ${dirPath}` });
    return;
  }

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: `Not a directory: ${dirPath}` });
      return;
    }
  } catch (e) {
    res.status(500).json({ error: `Cannot access: ${(e as Error).message}` });
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (e) {
    res.status(403).json({ error: `Permission denied: ${(e as Error).message}` });
    return;
  }

  const directories: DirectoryEntry[] = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ name: e.name, path: path.join(dirPath, e.name) }));

  const parsed = path.parse(dirPath);
  const parent = parsed.root === dirPath ? null : path.dirname(dirPath);

  const result: BrowseResult = {
    current: dirPath,
    parent,
    directories,
  };
  res.json(result);
});

/** POST /api/projects/validate — Validate a project directory path. */
router.post("/validate", (req, res) => {
  const { path: dirPath } = req.body as { path: string };
  if (!dirPath) {
    res.status(400).json({ error: "Missing path" });
    return;
  }

  if (!fs.existsSync(dirPath)) {
    res.status(404).json({ error: `Directory not found: ${dirPath}` });
    return;
  }

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: `Not a directory: ${dirPath}` });
      return;
    }
  } catch (e) {
    res.status(500).json({ error: `Cannot access: ${(e as Error).message}` });
    return;
  }

  const hasTasksDir = fs.existsSync(path.join(dirPath, ".agents", "tasks"));
  const result: ProjectDirectoryResult = {
    path: dirPath,
    has_tasks_dir: hasTasksDir,
  };
  res.json(result);
});

/** GET /api/projects/saved — Get the saved project path. */
router.get("/saved", (_req, res) => {
  const settings = readSettingsFile();
  const savedPath = settings.projectPath ?? null;

  if (!savedPath) {
    const result: SavedProjectDirectory = {
      path: null,
      exists: false,
      has_tasks_dir: false,
    };
    res.json(result);
    return;
  }

  const exists = fs.existsSync(savedPath);
  let hasTasksDir = false;

  if (exists) {
    hasTasksDir = fs.existsSync(path.join(savedPath, ".agents", "tasks"));
  } else {
    // Path no longer exists, auto-clear
    settings.projectPath = undefined;
    writeSettingsFile(settings);
  }

  const result: SavedProjectDirectory = {
    path: exists ? savedPath : null,
    exists,
    has_tasks_dir: hasTasksDir,
  };
  res.json(result);
});

/** POST /api/projects/save — Save a project directory path. */
router.post("/save", (req, res) => {
  const { path: dirPath } = req.body as { path: string };
  if (!dirPath) {
    res.status(400).json({ error: "Missing path" });
    return;
  }

  const settings = readSettingsFile();
  settings.projectPath = dirPath;
  writeSettingsFile(settings);
  res.json({ ok: true });
});

/** DELETE /api/projects/saved — Clear the saved project path. */
router.delete("/saved", (_req, res) => {
  const settings = readSettingsFile();
  settings.projectPath = undefined;
  writeSettingsFile(settings);
  res.json({ ok: true });
});

export default router;
export { readSettingsFile, writeSettingsFile, type SettingsFile };
