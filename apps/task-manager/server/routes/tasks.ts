/**
 * Task CRUD routes — ported from Rust tasks.rs.
 * Handles reading, moving, and updating task JSON files.
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import type { Task, TaskFileResult, TasksByStatus, TaskManifest } from "../types.js";
import {
  getMtimeMs,
  checkConflict,
  atomicWrite,
  nowIso8601,
  ensureDir,
} from "../file-utils.js";

const router = Router();

// --- Constants ---

const STATUS_DIRS = ["backlog", "pending", "in-progress", "completed"] as const;
const VALID_STATUSES = ["backlog", "pending", "in_progress", "completed"];
const VALID_PRIORITIES = ["critical", "high", "medium", "low"];
const VALID_COMPLEXITIES = ["XS", "S", "M", "L", "XL"];

// --- Helpers ---

function tasksBasePath(projectPath: string): string {
  return path.join(projectPath, ".agents", "tasks");
}

/** Map filesystem dir name to JSON status key: in-progress → in_progress */
function normalizeStatus(dirName: string): string {
  return dirName === "in-progress" ? "in_progress" : dirName;
}

/** Map JSON status key to filesystem dir name: in_progress → in-progress */
function statusToDirName(status: string): string {
  return status === "in_progress" ? "in-progress" : status;
}

/** Validate ISO 8601 timestamp. */
function isValidIso8601(s: string): boolean {
  const d = new Date(s);
  return !isNaN(d.getTime());
}

/** Read and parse a single task JSON file. */
function readTaskFile(filePath: string): TaskFileResult {
  const mtimeMs = getMtimeMs(filePath);
  try {
    const contents = fs.readFileSync(filePath, "utf-8");
    const task = JSON.parse(contents) as Task;
    return { type: "ok", task, file_path: filePath, mtime_ms: mtimeMs };
  } catch (e) {
    const err = e as Error;
    const isJson = err instanceof SyntaxError;
    return {
      type: "error",
      file_path: filePath,
      error: isJson ? `Invalid JSON: ${err.message}` : `Failed to read file: ${err.message}`,
    };
  }
}

/** Scan a status directory for all task group subdirectories and their task JSON files. */
function scanStatusDir(statusDir: string): TaskFileResult[] {
  const results: TaskFileResult[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(statusDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const groupDir = path.join(statusDir, entry.name);
    let fileEntries: fs.Dirent[];
    try {
      fileEntries = fs.readdirSync(groupDir, { withFileTypes: true });
    } catch (e) {
      results.push({
        type: "error",
        file_path: groupDir,
        error: `Failed to read group directory: ${(e as Error).message}`,
      });
      continue;
    }

    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile()) continue;
      if (fileEntry.name.startsWith("task-") && fileEntry.name.endsWith(".json")) {
        results.push(readTaskFile(path.join(groupDir, fileEntry.name)));
      }
    }
  }

  return results;
}

/**
 * Validate a task JSON object against the SDD task schema before writing.
 * Ported from Rust validate_task_json.
 */
function validateTaskJson(
  task: Record<string, unknown>,
  expectedStatus?: string,
): void {
  if (typeof task !== "object" || task === null || Array.isArray(task)) {
    throw new Error("Validation failed: task JSON is not an object");
  }

  // Required fields
  if (!("id" in task)) {
    throw new Error("Validation failed: missing required field 'id'");
  }
  if (!("title" in task) || typeof task.title !== "string") {
    throw new Error(
      !("title" in task)
        ? "Validation failed: missing required field 'title'"
        : "Validation failed: field 'title' must be a string",
    );
  }
  if (!("description" in task) || typeof task.description !== "string") {
    throw new Error(
      !("description" in task)
        ? "Validation failed: missing required field 'description'"
        : "Validation failed: field 'description' must be a string",
    );
  }
  if (!("status" in task) || typeof task.status !== "string") {
    throw new Error(
      !("status" in task)
        ? "Validation failed: missing required field 'status'"
        : "Validation failed: field 'status' must be a string",
    );
  }

  const status = task.status as string;
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(
      `Validation failed: field 'status' has invalid value '${status}'. Expected one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  if (expectedStatus && status !== expectedStatus) {
    throw new Error(
      `Validation failed: field 'status' is '${status}' but target directory is '${expectedStatus}'. Status must match the target directory.`,
    );
  }

  // Validate metadata if present
  const metadata = task.metadata as Record<string, unknown> | undefined;
  if (metadata && typeof metadata === "object") {
    if (metadata.priority !== undefined) {
      if (typeof metadata.priority !== "string") {
        throw new Error("Validation failed: field 'metadata.priority' must be a string");
      }
      if (!VALID_PRIORITIES.includes(metadata.priority)) {
        throw new Error(
          `Validation failed: field 'metadata.priority' has invalid value '${metadata.priority}'. Expected one of: ${VALID_PRIORITIES.join(", ")}`,
        );
      }
    }
    if (metadata.complexity !== undefined) {
      if (typeof metadata.complexity !== "string") {
        throw new Error("Validation failed: field 'metadata.complexity' must be a string");
      }
      if (!VALID_COMPLEXITIES.includes(metadata.complexity)) {
        throw new Error(
          `Validation failed: field 'metadata.complexity' has invalid value '${metadata.complexity}'. Expected one of: ${VALID_COMPLEXITIES.join(", ")}`,
        );
      }
    }
  }

  // Validate timestamps
  if (task.created_at !== undefined) {
    if (typeof task.created_at !== "string") {
      throw new Error("Validation failed: field 'created_at' must be a string");
    }
    if (!isValidIso8601(task.created_at)) {
      throw new Error(
        `Validation failed: field 'created_at' has invalid ISO 8601 timestamp '${task.created_at}'`,
      );
    }
  }
  if (task.updated_at !== undefined) {
    if (typeof task.updated_at !== "string") {
      throw new Error("Validation failed: field 'updated_at' must be a string");
    }
    if (!isValidIso8601(task.updated_at)) {
      throw new Error(
        `Validation failed: field 'updated_at' has invalid ISO 8601 timestamp '${task.updated_at}'`,
      );
    }
  }

  // Validate blocked_by
  if (task.blocked_by !== undefined && task.blocked_by !== null) {
    if (!Array.isArray(task.blocked_by)) {
      throw new Error("Validation failed: field 'blocked_by' must be an array");
    }
    for (let i = 0; i < task.blocked_by.length; i++) {
      const item = task.blocked_by[i];
      if (typeof item !== "string" && typeof item !== "number") {
        throw new Error(
          `Validation failed: field 'blocked_by[${i}]' must be a string or number, got: ${JSON.stringify(item)}`,
        );
      }
    }
  }
}

/**
 * Validate that all blocked_by IDs reference existing task files.
 * Ported from Rust validate_blocked_by_references.
 */
function validateBlockedByReferences(
  task: Record<string, unknown>,
  tasksBase: string,
): void {
  const blockedBy = task.blocked_by as (string | number)[] | undefined;
  if (!blockedBy || blockedBy.length === 0) return;

  // Build a set of all known task IDs
  const knownIds = new Set<string>();

  for (const statusDirName of STATUS_DIRS) {
    const statusDir = path.join(tasksBase, statusDirName);
    let groupEntries: fs.Dirent[];
    try {
      groupEntries = fs.readdirSync(statusDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const groupEntry of groupEntries) {
      if (!groupEntry.isDirectory()) continue;
      const groupDir = path.join(statusDir, groupEntry.name);
      let fileEntries: fs.Dirent[];
      try {
        fileEntries = fs.readdirSync(groupDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const fileEntry of fileEntries) {
        if (!fileEntry.isFile()) continue;
        if (!fileEntry.name.startsWith("task-") || !fileEntry.name.endsWith(".json")) continue;
        try {
          const contents = fs.readFileSync(path.join(groupDir, fileEntry.name), "utf-8");
          const val = JSON.parse(contents);
          if (val.id !== undefined) {
            knownIds.add(String(val.id));
          }
        } catch {
          continue;
        }
      }
    }
  }

  for (const item of blockedBy) {
    const idStr = String(item);
    if (!knownIds.has(idStr)) {
      throw new Error(
        `Validation failed: blocked_by references unknown task ID '${idStr}'. No task file found with this ID in any status directory.`,
      );
    }
  }
}

// --- Routes ---

/** GET /api/tasks?projectPath=... — Read all tasks grouped by status. */
router.get("/", (req, res) => {
  const projectPath = req.query.projectPath as string;
  if (!projectPath) {
    res.status(400).json({ error: "Missing projectPath query parameter" });
    return;
  }

  const base = tasksBasePath(projectPath);
  const result: TasksByStatus = {
    backlog: [],
    pending: [],
    in_progress: [],
    completed: [],
  };

  if (!fs.existsSync(base)) {
    res.json(result);
    return;
  }

  for (const statusDirName of STATUS_DIRS) {
    const statusDir = path.join(base, statusDirName);
    const tasks = scanStatusDir(statusDir);
    const key = normalizeStatus(statusDirName) as keyof TasksByStatus;
    result[key] = tasks;
  }

  res.json(result);
});

/** GET /api/tasks/file?filePath=... — Read a single task file. */
router.get("/file", (req, res) => {
  const filePath = req.query.filePath as string;
  if (!filePath) {
    res.status(400).json({ error: "Missing filePath query parameter" });
    return;
  }

  res.json(readTaskFile(filePath));
});

/** GET /api/tasks/groups?projectPath=... — List all task group names. */
router.get("/groups", (req, res) => {
  const projectPath = req.query.projectPath as string;
  if (!projectPath) {
    res.status(400).json({ error: "Missing projectPath query parameter" });
    return;
  }

  const base = tasksBasePath(projectPath);
  const groups = new Set<string>();

  if (!fs.existsSync(base)) {
    res.json([]);
    return;
  }

  for (const statusDirName of STATUS_DIRS) {
    const statusDir = path.join(base, statusDirName);
    try {
      const entries = fs.readdirSync(statusDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          groups.add(entry.name);
        }
      }
    } catch {
      // directory doesn't exist, skip
    }
  }

  const sorted = Array.from(groups).sort();
  res.json(sorted);
});

/** GET /api/tasks/manifest?projectPath=...&group=... — Read a task group manifest. */
router.get("/manifest", (req, res) => {
  const projectPath = req.query.projectPath as string;
  const group = req.query.group as string;
  if (!projectPath || !group) {
    res.status(400).json({ error: "Missing projectPath or group query parameter" });
    return;
  }

  const manifestPath = path.join(tasksBasePath(projectPath), "_manifests", `${group}.json`);

  if (!fs.existsSync(manifestPath)) {
    res.status(404).json({ error: `Manifest not found: ${manifestPath}` });
    return;
  }

  try {
    const contents = fs.readFileSync(manifestPath, "utf-8");
    const manifest: TaskManifest = JSON.parse(contents);
    res.json(manifest);
  } catch (e) {
    res.status(500).json({ error: `Failed to read manifest: ${(e as Error).message}` });
  }
});

/** POST /api/tasks/move — Move a task to a new status directory. */
router.post("/move", (req, res) => {
  const { filePath, newStatus, lastReadMtimeMs } = req.body as {
    filePath: string;
    newStatus: string;
    lastReadMtimeMs?: number | null;
  };

  if (!filePath || !newStatus) {
    res.status(400).json({ error: "Missing filePath or newStatus" });
    return;
  }

  try {
    // Conflict detection
    if (lastReadMtimeMs != null) {
      checkConflict(filePath, lastReadMtimeMs);
    }

    // Validate status
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new Error(
        `Invalid status '${newStatus}'. Valid statuses: ${VALID_STATUSES.join(", ")}`,
      );
    }

    // Read current task JSON
    const contents = fs.readFileSync(filePath, "utf-8");
    const taskValue = JSON.parse(contents) as Record<string, unknown>;

    // Update status and updated_at
    taskValue.status = newStatus;
    taskValue.updated_at = nowIso8601();

    // Validate
    validateTaskJson(taskValue, newStatus);

    // Determine group and tasks base from file path structure:
    // .agents/tasks/{status}/{group}/{file}.json
    const groupDir = path.dirname(filePath);
    const groupName = path.basename(groupDir);
    const statusDir = path.dirname(groupDir);
    const tasksBase = path.dirname(statusDir);

    // Validate blocked_by references
    validateBlockedByReferences(taskValue, tasksBase);

    // Build target path
    const newDirName = statusToDirName(newStatus);
    const targetGroupDir = path.join(tasksBase, newDirName, groupName);
    const fileName = path.basename(filePath);
    let targetPath = path.join(targetGroupDir, fileName);

    // Create target directory
    ensureDir(targetGroupDir);

    // Handle name collision
    if (fs.existsSync(targetPath) && targetPath !== filePath) {
      const stem = path.basename(targetPath, path.extname(targetPath));
      const ext = path.extname(targetPath).slice(1); // remove leading .
      let counter = 1;
      while (counter <= 1000) {
        const candidate = path.join(targetGroupDir, `${stem}-${counter}.${ext}`);
        if (!fs.existsSync(candidate)) {
          targetPath = candidate;
          break;
        }
        counter++;
      }
      if (counter > 1000) {
        throw new Error(`Too many name collisions at ${targetGroupDir}`);
      }
    }

    // Write atomically
    const serialized = JSON.stringify(taskValue, null, 2);
    atomicWrite(targetPath, serialized);

    // Remove original file (only if source != target)
    if (path.resolve(filePath) !== path.resolve(targetPath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore removal errors
      }
    }

    const newMtimeMs = getMtimeMs(targetPath);
    res.json({
      task: taskValue,
      file_path: targetPath,
      mtime_ms: newMtimeMs,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("Conflict:")) {
      res.status(409).json({ error: msg });
    } else if (msg.startsWith("Validation failed:")) {
      res.status(400).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

/** POST /api/tasks/update — Update specific fields in a task file. */
router.post("/update", (req, res) => {
  const { filePath, fields, lastReadMtimeMs } = req.body as {
    filePath: string;
    fields: Record<string, unknown>;
    lastReadMtimeMs?: number | null;
  };

  if (!filePath || !fields) {
    res.status(400).json({ error: "Missing filePath or fields" });
    return;
  }

  if (typeof fields !== "object" || Array.isArray(fields)) {
    res.status(400).json({ error: "Fields parameter must be a JSON object" });
    return;
  }

  try {
    // Conflict detection
    if (lastReadMtimeMs != null) {
      checkConflict(filePath, lastReadMtimeMs);
    }

    // Read current task JSON
    const contents = fs.readFileSync(filePath, "utf-8");
    const taskValue = JSON.parse(contents) as Record<string, unknown>;

    // Merge fields
    for (const [key, value] of Object.entries(fields)) {
      taskValue[key] = value;
    }

    // Always update timestamp
    taskValue.updated_at = nowIso8601();

    // Validate
    validateTaskJson(taskValue);

    // Validate blocked_by references if we can determine the tasks base path
    const groupDir = path.dirname(filePath);
    const statusDir = path.dirname(groupDir);
    const tasksBase = path.dirname(statusDir);
    if (fs.existsSync(tasksBase)) {
      validateBlockedByReferences(taskValue, tasksBase);
    }

    // Write atomically
    const serialized = JSON.stringify(taskValue, null, 2);
    atomicWrite(filePath, serialized);

    const newMtimeMs = getMtimeMs(filePath);
    res.json({
      task: taskValue,
      mtime_ms: newMtimeMs,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("Conflict:")) {
      res.status(409).json({ error: msg });
    } else if (msg.startsWith("Validation failed:")) {
      res.status(400).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
