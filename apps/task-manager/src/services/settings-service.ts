/**
 * Settings persistence service.
 *
 * Uses the Node.js backend API to read/write app settings
 * stored in ~/.task-manager/settings.json.
 */

import { api } from "./api-client";
import type { AppSettings } from "../types/settings";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_COLUMN_VISIBILITY,
  parseSettings,
} from "../types/settings";

const STORE_KEY = "app_settings";

/**
 * Load app settings from persistent storage.
 * Returns default settings if none are saved or if data is corrupted.
 */
export async function loadSettings(): Promise<{
  settings: AppSettings;
  usedDefaults: boolean;
}> {
  try {
    const raw = await api.get<unknown>("/api/settings");

    if (raw === null || raw === undefined) {
      return {
        settings: {
          ...DEFAULT_APP_SETTINGS,
          uiPreferences: {
            ...DEFAULT_UI_PREFERENCES,
            columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
          },
        },
        usedDefaults: true,
      };
    }

    return parseSettings(raw);
  } catch {
    // API error or server not available — return defaults
    return {
      settings: {
        ...DEFAULT_APP_SETTINGS,
        uiPreferences: {
          ...DEFAULT_UI_PREFERENCES,
          columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
        },
      },
      usedDefaults: true,
    };
  }
}

/**
 * Save app settings to persistent storage.
 * Throws on write failure so the caller can show an error.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  await api.put("/api/settings", { settings });
}

/**
 * Reset settings to defaults and persist.
 */
export async function resetSettings(): Promise<AppSettings> {
  const defaults: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    uiPreferences: {
      ...DEFAULT_UI_PREFERENCES,
      columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
    },
  };
  await saveSettings(defaults);
  return defaults;
}

export { STORE_KEY };
