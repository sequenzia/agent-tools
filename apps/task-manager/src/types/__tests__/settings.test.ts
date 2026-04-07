import { describe, it, expect } from "vitest";
import {
  AppSettingsSchema,
  UIPreferencesSchema,
  ColumnVisibilitySchema,
  ViewModeSchema,
  CardDensitySchema,
  parseSettings,
  DEFAULT_APP_SETTINGS,
  DEFAULT_UI_PREFERENCES,
  DEFAULT_COLUMN_VISIBILITY,
} from "../settings";

describe("ViewModeSchema", () => {
  it("accepts valid view modes", () => {
    expect(ViewModeSchema.parse("kanban")).toBe("kanban");
    expect(ViewModeSchema.parse("list")).toBe("list");
  });

  it("rejects invalid view modes", () => {
    expect(() => ViewModeSchema.parse("table")).toThrow();
  });
});

describe("CardDensitySchema", () => {
  it("accepts valid card densities", () => {
    expect(CardDensitySchema.parse("compact")).toBe("compact");
    expect(CardDensitySchema.parse("comfortable")).toBe("comfortable");
    expect(CardDensitySchema.parse("spacious")).toBe("spacious");
  });

  it("rejects invalid card densities", () => {
    expect(() => CardDensitySchema.parse("tiny")).toThrow();
  });
});

describe("ColumnVisibilitySchema", () => {
  it("validates a complete column visibility object", () => {
    const input = {
      backlog: true,
      pending: true,
      in_progress: false,
      completed: true,
      blocked: false,
      failed: true,
    };
    const result = ColumnVisibilitySchema.parse(input);
    expect(result.in_progress).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(() =>
      ColumnVisibilitySchema.parse({ backlog: true, pending: true }),
    ).toThrow();
  });

  it("allows extra fields via passthrough", () => {
    const input = {
      backlog: true,
      pending: true,
      in_progress: true,
      completed: true,
      blocked: true,
      failed: true,
      future_column: true,
    };
    const result = ColumnVisibilitySchema.parse(input);
    expect((result as Record<string, unknown>).future_column).toBe(true);
  });
});

describe("UIPreferencesSchema", () => {
  it("validates valid UI preferences", () => {
    const input = {
      defaultView: "list",
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      cardDensity: "compact",
    };
    const result = UIPreferencesSchema.parse(input);
    expect(result.defaultView).toBe("list");
    expect(result.cardDensity).toBe("compact");
  });
});

describe("AppSettingsSchema", () => {
  it("validates a full settings object", () => {
    const input = {
      rootDirectories: ["/Users/dev/repos", "/opt/projects"],
      uiPreferences: {
        defaultView: "kanban",
        columnVisibility: DEFAULT_COLUMN_VISIBILITY,
        cardDensity: "comfortable",
      },
    };
    const result = AppSettingsSchema.parse(input);
    expect(result.rootDirectories).toHaveLength(2);
    expect(result.uiPreferences.defaultView).toBe("kanban");
  });

  it("validates default settings", () => {
    const result = AppSettingsSchema.parse(DEFAULT_APP_SETTINGS);
    expect(result.rootDirectories).toHaveLength(0);
  });

  it("allows extra fields via passthrough", () => {
    const input = {
      rootDirectories: [],
      uiPreferences: DEFAULT_UI_PREFERENCES,
      futureField: "value",
    };
    const result = AppSettingsSchema.parse(input);
    expect((result as Record<string, unknown>).futureField).toBe("value");
  });
});

describe("parseSettings", () => {
  it("returns parsed settings for valid input", () => {
    const input = {
      rootDirectories: ["/dev/repos"],
      uiPreferences: {
        defaultView: "list",
        columnVisibility: DEFAULT_COLUMN_VISIBILITY,
        cardDensity: "spacious",
      },
    };
    const { settings, usedDefaults } = parseSettings(input);
    expect(usedDefaults).toBe(false);
    expect(settings.rootDirectories).toEqual(["/dev/repos"]);
    expect(settings.uiPreferences.defaultView).toBe("list");
    expect(settings.uiPreferences.cardDensity).toBe("spacious");
  });

  it("returns defaults for null input", () => {
    const { settings, usedDefaults } = parseSettings(null);
    expect(usedDefaults).toBe(true);
    expect(settings.rootDirectories).toEqual([]);
    expect(settings.uiPreferences.defaultView).toBe("kanban");
  });

  it("returns defaults for undefined input", () => {
    const { settings, usedDefaults } = parseSettings(undefined);
    expect(usedDefaults).toBe(true);
    expect(settings.rootDirectories).toEqual([]);
  });

  it("returns defaults for corrupted input", () => {
    const { settings, usedDefaults } = parseSettings({
      rootDirectories: "not-an-array",
      uiPreferences: "broken",
    });
    expect(usedDefaults).toBe(true);
    expect(settings.rootDirectories).toEqual([]);
    expect(settings.uiPreferences.defaultView).toBe("kanban");
  });

  it("returns defaults for completely invalid input", () => {
    const { settings, usedDefaults } = parseSettings(42);
    expect(usedDefaults).toBe(true);
    expect(settings.rootDirectories).toEqual([]);
  });

  it("returns defaults for empty object", () => {
    const { settings, usedDefaults } = parseSettings({});
    expect(usedDefaults).toBe(true);
    expect(settings.rootDirectories).toEqual([]);
  });

  it("handles paths with spaces and special characters", () => {
    const input = {
      rootDirectories: [
        "/Users/my user/dev repos",
        "/opt/path with (parens)",
        "/tmp/path'with'quotes",
      ],
      uiPreferences: DEFAULT_UI_PREFERENCES,
    };
    const { settings, usedDefaults } = parseSettings(input);
    expect(usedDefaults).toBe(false);
    expect(settings.rootDirectories).toHaveLength(3);
    expect(settings.rootDirectories[0]).toBe("/Users/my user/dev repos");
    expect(settings.rootDirectories[1]).toBe("/opt/path with (parens)");
    expect(settings.rootDirectories[2]).toBe("/tmp/path'with'quotes");
  });
});

describe("DEFAULT constants", () => {
  it("DEFAULT_COLUMN_VISIBILITY has all columns visible", () => {
    expect(DEFAULT_COLUMN_VISIBILITY.backlog).toBe(true);
    expect(DEFAULT_COLUMN_VISIBILITY.pending).toBe(true);
    expect(DEFAULT_COLUMN_VISIBILITY.in_progress).toBe(true);
    expect(DEFAULT_COLUMN_VISIBILITY.completed).toBe(true);
    expect(DEFAULT_COLUMN_VISIBILITY.blocked).toBe(true);
    expect(DEFAULT_COLUMN_VISIBILITY.failed).toBe(true);
  });

  it("DEFAULT_UI_PREFERENCES uses kanban and comfortable", () => {
    expect(DEFAULT_UI_PREFERENCES.defaultView).toBe("kanban");
    expect(DEFAULT_UI_PREFERENCES.cardDensity).toBe("comfortable");
  });

  it("DEFAULT_APP_SETTINGS has empty root directories", () => {
    expect(DEFAULT_APP_SETTINGS.rootDirectories).toEqual([]);
  });
});
