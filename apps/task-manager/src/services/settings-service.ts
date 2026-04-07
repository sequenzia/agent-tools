/**
 * Settings persistence service.
 *
 * Uses Tauri IPC commands to read/write app settings to the
 * persistent settings.json store in Tauri app data.
 */

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
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = await invoke<unknown>("get_app_settings");

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
    // IPC error or store not available — return defaults
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
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_app_settings", { settings });
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
