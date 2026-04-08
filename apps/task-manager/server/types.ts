/**
 * Shared backend types matching the Rust struct definitions.
 * These types define the API response shapes consumed by the frontend.
 */

// --- Task Types ---

export interface Task {
  id: string | number;
  title: string;
  description: string;
  status: string;
  acceptance_criteria?: AcceptanceCriteria;
  testing_requirements?: (string | { type: string; target: string; [key: string]: unknown })[];
  blocked_by?: (string | number)[];
  blocks?: (string | number)[];
  metadata?: TaskMetadata;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface AcceptanceCriteria {
  functional?: string[];
  edge_cases?: string[];
  error_handling?: string[];
  performance?: string[];
  [key: string]: unknown;
}

export interface TaskMetadata {
  priority?: string;
  complexity?: string;
  task_group?: string;
  spec_path?: string;
  feature_name?: string;
  source_section?: string;
  spec_phase?: number;
  spec_phase_name?: string;
  produces_for?: string[];
  task_uid?: string;
  [key: string]: unknown;
}

export type TaskFileResult =
  | { type: "ok"; task: Task; file_path: string; mtime_ms: number }
  | { type: "error"; file_path: string; error: string };

export interface TasksByStatus {
  backlog: TaskFileResult[];
  pending: TaskFileResult[];
  in_progress: TaskFileResult[];
  completed: TaskFileResult[];
}

export interface TaskManifest {
  task_group: string;
  spec_path?: string;
  total: number;
  backlog: number;
  pending: number;
  in_progress: number;
  completed: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// --- Session Types ---

export type SessionStatus = "active" | "interrupted" | "inactive";

export interface LiveSessionInfo {
  exists: boolean;
  status: SessionStatus;
  session_path: string;
  available_files: string[];
  project_path: string;
}

export interface SessionFileResult {
  filename: string;
  content: string | null;
  error: string | null;
  exists: boolean;
}

export interface SessionChangeEvent {
  status: SessionStatus;
  project_path: string;
  session_path: string;
}

export interface SessionSummary {
  tasks_passed: number;
  tasks_failed: number;
  tasks_total: number;
  headline: string;
}

export interface ArchivedSessionInfo {
  name: string;
  path: string;
  available_files: string[];
  has_summary: boolean;
  mtime_ms: number;
  summary: SessionSummary | null;
  error: string | null;
}

// --- Spec Types ---

export interface SpecContent {
  content: string;
  resolved_path: string;
  size: number;
}

export interface SpecAnalysisCheck {
  exists: boolean;
  analysis_path: string;
}

export type SpecLifecycleStage =
  | "created"
  | "analyzed"
  | "tasks_generated"
  | "execution_in_progress"
  | "complete"
  | "unknown";

export interface SpecLifecycleInfo {
  current_stage: SpecLifecycleStage;
  completed_stages: SpecLifecycleStage[];
  spec_modified_after_tasks: boolean;
  has_analysis: boolean;
  total_tasks: number;
  completed_tasks: number;
  has_live_session: boolean;
}

// --- Discovery Types ---

export interface DiscoveredProject {
  path: string;
  name: string;
}

export interface ScanProgress {
  dirs_scanned: number;
  projects_found: number;
  done: boolean;
  current_root: string;
}

export interface ScanResult {
  projects: DiscoveredProject[];
  warnings: string[];
  dirs_scanned: number;
  elapsed_ms: number;
}

// --- Watcher Types ---

export interface FileChangeEvent {
  kind: "create" | "modify" | "delete" | "unknown";
  path: string;
  project_path: string;
}

export interface FileChangeBatch {
  events: FileChangeEvent[];
  project_path: string;
}

export interface WatchErrorEvent {
  message: string;
  project_path: string;
}

export interface WatchDisconnectedEvent {
  message: string;
  project_path: string;
}

export interface ResultFileChangeEvent {
  filename: string;
  kind: "modify" | "delete";
  project_path: string;
}

// --- Project Types ---

export interface ProjectDirectoryResult {
  path: string;
  has_tasks_dir: boolean;
}

export interface SavedProjectDirectory {
  path: string | null;
  exists: boolean;
  has_tasks_dir: boolean;
}

export interface ProjectListResponse {
  projects: string[];
  activeProjectPath: string | null;
}

export interface AddProjectResponse {
  ok: boolean;
  has_tasks_dir: boolean;
}

export interface DirectoryEntry {
  name: string;
  path: string;
}

export interface BrowseResult {
  current: string;
  parent: string | null;
  directories: DirectoryEntry[];
}
