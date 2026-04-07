import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "../SettingsPanel";
import { useSettingsStore } from "../../stores/settings-store";
import {
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_UI_PREFERENCES,
} from "../../types/settings";
import type { AppSettings } from "../../types/settings";

// Mock api-client
vi.mock("../../services/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ws: { on: vi.fn(() => vi.fn()), send: vi.fn(), connected: vi.fn(() => true), close: vi.fn() },
}));

// Mock the settings service so the store's load/save are controlled
vi.mock("../../services/settings-service", () => ({
  loadSettings: vi.fn().mockResolvedValue({
    settings: {
      rootDirectories: [],
      uiPreferences: {
        defaultView: "kanban",
        columnVisibility: {
          backlog: true,
          pending: true,
          in_progress: true,
          completed: true,
          blocked: true,
          failed: true,
        },
        cardDensity: "comfortable",
      },
    },
    usedDefaults: false,
  }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  resetSettings: vi.fn().mockResolvedValue({
    rootDirectories: [],
    uiPreferences: {
      defaultView: "kanban",
      columnVisibility: {
        backlog: true,
        pending: true,
        in_progress: true,
        completed: true,
        blocked: true,
        failed: true,
      },
      cardDensity: "comfortable",
    },
  }),
}));

function makeDefaultSettings(): AppSettings {
  return {
    rootDirectories: [],
    uiPreferences: {
      ...DEFAULT_UI_PREFERENCES,
      columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
    },
  };
}

function setStoreReady(overrides?: Partial<AppSettings>) {
  const settings = { ...makeDefaultSettings(), ...overrides };
  useSettingsStore.setState({
    settings,
    isLoaded: true,
    isSaving: false,
    saveError: null,
    isOpen: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setStoreReady();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SettingsPanel", () => {
  describe("rendering", () => {
    it("renders the settings panel with header", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByText("Settings")).toBeDefined();
      expect(screen.getByTestId("settings-panel")).toBeDefined();
    });

    it("renders root directories section", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(
        screen.getByText("Root Directories for Auto-Discovery"),
      ).toBeDefined();
      expect(screen.getByTestId("settings-root-dirs")).toBeDefined();
    });

    it("renders UI preferences section", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByText("UI Preferences")).toBeDefined();
      expect(screen.getByTestId("settings-ui-prefs")).toBeDefined();
    });

    it("shows loading state when not loaded", () => {
      useSettingsStore.setState({ isLoaded: false });
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByText("Loading settings...")).toBeDefined();
    });

    it("renders close button", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("settings-close-btn")).toBeDefined();
    });

    it("renders done button", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("settings-done-btn")).toBeDefined();
    });

    it("renders reset button", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("settings-reset-btn")).toBeDefined();
    });
  });

  describe("root directories", () => {
    it("shows no directories message when empty", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("no-root-dirs")).toBeDefined();
      expect(
        screen.getByText("No root directories configured"),
      ).toBeDefined();
    });

    it("displays configured root directories", () => {
      setStoreReady({
        rootDirectories: ["/Users/dev/repos", "/opt/projects"],
      });

      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByText("/Users/dev/repos")).toBeDefined();
      expect(screen.getByText("/opt/projects")).toBeDefined();
    });

    it("shows add directory button", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("add-root-dir-btn")).toBeDefined();
    });

    it("shows remove button for each directory", () => {
      setStoreReady({
        rootDirectories: ["/Users/dev/repos"],
      });

      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("remove-root-dir-btn")).toBeDefined();
    });

    it("calls removeRootDirectory when remove is clicked", () => {
      const spy = vi.fn();
      setStoreReady({
        rootDirectories: ["/Users/dev/repos"],
      });
      useSettingsStore.setState({ removeRootDirectory: spy });

      render(<SettingsPanel onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId("remove-root-dir-btn"));
      expect(spy).toHaveBeenCalledWith("/Users/dev/repos");
    });
  });

  describe("view mode selector", () => {
    it("renders view mode options", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("view-mode-kanban")).toBeDefined();
      expect(screen.getByTestId("view-mode-list")).toBeDefined();
    });

    it("highlights the current view mode", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      const kanbanBtn = screen.getByTestId("view-mode-kanban");
      expect(kanbanBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("calls setDefaultView when a view mode is clicked", () => {
      const spy = vi.fn();
      useSettingsStore.setState({ setDefaultView: spy });

      render(<SettingsPanel onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId("view-mode-list"));
      expect(spy).toHaveBeenCalledWith("list");
    });
  });

  describe("column visibility", () => {
    it("renders checkboxes for all columns", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("col-toggle-backlog")).toBeDefined();
      expect(screen.getByTestId("col-toggle-pending")).toBeDefined();
      expect(screen.getByTestId("col-toggle-in_progress")).toBeDefined();
      expect(screen.getByTestId("col-toggle-completed")).toBeDefined();
      expect(screen.getByTestId("col-toggle-blocked")).toBeDefined();
      expect(screen.getByTestId("col-toggle-failed")).toBeDefined();
    });

    it("checkboxes reflect current visibility state", () => {
      setStoreReady({
        uiPreferences: {
          ...DEFAULT_UI_PREFERENCES,
          columnVisibility: {
            ...DEFAULT_COLUMN_VISIBILITY,
            blocked: false,
            failed: false,
          },
        },
      });

      render(<SettingsPanel onClose={vi.fn()} />);
      const blockedCheckbox = screen.getByTestId(
        "col-toggle-blocked",
      ) as HTMLInputElement;
      const failedCheckbox = screen.getByTestId(
        "col-toggle-failed",
      ) as HTMLInputElement;
      const pendingCheckbox = screen.getByTestId(
        "col-toggle-pending",
      ) as HTMLInputElement;

      expect(blockedCheckbox.checked).toBe(false);
      expect(failedCheckbox.checked).toBe(false);
      expect(pendingCheckbox.checked).toBe(true);
    });

    it("calls toggleColumnVisibility when checkbox is clicked", () => {
      const spy = vi.fn();
      useSettingsStore.setState({ toggleColumnVisibility: spy });

      render(<SettingsPanel onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId("col-toggle-blocked"));
      expect(spy).toHaveBeenCalledWith("blocked");
    });
  });

  describe("card density", () => {
    it("renders density options", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("card-density-compact")).toBeDefined();
      expect(screen.getByTestId("card-density-comfortable")).toBeDefined();
      expect(screen.getByTestId("card-density-spacious")).toBeDefined();
    });

    it("highlights the current density", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      const comfortableBtn = screen.getByTestId("card-density-comfortable");
      expect(comfortableBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("calls setCardDensity when a density is clicked", () => {
      const spy = vi.fn();
      useSettingsStore.setState({ setCardDensity: spy });

      render(<SettingsPanel onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId("card-density-compact"));
      expect(spy).toHaveBeenCalledWith("compact");
    });
  });

  describe("interactions", () => {
    it("calls onClose when close button is clicked", () => {
      const onClose = vi.fn();
      render(<SettingsPanel onClose={onClose} />);
      fireEvent.click(screen.getByTestId("settings-close-btn"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when done button is clicked", () => {
      const onClose = vi.fn();
      render(<SettingsPanel onClose={onClose} />);
      fireEvent.click(screen.getByTestId("settings-done-btn"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      render(<SettingsPanel onClose={onClose} />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls resetToDefaults when reset button is clicked", () => {
      const spy = vi.fn();
      useSettingsStore.setState({ resetToDefaults: spy });

      render(<SettingsPanel onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId("settings-reset-btn"));
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("displays save error when present", () => {
      useSettingsStore.setState({
        saveError: "Failed to save settings: Disk full",
      });

      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("settings-save-error")).toBeDefined();
      expect(
        screen.getByText("Failed to save settings: Disk full"),
      ).toBeDefined();
    });

    it("shows saving indicator during save", () => {
      useSettingsStore.setState({ isSaving: true });

      render(<SettingsPanel onClose={vi.fn()} />);
      expect(screen.getByTestId("settings-saving-indicator")).toBeDefined();
    });

    it("has role=alert on error message for accessibility", () => {
      useSettingsStore.setState({
        saveError: "Some error",
      });

      render(<SettingsPanel onClose={vi.fn()} />);
      const errorEl = screen.getByTestId("settings-save-error");
      expect(errorEl.getAttribute("role")).toBe("alert");
    });
  });

  describe("accessibility", () => {
    it("has role=dialog on the panel", () => {
      render(<SettingsPanel onClose={vi.fn()} />);
      const panel = screen.getByTestId("settings-panel");
      expect(panel.getAttribute("role")).toBe("dialog");
      expect(panel.getAttribute("aria-label")).toBe("App Settings");
    });
  });
});
