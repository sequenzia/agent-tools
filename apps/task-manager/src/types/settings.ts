import { z } from "zod";

// --- View Mode ---

export const ViewModeSchema = z.enum(["kanban", "list"]);
export type ViewMode = z.infer<typeof ViewModeSchema>;

// --- Card Density ---

export const CardDensitySchema = z.enum(["compact", "comfortable", "spacious"]);
export type CardDensity = z.infer<typeof CardDensitySchema>;

// --- Board Column ---

export const BoardColumnSchema = z.enum([
  "backlog",
  "pending",
  "blocked",
  "in_progress",
  "failed",
  "completed",
]);
export type BoardColumnValue = z.infer<typeof BoardColumnSchema>;

// --- Column Visibility ---

export const ColumnVisibilitySchema = z
  .object({
    backlog: z.boolean(),
    pending: z.boolean(),
    in_progress: z.boolean(),
    completed: z.boolean(),
    blocked: z.boolean(),
    failed: z.boolean(),
  })
  .passthrough();
export type ColumnVisibility = z.infer<typeof ColumnVisibilitySchema>;

// --- UI Preferences ---

export const UIPreferencesSchema = z
  .object({
    defaultView: ViewModeSchema,
    columnVisibility: ColumnVisibilitySchema,
    cardDensity: CardDensitySchema,
    columnOrder: z.array(BoardColumnSchema).optional(),
  })
  .passthrough();
export type UIPreferences = z.infer<typeof UIPreferencesSchema>;

// --- App Settings ---

export const AppSettingsSchema = z
  .object({
    /** Root directories for project auto-discovery. */
    rootDirectories: z.array(z.string()),
    /** UI display preferences. */
    uiPreferences: UIPreferencesSchema,
  })
  .passthrough();
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// --- Defaults ---

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  backlog: true,
  pending: true,
  in_progress: true,
  completed: true,
  blocked: true,
  failed: true,
};

export const DEFAULT_COLUMN_ORDER: BoardColumnValue[] = [
  "backlog",
  "pending",
  "blocked",
  "in_progress",
  "failed",
  "completed",
];

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  defaultView: "kanban",
  columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
  cardDensity: "comfortable",
  columnOrder: [...DEFAULT_COLUMN_ORDER],
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  rootDirectories: [],
  uiPreferences: { ...DEFAULT_UI_PREFERENCES },
};

/**
 * Parse settings JSON with fallback to defaults on corruption.
 * Returns the parsed settings and a boolean indicating whether defaults were used.
 */
export function parseSettings(json: unknown): {
  settings: AppSettings;
  usedDefaults: boolean;
} {
  const result = AppSettingsSchema.safeParse(json);
  if (result.success) {
    return { settings: result.data, usedDefaults: false };
  }
  return {
    settings: { ...DEFAULT_APP_SETTINGS, uiPreferences: { ...DEFAULT_UI_PREFERENCES, columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY }, columnOrder: [...DEFAULT_COLUMN_ORDER] } },
    usedDefaults: true,
  };
}
