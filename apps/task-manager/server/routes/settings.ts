/**
 * App settings routes — replaces Tauri plugin-store.
 * Reads/writes settings from ~/.task-manager/settings.json.
 */

import { Router } from "express";
import { readSettingsFile, writeSettingsFile } from "./projects.js";

const router = Router();

/** GET /api/settings — Get app settings. */
router.get("/", (_req, res) => {
  const settings = readSettingsFile();
  res.json(settings.appSettings ?? null);
});

/** PUT /api/settings — Save app settings. */
router.put("/", (req, res) => {
  const { settings: appSettings } = req.body as { settings: unknown };
  const file = readSettingsFile();
  file.appSettings = appSettings;
  writeSettingsFile(file);
  res.json({ ok: true });
});

export default router;
