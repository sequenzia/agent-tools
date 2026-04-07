/**
 * Spec routes — ported from Rust specs.rs.
 * Handles spec file reading, analysis checking, and lifecycle determination.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { resolveSpecPath, getMtimeMs } from "../file-utils.js";
const router = Router();
// --- Helpers ---
/** Derive the analysis file path from a spec path. */
function analysisPathFor(specPath) {
    const dir = path.dirname(specPath);
    const stem = path.basename(specPath, path.extname(specPath));
    return path.join(dir, `${stem}.analysis.md`);
}
// --- Routes ---
/** GET /api/specs/read?projectPath=...&specPath=... — Read a spec file. */
router.get("/read", (req, res) => {
    const projectPath = req.query.projectPath;
    const specPath = req.query.specPath;
    if (!projectPath || !specPath) {
        res.status(400).json({ error: "Missing projectPath or specPath" });
        return;
    }
    try {
        const resolved = resolveSpecPath(projectPath, specPath);
        if (!fs.existsSync(resolved)) {
            res.status(404).json({ error: `Spec file not found: ${resolved}` });
            return;
        }
        const stat = fs.statSync(resolved);
        if (!stat.isFile()) {
            res.status(400).json({ error: `Path is not a file: ${resolved}` });
            return;
        }
        const content = fs.readFileSync(resolved, "utf-8");
        const result = {
            content,
            resolved_path: resolved,
            size: stat.size,
        };
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
/** GET /api/specs/analysis?projectPath=...&specPath=... — Check for analysis file. */
router.get("/analysis", (req, res) => {
    const projectPath = req.query.projectPath;
    const specPath = req.query.specPath;
    if (!projectPath || !specPath) {
        res.status(400).json({ error: "Missing projectPath or specPath" });
        return;
    }
    try {
        const resolved = resolveSpecPath(projectPath, specPath);
        const analysis = analysisPathFor(resolved);
        const exists = fs.existsSync(analysis) && fs.statSync(analysis).isFile();
        const result = {
            exists,
            analysis_path: analysis,
        };
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
/** GET /api/specs/lifecycle?projectPath=...&specPath=...&taskGroup=... */
router.get("/lifecycle", (req, res) => {
    const projectPath = req.query.projectPath;
    const specPath = req.query.specPath;
    const taskGroup = req.query.taskGroup;
    if (!projectPath || !specPath) {
        res.status(400).json({ error: "Missing projectPath or specPath" });
        return;
    }
    try {
        const resolved = resolveSpecPath(projectPath, specPath);
        // Check if spec file exists
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
            const info = {
                current_stage: "unknown",
                completed_stages: [],
                spec_modified_after_tasks: false,
                has_analysis: false,
                total_tasks: 0,
                completed_tasks: 0,
                has_live_session: false,
            };
            res.json(info);
            return;
        }
        const completedStages = ["created"];
        // Check analysis file
        const analysis = analysisPathFor(resolved);
        const hasAnalysis = fs.existsSync(analysis) && fs.statSync(analysis).isFile();
        if (hasAnalysis) {
            completedStages.push("analyzed");
        }
        // Derive task_group from spec filename if not provided
        const group = taskGroup ||
            (() => {
                const stem = path.basename(resolved, path.extname(resolved));
                return stem.endsWith("-SPEC") ? stem.slice(0, -5) : stem;
            })();
        // Check for tasks with matching task_group
        const tasksBase = path.join(projectPath, ".agents", "tasks");
        const statusDirs = ["backlog", "pending", "in-progress", "completed"];
        let totalTasks = 0;
        let completedTasks = 0;
        let hasTasks = false;
        let latestTaskMtime = 0;
        for (const statusDir of statusDirs) {
            const groupDir = path.join(tasksBase, statusDir, group);
            if (!fs.existsSync(groupDir) || !fs.statSync(groupDir).isDirectory())
                continue;
            try {
                const entries = fs.readdirSync(groupDir);
                for (const name of entries) {
                    const filePath = path.join(groupDir, name);
                    if (name.startsWith("task-") &&
                        name.endsWith(".json") &&
                        fs.statSync(filePath).isFile()) {
                        totalTasks++;
                        hasTasks = true;
                        if (statusDir === "completed") {
                            completedTasks++;
                        }
                        const mtime = getMtimeMs(filePath);
                        if (mtime > latestTaskMtime) {
                            latestTaskMtime = mtime;
                        }
                    }
                }
            }
            catch {
                // directory not readable
            }
        }
        if (hasTasks) {
            completedStages.push("tasks_generated");
        }
        // Check for live session
        const liveSessionPath = path.join(projectPath, ".agents", "sessions", "__live_session__");
        const hasLiveSession = fs.existsSync(liveSessionPath) &&
            fs.statSync(liveSessionPath).isDirectory() &&
            fs.existsSync(path.join(liveSessionPath, ".lock"));
        const allComplete = hasTasks && totalTasks > 0 && completedTasks === totalTasks;
        if (allComplete) {
            completedStages.push("execution_in_progress");
            completedStages.push("complete");
        }
        else if (hasLiveSession && hasTasks) {
            completedStages.push("execution_in_progress");
        }
        // Check if spec was modified after tasks were generated
        const specModifiedAfterTasks = hasTasks && latestTaskMtime > 0
            ? getMtimeMs(resolved) > latestTaskMtime
            : false;
        const currentStage = completedStages[completedStages.length - 1] ?? "created";
        const info = {
            current_stage: currentStage,
            completed_stages: completedStages,
            spec_modified_after_tasks: specModifiedAfterTasks,
            has_analysis: hasAnalysis,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            has_live_session: hasLiveSession,
        };
        res.json(info);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
export default router;
//# sourceMappingURL=specs.js.map