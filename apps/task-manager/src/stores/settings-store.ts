import { create } from "zustand";
import type {
  AppSettings,
  ColumnVisibility,
  ViewMode,
  CardDensity,
  BoardColumnValue,
} from "../types/settings";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_COLUMN_ORDER,
} from "../types/settings";
import {
  loadSettings,
  saveSettings,
  resetSettings as resetSettingsService,
} from "../services/settings-service";

interface SettingsState {
  /** Current app settings. */
  settings: AppSettings;
  /** Whether settings have been loaded from persistent storage. */
  isLoaded: boolean;
  /** Whether a save operation is in progress. */
  isSaving: boolean;
  /** Last save error, if any. */
  saveError: string | null;
  /** Whether the settings panel is open. */
  isOpen: boolean;

  /** Load settings from persistent storage. */
  load: () => Promise<void>;
  /** Open the settings panel. */
  open: () => void;
  /** Close the settings panel. */
  close: () => void;

  /** Add a root directory for auto-discovery. */
  addRootDirectory: (path: string) => Promise<void>;
  /** Remove a root directory by path. */
  removeRootDirectory: (path: string) => Promise<void>;

  /** Set the default view mode. */
  setDefaultView: (view: ViewMode) => Promise<void>;
  /** Toggle a column's visibility. */
  toggleColumnVisibility: (column: keyof ColumnVisibility) => Promise<void>;
  /** Set the card density. */
  setCardDensity: (density: CardDensity) => Promise<void>;
  /** Set the column display order. */
  setColumnOrder: (order: BoardColumnValue[]) => Promise<void>;

  /** Reset all settings to defaults. */
  resetToDefaults: () => Promise<void>;
}

/**
 * Persist settings and handle errors.
 * Returns the updated settings on success, or null on failure.
 */
async function persistSettings(
  newSettings: AppSettings,
  set: (partial: Partial<SettingsState>) => void,
): Promise<boolean> {
  set({ isSaving: true, saveError: null });
  try {
    await saveSettings(newSettings);
    set({ settings: newSettings, isSaving: false });
    return true;
  } catch (err) {
    set({
      isSaving: false,
      saveError: `Failed to save settings: ${String(err)}`,
    });
    return false;
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    ...DEFAULT_APP_SETTINGS,
    uiPreferences: {
      ...DEFAULT_UI_PREFERENCES,
      columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
      columnOrder: [...DEFAULT_COLUMN_ORDER],
    },
  },
  isLoaded: false,
  isSaving: false,
  saveError: null,
  isOpen: false,

  load: async () => {
    const { settings } = await loadSettings();
    set({ settings, isLoaded: true });
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, saveError: null }),

  addRootDirectory: async (path: string) => {
    const current = get().settings;
    // Avoid duplicates
    if (current.rootDirectories.includes(path)) return;
    const newSettings: AppSettings = {
      ...current,
      rootDirectories: [...current.rootDirectories, path],
    };
    await persistSettings(newSettings, set);
  },

  removeRootDirectory: async (path: string) => {
    const current = get().settings;
    const newSettings: AppSettings = {
      ...current,
      rootDirectories: current.rootDirectories.filter((d) => d !== path),
    };
    await persistSettings(newSettings, set);
  },

  setDefaultView: async (view: ViewMode) => {
    const current = get().settings;
    const newSettings: AppSettings = {
      ...current,
      uiPreferences: { ...current.uiPreferences, defaultView: view },
    };
    await persistSettings(newSettings, set);
  },

  toggleColumnVisibility: async (column: keyof ColumnVisibility) => {
    const current = get().settings;
    const vis = current.uiPreferences.columnVisibility;
    const newSettings: AppSettings = {
      ...current,
      uiPreferences: {
        ...current.uiPreferences,
        columnVisibility: { ...vis, [column]: !vis[column] },
      },
    };
    await persistSettings(newSettings, set);
  },

  setCardDensity: async (density: CardDensity) => {
    const current = get().settings;
    const newSettings: AppSettings = {
      ...current,
      uiPreferences: { ...current.uiPreferences, cardDensity: density },
    };
    await persistSettings(newSettings, set);
  },

  setColumnOrder: async (order: BoardColumnValue[]) => {
    const current = get().settings;
    const newSettings: AppSettings = {
      ...current,
      uiPreferences: { ...current.uiPreferences, columnOrder: order },
    };
    await persistSettings(newSettings, set);
  },

  resetToDefaults: async () => {
    set({ isSaving: true, saveError: null });
    try {
      const defaults = await resetSettingsService();
      set({ settings: defaults, isSaving: false });
    } catch (err) {
      set({
        isSaving: false,
        saveError: `Failed to reset settings: ${String(err)}`,
      });
    }
  },
}));
