import { api } from "./api-client";

/**
 * Response from the Rust `read_spec` IPC command.
 */
export interface SpecContent {
  /** The raw markdown content of the spec file. */
  content: string;
  /** The resolved absolute path of the spec file. */
  resolved_path: string;
  /** File size in bytes. */
  size: number;
}

/**
 * Response from the Rust `check_spec_analysis` IPC command.
 */
export interface SpecAnalysisCheck {
  /** Whether the analysis file exists. */
  exists: boolean;
  /** The expected path of the analysis file. */
  analysis_path: string;
}

/**
 * Read a spec markdown file via Tauri IPC.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param specPath - Spec file path, relative to project root or absolute.
 * @returns The spec content, resolved path, and file size.
 * @throws If the IPC call fails or the spec file is not found.
 */
export async function readSpec(
  projectPath: string,
  specPath: string,
): Promise<SpecContent> {
  return api.get<SpecContent>("/api/specs/read", { projectPath, specPath });
}

/**
 * Check whether an analysis file exists alongside a spec file.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param specPath - Spec file path, relative to project root or absolute.
 * @returns Whether the analysis file exists and its expected path.
 * @throws If the IPC call fails.
 */
export async function checkSpecAnalysis(
  projectPath: string,
  specPath: string,
): Promise<SpecAnalysisCheck> {
  return api.get<SpecAnalysisCheck>("/api/specs/analysis", {
    projectPath,
    specPath,
  });
}

/**
 * Read the analysis markdown file for a spec.
 * Uses the analysis path from `checkSpecAnalysis` to read the file directly.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param analysisPath - Absolute path to the analysis file.
 * @returns The analysis content, or null if not found.
 */
export async function readSpecAnalysis(
  projectPath: string,
  analysisPath: string,
): Promise<SpecContent | null> {
  try {
    return await api.get<SpecContent>("/api/specs/read", {
      projectPath,
      specPath: analysisPath,
    });
  } catch {
    return null;
  }
}

/**
 * Lifecycle stages of the SDD spec pipeline.
 */
export type SpecLifecycleStage =
  | "created"
  | "analyzed"
  | "tasks_generated"
  | "execution_in_progress"
  | "complete"
  | "unknown";

/**
 * Response from the Rust `get_spec_lifecycle` IPC command.
 */
export interface SpecLifecycleInfo {
  /** The current (most advanced) lifecycle stage. */
  current_stage: SpecLifecycleStage;
  /** List of stages that have been completed. */
  completed_stages: SpecLifecycleStage[];
  /** Whether the spec file was modified after tasks were generated. */
  spec_modified_after_tasks: boolean;
  /** Whether an analysis file exists. */
  has_analysis: boolean;
  /** Total number of tasks found for this spec. */
  total_tasks: number;
  /** Number of completed tasks. */
  completed_tasks: number;
  /** Whether a live session is active. */
  has_live_session: boolean;
}

/**
 * All pipeline stages in display order.
 */
export const PIPELINE_STAGES: SpecLifecycleStage[] = [
  "created",
  "analyzed",
  "tasks_generated",
  "execution_in_progress",
  "complete",
];

/**
 * Human-readable labels for each pipeline stage.
 */
export const STAGE_LABELS: Record<SpecLifecycleStage, string> = {
  created: "Spec Created",
  analyzed: "Analyzed",
  tasks_generated: "Tasks Generated",
  execution_in_progress: "Execution In Progress",
  complete: "Complete",
  unknown: "Unknown",
};

/**
 * Get the lifecycle stage info for a spec.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param specPath - Spec file path, relative to project root or absolute.
 * @param taskGroup - Optional task group name to check for tasks.
 * @returns The lifecycle info including current stage and completed stages.
 * @throws If the IPC call fails.
 */
export async function getSpecLifecycle(
  projectPath: string,
  specPath: string,
  taskGroup?: string,
): Promise<SpecLifecycleInfo> {
  return api.get<SpecLifecycleInfo>("/api/specs/lifecycle", {
    projectPath,
    specPath,
    taskGroup: taskGroup ?? undefined,
  });
}

/**
 * Generate a URL-safe anchor ID from heading text.
 * Converts to lowercase, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
export function generateAnchorId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
