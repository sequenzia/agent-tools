/**
 * Project directory routes — multi-project management with persistence.
 * Validates project directories, manages the project list, and tracks the active project.
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  ProjectDirectoryResult,
  ProjectListResponse,
  AddProjectResponse,
  BrowseResult,
  DirectoryEntry,
} from "../types.js";

const router = Router();

// --- Settings file ---

function settingsDir(): string {
  return path.join(os.homedir(), ".task-manager");
}

function settingsFilePath(): string {
  return path.join(settingsDir(), "settings.json");
}

interface SettingsFile {
  /** Legacy single-path field (migrated on first read). */
  projectPath?: string;
  /** Persisted project paths. */
  projects?: string[];
  /** Currently active project path. */
  activeProjectPath?: string | null;
  appSettings?: unknown;
}

function readSettingsFile(): SettingsFile {
  let settings: SettingsFile;
  try {
    const content = fs.readFileSync(settingsFilePath(), "utf-8");
    settings = JSON.parse(content) as SettingsFile;
  } catch {
    return { projects: [], activeProjectPath: null };
  }

  // Auto-migrate legacy single projectPath → projects array
  if (settings.projectPath && !settings.projects) {
    settings.projects = [settings.projectPath];
    settings.activeProjectPath = settings.projectPath;
    delete settings.projectPath;
    writeSettingsFile(settings);
  }

  // Ensure defaults
  if (!settings.projects) {
    settings.projects = [];
  }
  if (settings.activeProjectPath === undefined) {
    settings.activeProjectPath = null;
  }

  return settings;
}

function writeSettingsFile(settings: SettingsFile): void {
  const dir = settingsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    settingsFilePath(),
    JSON.stringify(settings, null, 2),
    "utf-8",
  );
}

// --- Project List Routes ---

/** GET /api/projects — List all persisted projects and the active project. */
router.get("/", (_req, res) => {
  const settings = readSettingsFile();
  const result: ProjectListResponse = {
    projects: settings.projects ?? [],
    activeProjectPath: settings.activeProjectPath ?? null,
  };
  res.json(result);
});

/** POST /api/projects — Add a project to the persisted list. */
router.post("/", (req, res) => {
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

  const settings = readSettingsFile();
  const projects = settings.projects ?? [];

  // Add if not already present
  if (!projects.includes(dirPath)) {
    projects.push(dirPath);
    settings.projects = projects;
    writeSettingsFile(settings);
  }

  const result: AddProjectResponse = { ok: true, has_tasks_dir: hasTasksDir };
  res.json(result);
});

/** DELETE /api/projects — Remove a project from the persisted list. */
router.delete("/", (req, res) => {
  const { path: dirPath } = req.body as { path: string };
  if (!dirPath) {
    res.status(400).json({ error: "Missing path" });
    return;
  }

  const settings = readSettingsFile();
  const projects = settings.projects ?? [];
  settings.projects = projects.filter((p) => p !== dirPath);

  // If the removed project was active, clear it
  if (settings.activeProjectPath === dirPath) {
    // Auto-select the first remaining project (always-active rule)
    settings.activeProjectPath = settings.projects[0] ?? null;
  }

  writeSettingsFile(settings);
  res.json({ ok: true, activeProjectPath: settings.activeProjectPath });
});

/** PUT /api/projects/active — Set the active project. */
router.put("/active", (req, res) => {
  const { path: dirPath } = req.body as { path: string | null };

  const settings = readSettingsFile();
  settings.activeProjectPath = dirPath;
  writeSettingsFile(settings);
  res.json({ ok: true });
});

// --- Utility Routes (kept from legacy) ---

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
    res
      .status(403)
      .json({ error: `Permission denied: ${(e as Error).message}` });
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

export default router;
export { readSettingsFile, writeSettingsFile, type SettingsFile };
