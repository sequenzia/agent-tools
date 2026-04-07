import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSettingsStore } from "../settings-store";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_COLUMN_VISIBILITY,
} from "../../types/settings";
import type { AppSettings } from "../../types/settings";

// Mock the settings service
vi.mock("../../services/settings-service", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  resetSettings: vi.fn(),
}));

// Import mocked module
import {
  loadSettings,
  saveSettings,
  resetSettings,
} from "../../services/settings-service";

const mockedLoadSettings = vi.mocked(loadSettings);
const mockedSaveSettings = vi.mocked(saveSettings);
const mockedResetSettings = vi.mocked(resetSettings);

function makeDefaults(): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    uiPreferences: {
      ...DEFAULT_UI_PREFERENCES,
      columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({
    settings: makeDefaults(),
    isLoaded: false,
    isSaving: false,
    saveError: null,
    isOpen: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSettingsStore", () => {
  describe("initial state", () => {
    it("starts with default settings", () => {
      const state = useSettingsStore.getState();
      expect(state.settings.rootDirectories).toEqual([]);
      expect(state.settings.uiPreferences.defaultView).toBe("kanban");
      expect(state.settings.uiPreferences.cardDensity).toBe("comfortable");
      expect(state.isLoaded).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.saveError).toBeNull();
      expect(state.isOpen).toBe(false);
    });
  });

  describe("load", () => {
    it("loads settings from persistent storage", async () => {
      const savedSettings = makeDefaults();
      savedSettings.rootDirectories = ["/Users/dev/repos"];
      savedSettings.uiPreferences.defaultView = "list";

      mockedLoadSettings.mockResolvedValue({
        settings: savedSettings,
        usedDefaults: false,
      });

      await useSettingsStore.getState().load();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.settings.rootDirectories).toEqual(["/Users/dev/repos"]);
      expect(state.settings.uiPreferences.defaultView).toBe("list");
    });

    it("loads defaults when no settings saved", async () => {
      mockedLoadSettings.mockResolvedValue({
        settings: makeDefaults(),
        usedDefaults: true,
      });

      await useSettingsStore.getState().load();

      const state = useSettingsStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.settings.rootDirectories).toEqual([]);
    });
  });

  describe("open/close", () => {
    it("opens and closes the settings panel", () => {
      useSettingsStore.getState().open();
      expect(useSettingsStore.getState().isOpen).toBe(true);

      useSettingsStore.getState().close();
      expect(useSettingsStore.getState().isOpen).toBe(false);
    });

    it("clears save error on close", () => {
      useSettingsStore.setState({ saveError: "some error", isOpen: true });
      useSettingsStore.getState().close();
      expect(useSettingsStore.getState().saveError).toBeNull();
    });
  });

  describe("addRootDirectory", () => {
    it("adds a root directory and persists", async () => {
      mockedSaveSettings.mockResolvedValue();

      await useSettingsStore.getState().addRootDirectory("/Users/dev/repos");

      const state = useSettingsStore.getState();
      expect(state.settings.rootDirectories).toEqual(["/Users/dev/repos"]);
      expect(mockedSaveSettings).toHaveBeenCalledTimes(1);
    });

    it("does not add duplicate directories", async () => {
      useSettingsStore.setState({
        settings: {
          ...makeDefaults(),
          rootDirectories: ["/Users/dev/repos"],
        },
      });

      await useSettingsStore.getState().addRootDirectory("/Users/dev/repos");

      expect(useSettingsStore.getState().settings.rootDirectories).toHaveLength(1);
      expect(mockedSaveSettings).not.toHaveBeenCalled();
    });

    it("handles paths with spaces and special characters", async () => {
      mockedSaveSettings.mockResolvedValue();

      await useSettingsStore
        .getState()
        .addRootDirectory("/Users/my user/dev repos");

      expect(useSettingsStore.getState().settings.rootDirectories).toEqual([
        "/Users/my user/dev repos",
      ]);
    });

    it("sets saveError on persistence failure", async () => {
      mockedSaveSettings.mockRejectedValue(new Error("Write failed"));

      await useSettingsStore.getState().addRootDirectory("/Users/dev/repos");

      const state = useSettingsStore.getState();
      expect(state.saveError).toContain("Failed to save settings");
      expect(state.isSaving).toBe(false);
    });
  });

  describe("removeRootDirectory", () => {
    it("removes a root directory and persists", async () => {
      mockedSaveSettings.mockResolvedValue();
      useSettingsStore.setState({
        settings: {
          ...makeDefaults(),
          rootDirectories: ["/a", "/b", "/c"],
        },
      });

      await useSettingsStore.getState().removeRootDirectory("/b");

      expect(useSettingsStore.getState().settings.rootDirectories).toEqual([
        "/a",
        "/c",
      ]);
      expect(mockedSaveSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("setDefaultView", () => {
    it("sets the default view and persists", async () => {
      mockedSaveSettings.mockResolvedValue();

      await useSettingsStore.getState().setDefaultView("list");

      expect(
        useSettingsStore.getState().settings.uiPreferences.defaultView,
      ).toBe("list");
      expect(mockedSaveSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("toggleColumnVisibility", () => {
    it("toggles a column off", async () => {
      mockedSaveSettings.mockResolvedValue();

      await useSettingsStore.getState().toggleColumnVisibility("blocked");

      expect(
        useSettingsStore.getState().settings.uiPreferences.columnVisibility
          .blocked,
      ).toBe(false);
    });

    it("toggles a column back on", async () => {
      mockedSaveSettings.mockResolvedValue();

      // Toggle off first
      await useSettingsStore.getState().toggleColumnVisibility("completed");
      expect(
        useSettingsStore.getState().settings.uiPreferences.columnVisibility
          .completed,
      ).toBe(false);

      // Toggle back on
      await useSettingsStore.getState().toggleColumnVisibility("completed");
      expect(
        useSettingsStore.getState().settings.uiPreferences.columnVisibility
          .completed,
      ).toBe(true);
    });
  });

  describe("setCardDensity", () => {
    it("sets card density and persists", async () => {
      mockedSaveSettings.mockResolvedValue();

      await useSettingsStore.getState().setCardDensity("compact");

      expect(
        useSettingsStore.getState().settings.uiPreferences.cardDensity,
      ).toBe("compact");
    });
  });

  describe("resetToDefaults", () => {
    it("resets all settings to defaults and persists", async () => {
      mockedResetSettings.mockResolvedValue(makeDefaults());

      // First modify settings
      useSettingsStore.setState({
        settings: {
          rootDirectories: ["/a", "/b"],
          uiPreferences: {
            defaultView: "list",
            columnVisibility: {
              ...DEFAULT_COLUMN_VISIBILITY,
              blocked: false,
            },
            cardDensity: "compact",
          },
        },
      });

      await useSettingsStore.getState().resetToDefaults();

      const state = useSettingsStore.getState();
      expect(state.settings.rootDirectories).toEqual([]);
      expect(state.settings.uiPreferences.defaultView).toBe("kanban");
      expect(state.settings.uiPreferences.cardDensity).toBe("comfortable");
      expect(mockedResetSettings).toHaveBeenCalledTimes(1);
    });

    it("sets saveError on reset failure", async () => {
      mockedResetSettings.mockRejectedValue(new Error("Reset failed"));

      await useSettingsStore.getState().resetToDefaults();

      expect(useSettingsStore.getState().saveError).toContain(
        "Failed to reset settings",
      );
    });
  });

  describe("save error handling", () => {
    it("shows error toast when save fails", async () => {
      mockedSaveSettings.mockRejectedValue(new Error("Disk full"));

      await useSettingsStore.getState().setDefaultView("list");

      const state = useSettingsStore.getState();
      expect(state.saveError).toContain("Failed to save settings");
      expect(state.saveError).toContain("Disk full");
      expect(state.isSaving).toBe(false);
    });

    it("clears error on successful save", async () => {
      // First cause an error
      mockedSaveSettings.mockRejectedValueOnce(new Error("fail"));
      await useSettingsStore.getState().setDefaultView("list");
      expect(useSettingsStore.getState().saveError).not.toBeNull();

      // Then succeed
      mockedSaveSettings.mockResolvedValueOnce();
      await useSettingsStore.getState().setDefaultView("kanban");
      expect(useSettingsStore.getState().saveError).toBeNull();
    });
  });
});
