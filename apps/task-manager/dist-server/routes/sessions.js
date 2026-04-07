/**
 * Session routes — ported from Rust session.rs.
 * Handles live session status, file reading, archived sessions, and result files.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { getMtimeMs, validateFilename } from "../file-utils.js";
import { parseSessionSummary } from "../session-parser.js";
const router = Router();
// --- Constants ---
const KNOWN_SESSION_FILES = [
    "execution_plan.md",
    "progress.md",
    "task_log.md",
    "execution_context.md",
    "session_summary.md",
];
// --- Helpers ---
function liveSessionPath(projectPath) {
    return path.join(projectPath, ".agents", "sessions", "__live_session__");
}
function sessionsDir(projectPath) {
    return path.join(projectPath, ".agents", "sessions");
}
function hasLockFile(sessionPath) {
    return fs.existsSync(path.join(sessionPath, ".lock"));
}
/** List available session files in a session directory. */
function listAvailableFiles(sessionPath) {
    const files = [];
    for (const filename of KNOWN_SESSION_FILES) {
        const filePath = path.join(sessionPath, filename);
        try {
            if (fs.statSync(filePath).isFile()) {
                files.push(filename);
            }
        }
        catch {
            // file doesn't exist
        }
    }
    // Also check for result files (result-*.md pattern)
    try {
        const entries = fs.readdirSync(sessionPath);
        for (const name of entries) {
            if (name.startsWith("result-") && name.endsWith(".md")) {
                files.push(name);
            }
        }
    }
    catch {
        // directory not readable
    }
    return files;
}
/** Determine session status from filesystem state. */
export function classifySessionStatus(projectPath) {
    const sessionPath = liveSessionPath(projectPath);
    try {
        const stat = fs.statSync(sessionPath);
        if (!stat.isDirectory())
            return "inactive";
    }
    catch {
        return "inactive";
    }
    return hasLockFile(sessionPath) ? "active" : "interrupted";
}
/** Build an ArchivedSessionInfo for a single session directory. */
function buildArchivedSessionInfo(sessionsDirectory, dirName) {
    const sessionPath = path.join(sessionsDirectory, dirName);
    const availableFiles = listAvailableFiles(sessionPath);
    const hasSummary = availableFiles.includes("session_summary.md");
    const mtimeMs = getMtimeMs(sessionPath);
    let summary = null;
    let error = null;
    if (hasSummary) {
        try {
            const content = fs.readFileSync(path.join(sessionPath, "session_summary.md"), "utf-8");
            summary = parseSessionSummary(content);
        }
        catch (e) {
            error = `Failed to read session_summary.md: ${e.message}`;
        }
    }
    return {
        name: dirName,
        path: sessionPath,
        available_files: availableFiles,
        has_summary: hasSummary,
        mtime_ms: mtimeMs,
        summary,
        error,
    };
}
// --- Routes ---
/** GET /api/sessions/live?projectPath=... — Check live session status. */
router.get("/live", (req, res) => {
    const projectPath = req.query.projectPath;
    if (!projectPath) {
        res.status(400).json({ error: "Missing projectPath query parameter" });
        return;
    }
    const sessionPath = liveSessionPath(projectPath);
    try {
        const stat = fs.statSync(sessionPath);
        if (!stat.isDirectory()) {
            throw new Error("not a directory");
        }
    }
    catch {
        const info = {
            exists: false,
            status: "inactive",
            session_path: sessionPath,
            available_files: [],
            project_path: projectPath,
        };
        res.json(info);
        return;
    }
    // Check read permission
    try {
        fs.readdirSync(sessionPath);
    }
    catch (e) {
        res.status(500).json({
            error: `Permission denied on session directory: ${e.message}`,
        });
        return;
    }
    const hasLock = hasLockFile(sessionPath);
    const status = hasLock ? "active" : "interrupted";
    const availableFiles = listAvailableFiles(sessionPath);
    const info = {
        exists: true,
        status,
        session_path: sessionPath,
        available_files: availableFiles,
        project_path: projectPath,
    };
    res.json(info);
});
/** GET /api/sessions/file?projectPath=...&filename=... — Read a live session file. */
router.get("/file", (req, res) => {
    const projectPath = req.query.projectPath;
    const filename = req.query.filename;
    if (!projectPath || !filename) {
        res.status(400).json({ error: "Missing projectPath or filename query parameter" });
        return;
    }
    try {
        validateFilename(filename);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
        return;
    }
    const sessionPath = liveSessionPath(projectPath);
    const filePath = path.join(sessionPath, filename);
    if (!fs.existsSync(filePath)) {
        const result = {
            filename,
            content: null,
            error: null,
            exists: false,
        };
        res.json(result);
        return;
    }
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const result = {
            filename,
            content,
            error: null,
            exists: true,
        };
        res.json(result);
    }
    catch (e) {
        const result = {
            filename,
            content: null,
            error: `Failed to read file: ${e.message}`,
            exists: true,
        };
        res.json(result);
    }
});
/** GET /api/sessions/results?projectPath=... — List result-*.md files. */
router.get("/results", (req, res) => {
    const projectPath = req.query.projectPath;
    if (!projectPath) {
        res.status(400).json({ error: "Missing projectPath query parameter" });
        return;
    }
    const sessionPath = liveSessionPath(projectPath);
    try {
        const stat = fs.statSync(sessionPath);
        if (!stat.isDirectory()) {
            res.json([]);
            return;
        }
    }
    catch {
        res.json([]);
        return;
    }
    try {
        const entries = fs.readdirSync(sessionPath);
        const resultFiles = entries
            .filter((name) => name.startsWith("result-") && name.endsWith(".md"))
            .sort();
        res.json(resultFiles);
    }
    catch (e) {
        res.status(500).json({
            error: `Failed to read session directory: ${e.message}`,
        });
    }
});
/** GET /api/sessions/archived?projectPath=... — List archived sessions. */
router.get("/archived", (req, res) => {
    const projectPath = req.query.projectPath;
    if (!projectPath) {
        res.status(400).json({ error: "Missing projectPath query parameter" });
        return;
    }
    const dir = sessionsDir(projectPath);
    if (!fs.existsSync(dir)) {
        res.json([]);
        return;
    }
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const sessions = [];
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name !== "__live_session__") {
                sessions.push(buildArchivedSessionInfo(dir, entry.name));
            }
        }
        // Sort by most recent first
        sessions.sort((a, b) => b.mtime_ms - a.mtime_ms);
        res.json(sessions);
    }
    catch (e) {
        res.status(500).json({
            error: `Failed to read sessions directory: ${e.message}`,
        });
    }
});
/** GET /api/sessions/archived/file?projectPath=...&sessionName=...&filename=... */
router.get("/archived/file", (req, res) => {
    const projectPath = req.query.projectPath;
    const sessionName = req.query.sessionName;
    const filename = req.query.filename;
    if (!projectPath || !sessionName || !filename) {
        res.status(400).json({ error: "Missing required query parameters" });
        return;
    }
    // Security: validate both names
    try {
        validateFilename(sessionName);
        validateFilename(filename);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
        return;
    }
    // Reject __live_session__ access through this endpoint
    if (sessionName === "__live_session__") {
        res.status(400).json({
            error: "Use the live session endpoint for live session access",
        });
        return;
    }
    const sessionPath = path.join(sessionsDir(projectPath), sessionName);
    if (!fs.existsSync(sessionPath) || !fs.statSync(sessionPath).isDirectory()) {
        res.status(404).json({ error: `Session directory not found: ${sessionName}` });
        return;
    }
    const filePath = path.join(sessionPath, filename);
    if (!fs.existsSync(filePath)) {
        const result = {
            filename,
            content: null,
            error: null,
            exists: false,
        };
        res.json(result);
        return;
    }
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const result = {
            filename,
            content,
            error: null,
            exists: true,
        };
        res.json(result);
    }
    catch (e) {
        const result = {
            filename,
            content: null,
            error: `Failed to read file: ${e.message}`,
            exists: true,
        };
        res.json(result);
    }
});
export default router;
//# sourceMappingURL=sessions.js.map