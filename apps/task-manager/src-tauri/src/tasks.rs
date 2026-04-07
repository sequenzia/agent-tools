use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Valid task status directories within `.agents/tasks/`.
const STATUS_DIRS: &[&str] = &["backlog", "pending", "in-progress", "completed"];

// --- Data Types ---

/// Acceptance criteria for a task, categorized by type.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AcceptanceCriteria {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub functional: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge_cases: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_handling: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub performance: Option<Vec<String>>,
    /// Forward-compatible: capture any unknown fields.
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Task metadata fields.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub complexity: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_group: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spec_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feature_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_section: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spec_phase: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spec_phase_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub produces_for: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_uid: Option<String>,
    /// Forward-compatible: capture any unknown fields.
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// A single SDD task, matching the task JSON schema.
/// The `id` field is stored as `serde_json::Value` to support both string and number IDs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: serde_json::Value,
    pub title: String,
    pub description: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acceptance_criteria: Option<AcceptanceCriteria>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub testing_requirements: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blocked_by: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blocks: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<TaskMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    /// Forward-compatible: capture any unknown fields.
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Result for a single task file read — either a parsed task or an error.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum TaskFileResult {
    #[serde(rename = "ok")]
    Ok {
        task: Task,
        file_path: String,
        /// File modification timestamp in milliseconds since epoch.
        /// Used for conflict detection on subsequent writes.
        mtime_ms: u64,
    },
    #[serde(rename = "error")]
    Error {
        file_path: String,
        error: String,
    },
}

/// All tasks grouped by status directory.
#[derive(Debug, Clone, Serialize, Default)]
pub struct TasksByStatus {
    pub backlog: Vec<TaskFileResult>,
    pub pending: Vec<TaskFileResult>,
    pub in_progress: Vec<TaskFileResult>,
    pub completed: Vec<TaskFileResult>,
}

/// Manifest JSON structure for a task group.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskManifest {
    pub task_group: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spec_path: Option<String>,
    #[serde(default)]
    pub total: i64,
    #[serde(default)]
    pub backlog: i64,
    #[serde(default)]
    pub pending: i64,
    #[serde(default)]
    pub in_progress: i64,
    #[serde(default)]
    pub completed: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    /// Forward-compatible: capture any unknown fields.
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

// --- Internal helpers ---

/// Build the `.agents/tasks/` base path from a project path.
fn tasks_base_path(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".agents").join("tasks")
}

/// Map a status directory name to the TasksByStatus field key.
/// `in-progress` (filesystem) becomes `in_progress` (JSON/Rust).
fn normalize_status(dir_name: &str) -> &str {
    match dir_name {
        "in-progress" => "in_progress",
        other => other,
    }
}

/// Get the file modification timestamp in milliseconds since the Unix epoch.
/// Returns 0 if the timestamp cannot be determined.
fn get_file_mtime_ms(path: &Path) -> u64 {
    path.metadata()
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Check for a conflict between the last-known modification timestamp and the current one.
/// Returns an error message if a conflict is detected, or Ok(()) if no conflict.
fn check_conflict(path: &Path, last_read_mtime_ms: u64) -> Result<(), String> {
    if !path.exists() {
        return Err(format!(
            "Conflict: task file was removed externally: {}",
            path.display()
        ));
    }

    let current_mtime = get_file_mtime_ms(path);
    if current_mtime != last_read_mtime_ms {
        return Err(format!(
            "Conflict: file was modified externally since last read. \
             Expected mtime {} but found {}. \
             File: {}. Refresh from disk to see the latest changes.",
            last_read_mtime_ms,
            current_mtime,
            path.display()
        ));
    }

    Ok(())
}

/// Read and parse a single task JSON file. Returns a `TaskFileResult`.
fn read_task_file(path: &Path) -> TaskFileResult {
    let file_path_str = path.display().to_string();
    let mtime_ms = get_file_mtime_ms(path);
    match std::fs::read_to_string(path) {
        Ok(contents) => match serde_json::from_str::<Task>(&contents) {
            Ok(task) => TaskFileResult::Ok {
                task,
                file_path: file_path_str,
                mtime_ms,
            },
            Err(e) => TaskFileResult::Error {
                file_path: file_path_str,
                error: format!("Invalid JSON: {}", e),
            },
        },
        Err(e) => TaskFileResult::Error {
            file_path: file_path_str,
            error: format!("Failed to read file: {}", e),
        },
    }
}

/// Scan a status directory for all task group subdirectories and their task JSON files.
/// Returns a vec of `TaskFileResult` for all discovered tasks.
fn scan_status_dir(status_dir: &Path) -> Vec<TaskFileResult> {
    let mut results = Vec::new();

    let entries = match std::fs::read_dir(status_dir) {
        Ok(entries) => entries,
        Err(_) => return results, // Directory doesn't exist or not readable
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        // This is a task group directory — scan for task-*.json files
        let group_entries = match std::fs::read_dir(&path) {
            Ok(entries) => entries,
            Err(e) => {
                results.push(TaskFileResult::Error {
                    file_path: path.display().to_string(),
                    error: format!("Failed to read group directory: {}", e),
                });
                continue;
            }
        };

        for file_entry in group_entries.flatten() {
            let file_path = file_entry.path();
            if file_path.is_file() {
                if let Some(name) = file_path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("task-") && name.ends_with(".json") {
                        results.push(read_task_file(&file_path));
                    }
                }
            }
        }
    }

    results
}

// --- Tauri IPC Commands ---

/// Scan all `.agents/tasks/{status}/{group}/task-NNN.json` files and return
/// parsed tasks grouped by status.
///
/// Returns an empty `TasksByStatus` if the project has no `.agents/tasks/` directory.
#[tauri::command]
pub fn read_tasks(project_path: String) -> TasksByStatus {
    let base = tasks_base_path(&project_path);
    let mut result = TasksByStatus::default();

    if !base.exists() {
        return result;
    }

    for &status_dir_name in STATUS_DIRS {
        let status_dir = base.join(status_dir_name);
        let tasks = scan_status_dir(&status_dir);
        let key = normalize_status(status_dir_name);
        match key {
            "backlog" => result.backlog = tasks,
            "pending" => result.pending = tasks,
            "in_progress" => result.in_progress = tasks,
            "completed" => result.completed = tasks,
            _ => {} // unreachable for known status dirs
        }
    }

    result
}

/// Read and parse a single task JSON file at the given path.
///
/// Returns a `TaskFileResult` which is either the parsed task or an error.
#[tauri::command]
pub fn read_task(file_path: String) -> TaskFileResult {
    let path = Path::new(&file_path);
    read_task_file(path)
}

/// Read a manifest file at `.agents/tasks/_manifests/{group}.json`.
///
/// Returns `Ok(TaskManifest)` on success, or a descriptive error string on failure.
#[tauri::command]
pub fn read_manifest(project_path: String, group: String) -> Result<TaskManifest, String> {
    let manifest_path = tasks_base_path(&project_path)
        .join("_manifests")
        .join(format!("{}.json", group));

    if !manifest_path.exists() {
        return Err(format!(
            "Manifest not found: {}",
            manifest_path.display()
        ));
    }

    let contents = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    serde_json::from_str::<TaskManifest>(&contents)
        .map_err(|e| format!("Invalid manifest JSON: {}", e))
}

/// List all task group directory names found across all status directories.
///
/// Returns an empty vec if the project has no `.agents/tasks/` directory.
#[tauri::command]
pub fn list_task_groups(project_path: String) -> Vec<String> {
    let base = tasks_base_path(&project_path);
    let mut groups = HashSet::new();

    if !base.exists() {
        return Vec::new();
    }

    for &status_dir_name in STATUS_DIRS {
        let status_dir = base.join(status_dir_name);
        if let Ok(entries) = std::fs::read_dir(&status_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        groups.insert(name.to_string());
                    }
                }
            }
        }
    }

    let mut sorted: Vec<String> = groups.into_iter().collect();
    sorted.sort();
    sorted
}

// --- Validation helpers ---

/// Valid priority values for task metadata.
const VALID_PRIORITIES: &[&str] = &["critical", "high", "medium", "low"];

/// Valid complexity values for task metadata.
const VALID_COMPLEXITIES: &[&str] = &["XS", "S", "M", "L", "XL"];

/// Valid status values (normalized form, i.e. using underscores).
const VALID_STATUSES: &[&str] = &["backlog", "pending", "in_progress", "completed"];

/// Validate an ISO 8601 timestamp string.
/// Accepts formats like "2026-04-06T14:30:00Z" and "2026-04-06T14:30:00+00:00".
fn is_valid_iso8601(s: &str) -> bool {
    chrono::DateTime::parse_from_rfc3339(s).is_ok()
        || chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%SZ").is_ok()
        || chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.fZ").is_ok()
}

/// Validate a task JSON object against the SDD task schema before writing.
///
/// Checks:
/// - Required fields: id, title, description, status
/// - Status must be a valid status value
/// - If `expected_status` is provided, status must match it
/// - Priority must be one of: critical, high, medium, low
/// - Complexity must be one of: XS, S, M, L, XL
/// - Timestamps (created_at, updated_at) must be valid ISO 8601
/// - blocked_by items must be strings or numbers (valid JSON scalar IDs)
///
/// Unknown fields are allowed for forward compatibility.
fn validate_task_json(
    task: &serde_json::Value,
    expected_status: Option<&str>,
) -> Result<(), String> {
    let obj = task
        .as_object()
        .ok_or_else(|| "Validation failed: task JSON is not an object".to_string())?;

    // Required fields
    if !obj.contains_key("id") {
        return Err("Validation failed: missing required field 'id'".to_string());
    }

    if !obj.contains_key("title") {
        return Err("Validation failed: missing required field 'title'".to_string());
    }
    if !obj["title"].is_string() {
        return Err("Validation failed: field 'title' must be a string".to_string());
    }

    if !obj.contains_key("description") {
        return Err("Validation failed: missing required field 'description'".to_string());
    }
    if !obj["description"].is_string() {
        return Err("Validation failed: field 'description' must be a string".to_string());
    }

    if !obj.contains_key("status") {
        return Err("Validation failed: missing required field 'status'".to_string());
    }
    let status = obj["status"]
        .as_str()
        .ok_or_else(|| "Validation failed: field 'status' must be a string".to_string())?;
    if !VALID_STATUSES.contains(&status) {
        return Err(format!(
            "Validation failed: field 'status' has invalid value '{}'. Expected one of: {}",
            status,
            VALID_STATUSES.join(", ")
        ));
    }

    // Status must match target directory if specified
    if let Some(expected) = expected_status {
        if status != expected {
            return Err(format!(
                "Validation failed: field 'status' is '{}' but target directory is '{}'. Status must match the target directory.",
                status, expected
            ));
        }
    }

    // Validate metadata if present
    if let Some(metadata) = obj.get("metadata") {
        if let Some(meta_obj) = metadata.as_object() {
            // Validate priority
            if let Some(priority_val) = meta_obj.get("priority") {
                let priority = priority_val.as_str().ok_or_else(|| {
                    "Validation failed: field 'metadata.priority' must be a string".to_string()
                })?;
                if !VALID_PRIORITIES.contains(&priority) {
                    return Err(format!(
                        "Validation failed: field 'metadata.priority' has invalid value '{}'. Expected one of: {}",
                        priority,
                        VALID_PRIORITIES.join(", ")
                    ));
                }
            }

            // Validate complexity
            if let Some(complexity_val) = meta_obj.get("complexity") {
                let complexity = complexity_val.as_str().ok_or_else(|| {
                    "Validation failed: field 'metadata.complexity' must be a string".to_string()
                })?;
                if !VALID_COMPLEXITIES.contains(&complexity) {
                    return Err(format!(
                        "Validation failed: field 'metadata.complexity' has invalid value '{}'. Expected one of: {}",
                        complexity,
                        VALID_COMPLEXITIES.join(", ")
                    ));
                }
            }
        }
    }

    // Validate timestamps if present
    if let Some(created_at_val) = obj.get("created_at") {
        let created_at = created_at_val.as_str().ok_or_else(|| {
            "Validation failed: field 'created_at' must be a string".to_string()
        })?;
        if !is_valid_iso8601(created_at) {
            return Err(format!(
                "Validation failed: field 'created_at' has invalid ISO 8601 timestamp '{}'. Expected format: YYYY-MM-DDTHH:MM:SSZ",
                created_at
            ));
        }
    }

    if let Some(updated_at_val) = obj.get("updated_at") {
        let updated_at = updated_at_val.as_str().ok_or_else(|| {
            "Validation failed: field 'updated_at' must be a string".to_string()
        })?;
        if !is_valid_iso8601(updated_at) {
            return Err(format!(
                "Validation failed: field 'updated_at' has invalid ISO 8601 timestamp '{}'. Expected format: YYYY-MM-DDTHH:MM:SSZ",
                updated_at
            ));
        }
    }

    // Validate blocked_by if present — items must be strings or numbers
    if let Some(blocked_by_val) = obj.get("blocked_by") {
        if let Some(arr) = blocked_by_val.as_array() {
            for (i, item) in arr.iter().enumerate() {
                if !item.is_string() && !item.is_number() {
                    return Err(format!(
                        "Validation failed: field 'blocked_by[{}]' must be a string or number, got: {}",
                        i, item
                    ));
                }
            }
        } else if !blocked_by_val.is_null() {
            return Err(
                "Validation failed: field 'blocked_by' must be an array".to_string(),
            );
        }
    }

    Ok(())
}

/// Validate that all `blocked_by` IDs in a task JSON reference existing task files.
///
/// Scans all status directories to build a set of known task IDs, then checks
/// each blocked_by entry exists. Returns an error listing the first unknown ID found.
fn validate_blocked_by_references(
    task: &serde_json::Value,
    tasks_base: &Path,
) -> Result<(), String> {
    let blocked_by = match task.get("blocked_by").and_then(|v| v.as_array()) {
        Some(arr) if !arr.is_empty() => arr,
        _ => return Ok(()), // No blocked_by or empty array — nothing to validate
    };

    // Build a set of all known task IDs by scanning task files
    let mut known_ids: HashSet<String> = HashSet::new();

    for &status_dir_name in STATUS_DIRS {
        let status_dir = tasks_base.join(status_dir_name);
        if !status_dir.exists() {
            continue;
        }
        let group_entries = match std::fs::read_dir(&status_dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for group_entry in group_entries.flatten() {
            let group_path = group_entry.path();
            if !group_path.is_dir() {
                continue;
            }
            let file_entries = match std::fs::read_dir(&group_path) {
                Ok(entries) => entries,
                Err(_) => continue,
            };
            for file_entry in file_entries.flatten() {
                let file_path = file_entry.path();
                if file_path.is_file() {
                    if let Some(name) = file_path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with("task-") && name.ends_with(".json") {
                            // Read the file to extract the task ID
                            if let Ok(contents) = std::fs::read_to_string(&file_path) {
                                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) {
                                    if let Some(id) = val.get("id") {
                                        // Normalize ID to string for comparison
                                        let id_str = match id {
                                            serde_json::Value::Number(n) => n.to_string(),
                                            serde_json::Value::String(s) => s.clone(),
                                            _ => continue,
                                        };
                                        known_ids.insert(id_str);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Check each blocked_by ID against the known set
    for item in blocked_by {
        let id_str = match item {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            _ => continue, // Schema validation already checks types
        };
        if !known_ids.contains(&id_str) {
            return Err(format!(
                "Validation failed: blocked_by references unknown task ID '{}'. \
                 No task file found with this ID in any status directory.",
                id_str
            ));
        }
    }

    Ok(())
}

// --- Write helpers ---

/// Map a normalized status name back to the filesystem directory name.
/// `in_progress` (JSON/Rust) becomes `in-progress` (filesystem).
fn status_to_dir_name(status: &str) -> &str {
    match status {
        "in_progress" => "in-progress",
        other => other,
    }
}

/// Generate a current ISO 8601 timestamp string (e.g., "2026-04-06T14:30:00Z").
fn now_iso8601() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

/// Atomically write contents to a file: write to a temp file in the same directory,
/// then rename to the target path. This prevents partial writes on crash or concurrent access.
fn atomic_write(target: &Path, contents: &[u8]) -> Result<(), String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("Cannot determine parent directory of {}", target.display()))?;

    // Create temp file in the same directory (ensures same filesystem for rename)
    let temp_path = parent.join(format!(
        ".tmp-{}",
        target
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("task")
    ));

    std::fs::write(&temp_path, contents).map_err(|e| {
        // Clean up temp file on write failure (disk full, permission denied, etc.)
        let _ = std::fs::remove_file(&temp_path);
        match e.kind() {
            std::io::ErrorKind::PermissionDenied => {
                format!("Permission denied writing to {}: {}", parent.display(), e)
            }
            _ => format!("Failed to write temp file {}: {}", temp_path.display(), e),
        }
    })?;

    std::fs::rename(&temp_path, target).map_err(|e| {
        // Clean up temp file if rename fails
        let _ = std::fs::remove_file(&temp_path);
        format!(
            "Failed to rename temp file to {}: {}",
            target.display(),
            e
        )
    })
}

/// Read a task JSON file as a generic serde_json::Value to preserve all fields.
fn read_task_json(path: &Path) -> Result<serde_json::Value, String> {
    let contents = std::fs::read_to_string(path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => {
            format!("File not found (may have been moved externally): {}", path.display())
        }
        std::io::ErrorKind::PermissionDenied => {
            format!("Permission denied reading {}: {}", path.display(), e)
        }
        _ => format!("Failed to read {}: {}", path.display(), e),
    })?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Invalid JSON in {}: {}", path.display(), e))
}

// --- Write IPC Commands ---

/// Move a task JSON file from its current status directory to a new one.
///
/// Updates the `status` field and `updated_at` timestamp inside the JSON.
/// Uses atomic write (temp file + rename) to prevent corruption.
///
/// The `file_path` is the absolute path to the current task JSON file.
/// The `new_status` is the target status (e.g., "pending", "in_progress", "completed").
/// The `last_read_mtime_ms` is the file modification timestamp from when the frontend
/// last loaded this task. If provided, conflict detection is performed before writing.
#[tauri::command]
pub fn move_task(
    file_path: String,
    new_status: String,
    last_read_mtime_ms: Option<u64>,
) -> Result<serde_json::Value, String> {
    let source = Path::new(&file_path);

    // Conflict detection: if the caller provided a last-read timestamp, verify
    // the file hasn't been modified externally since then.
    if let Some(mtime) = last_read_mtime_ms {
        check_conflict(source, mtime)?;
    }

    // Validate the new status
    let new_dir_name = status_to_dir_name(&new_status);
    let valid_statuses: Vec<&str> = STATUS_DIRS
        .iter()
        .map(|&d| normalize_status(d))
        .collect();
    if !valid_statuses.contains(&new_status.as_str()) {
        return Err(format!(
            "Invalid status '{}'. Valid statuses: {}",
            new_status,
            valid_statuses.join(", ")
        ));
    }

    // Read the current task JSON (preserves all fields including unknown ones)
    let mut task_value = read_task_json(source)?;

    // Update status and updated_at
    let obj = task_value
        .as_object_mut()
        .ok_or_else(|| "Task JSON is not an object".to_string())?;
    obj.insert(
        "status".to_string(),
        serde_json::Value::String(new_status.clone()),
    );
    obj.insert(
        "updated_at".to_string(),
        serde_json::Value::String(now_iso8601()),
    );

    // Validate the task JSON against the SDD task schema before writing.
    // The expected_status ensures the status field matches the target directory.
    validate_task_json(&task_value, Some(&new_status))?;

    let file_name = source
        .file_name()
        .ok_or_else(|| format!("Cannot determine filename from {}", file_path))?;

    // Determine the task group directory name from the current path:
    // .agents/tasks/{status}/{group}/{file}.json -> group is parent of file
    let group_dir = source
        .parent()
        .ok_or_else(|| format!("Cannot determine group directory from {}", file_path))?;
    let group_name = group_dir
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Cannot determine group name from {}", file_path))?;

    // Determine the tasks base path: go up from group -> status -> tasks base
    let status_dir = group_dir
        .parent()
        .ok_or_else(|| format!("Cannot determine status directory from {}", file_path))?;
    let tasks_base = status_dir
        .parent()
        .ok_or_else(|| format!("Cannot determine tasks base directory from {}", file_path))?;

    // Validate blocked_by references point to existing task files
    validate_blocked_by_references(&task_value, tasks_base)?;

    // Build target path: {tasks_base}/{new_status_dir}/{group}/{file}
    let target_group_dir = tasks_base.join(new_dir_name).join(group_name);
    let mut target_path = target_group_dir.join(file_name);

    // Create target directory if it doesn't exist
    std::fs::create_dir_all(&target_group_dir).map_err(|e| {
        format!(
            "Failed to create target directory {}: {}",
            target_group_dir.display(),
            e
        )
    })?;

    // Handle name collision: if target already exists, append a numeric suffix
    if target_path.exists() && target_path != source {
        let stem = target_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("task");
        let ext = target_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("json");
        let mut counter = 1u32;
        loop {
            let new_name = format!("{}-{}.{}", stem, counter, ext);
            let candidate = target_group_dir.join(&new_name);
            if !candidate.exists() {
                target_path = candidate;
                break;
            }
            counter += 1;
            if counter > 1000 {
                return Err(format!(
                    "Too many name collisions at {}",
                    target_group_dir.display()
                ));
            }
        }
    }

    // Serialize updated JSON
    let contents = serde_json::to_string_pretty(&task_value)
        .map_err(|e| format!("Failed to serialize task JSON: {}", e))?;

    // Write atomically to the target path
    atomic_write(&target_path, contents.as_bytes())?;

    // Remove the original file (only if source != target, e.g., not a same-dir collision rename)
    if source != target_path {
        let _ = std::fs::remove_file(source);
    }

    // Return the updated task with the new file path and updated mtime
    let new_mtime_ms = get_file_mtime_ms(&target_path);
    let result = serde_json::json!({
        "task": task_value,
        "file_path": target_path.display().to_string(),
        "mtime_ms": new_mtime_ms,
    });

    Ok(result)
}

/// Update specific fields in a task JSON file.
///
/// The `fields` parameter is a JSON object of key-value pairs to merge into the task.
/// The `updated_at` timestamp is automatically set to the current time.
/// Uses atomic write (temp file + rename) to prevent corruption.
/// The `last_read_mtime_ms` is the file modification timestamp from when the frontend
/// last loaded this task. If provided, conflict detection is performed before writing.
#[tauri::command]
pub fn update_task_fields(
    file_path: String,
    fields: serde_json::Value,
    last_read_mtime_ms: Option<u64>,
) -> Result<serde_json::Value, String> {
    let path = Path::new(&file_path);

    // Conflict detection: if the caller provided a last-read timestamp, verify
    // the file hasn't been modified externally since then.
    if let Some(mtime) = last_read_mtime_ms {
        check_conflict(path, mtime)?;
    }

    let fields_obj = fields
        .as_object()
        .ok_or_else(|| "Fields parameter must be a JSON object".to_string())?;

    // Read the current task JSON
    let mut task_value = read_task_json(path)?;

    let obj = task_value
        .as_object_mut()
        .ok_or_else(|| "Task JSON is not an object".to_string())?;

    // Merge the provided fields into the task
    for (key, value) in fields_obj {
        obj.insert(key.clone(), value.clone());
    }

    // Always update the timestamp
    obj.insert(
        "updated_at".to_string(),
        serde_json::Value::String(now_iso8601()),
    );

    // Validate the merged task JSON against the SDD task schema before writing.
    // No expected_status check here — update_task_fields doesn't change directories.
    validate_task_json(&task_value, None)?;

    // Validate blocked_by references if we can determine the tasks base path.
    // Path structure: .agents/tasks/{status}/{group}/{file}.json
    if let Some(group_dir) = path.parent() {
        if let Some(status_dir) = group_dir.parent() {
            if let Some(tasks_base) = status_dir.parent() {
                validate_blocked_by_references(&task_value, tasks_base)?;
            }
        }
    }

    // Serialize and write atomically
    let contents = serde_json::to_string_pretty(&task_value)
        .map_err(|e| format!("Failed to serialize task JSON: {}", e))?;

    atomic_write(path, contents.as_bytes())?;

    // Return updated task with new mtime for conflict tracking
    let new_mtime_ms = get_file_mtime_ms(path);
    let result = serde_json::json!({
        "task": task_value,
        "mtime_ms": new_mtime_ms,
    });

    Ok(result)
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Create a temporary project directory structure for testing.
    fn setup_test_project(tmp: &Path) {
        let tasks_base = tmp.join(".agents").join("tasks");

        // Create status directories with groups
        for status in STATUS_DIRS {
            fs::create_dir_all(tasks_base.join(status).join("my-feature")).unwrap();
        }

        // Create manifest directory
        fs::create_dir_all(tasks_base.join("_manifests")).unwrap();
    }

    fn write_task_json(path: &Path, id: serde_json::Value, title: &str, status: &str) {
        let task_json = serde_json::json!({
            "id": id,
            "title": title,
            "description": "Test description",
            "status": status,
            "metadata": {
                "priority": "medium",
                "task_group": "my-feature"
            }
        });
        fs::write(path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();
    }

    #[test]
    fn test_read_tasks_empty_project() {
        let tmp = tempfile::tempdir().unwrap();
        let result = read_tasks(tmp.path().display().to_string());
        assert!(result.backlog.is_empty());
        assert!(result.pending.is_empty());
        assert!(result.in_progress.is_empty());
        assert!(result.completed.is_empty());
    }

    #[test]
    fn test_read_tasks_with_valid_files() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Write tasks in different statuses
        write_task_json(
            &tasks_base.join("pending").join("my-feature").join("task-001.json"),
            serde_json::json!(1),
            "Task One",
            "pending",
        );
        write_task_json(
            &tasks_base.join("in-progress").join("my-feature").join("task-002.json"),
            serde_json::json!(2),
            "Task Two",
            "in_progress",
        );
        write_task_json(
            &tasks_base.join("completed").join("my-feature").join("task-003.json"),
            serde_json::json!("3"),
            "Task Three",
            "completed",
        );

        let result = read_tasks(tmp.path().display().to_string());
        assert_eq!(result.pending.len(), 1);
        assert_eq!(result.in_progress.len(), 1);
        assert_eq!(result.completed.len(), 1);
        assert!(result.backlog.is_empty());

        // Verify parsed task content
        if let TaskFileResult::Ok { task, .. } = &result.pending[0] {
            assert_eq!(task.title, "Task One");
            assert_eq!(task.status, "pending");
        } else {
            panic!("Expected Ok result for pending task");
        }
    }

    #[test]
    fn test_read_tasks_invalid_json() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let bad_file = tasks_base.join("pending").join("my-feature").join("task-099.json");
        fs::write(&bad_file, "{ this is not valid json }").unwrap();

        let result = read_tasks(tmp.path().display().to_string());
        assert_eq!(result.pending.len(), 1);

        if let TaskFileResult::Error { error, .. } = &result.pending[0] {
            assert!(error.contains("Invalid JSON"), "Error should mention invalid JSON: {}", error);
        } else {
            panic!("Expected Error result for invalid JSON file");
        }
    }

    #[test]
    fn test_read_tasks_missing_required_fields() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let incomplete_file = tasks_base.join("pending").join("my-feature").join("task-050.json");
        // Missing required fields: title, description, status
        fs::write(&incomplete_file, r#"{"id": 50}"#).unwrap();

        let result = read_tasks(tmp.path().display().to_string());
        assert_eq!(result.pending.len(), 1);

        if let TaskFileResult::Error { error, .. } = &result.pending[0] {
            assert!(error.contains("Invalid JSON"), "Error should describe missing fields: {}", error);
        } else {
            panic!("Expected Error result for incomplete JSON");
        }
    }

    #[test]
    fn test_read_single_task() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-010.json");
        write_task_json(&task_path, serde_json::json!(10), "Single Task", "pending");

        let result = read_task(task_path.display().to_string());
        if let TaskFileResult::Ok { task, file_path, mtime_ms } = &result {
            assert_eq!(task.title, "Single Task");
            assert_eq!(task.id, serde_json::json!(10));
            assert!(file_path.contains("task-010.json"));
            assert!(*mtime_ms > 0, "mtime_ms should be a positive timestamp");
        } else {
            panic!("Expected Ok result for valid task file");
        }
    }

    #[test]
    fn test_read_single_task_not_found() {
        let result = read_task("/nonexistent/path/task-999.json".to_string());
        if let TaskFileResult::Error { error, .. } = &result {
            assert!(error.contains("Failed to read file"), "Error: {}", error);
        } else {
            panic!("Expected Error result for missing file");
        }
    }

    #[test]
    fn test_read_manifest() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let manifest_path = tmp.path().join(".agents").join("tasks").join("_manifests").join("my-feature.json");
        let manifest_json = serde_json::json!({
            "task_group": "my-feature",
            "spec_path": "specs/my-feature-SPEC.md",
            "total": 10,
            "backlog": 2,
            "pending": 3,
            "in_progress": 1,
            "completed": 4,
            "created_at": "2026-04-06T10:00:00Z"
        });
        fs::write(&manifest_path, serde_json::to_string_pretty(&manifest_json).unwrap()).unwrap();

        let result = read_manifest(tmp.path().display().to_string(), "my-feature".to_string());
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        let manifest = result.unwrap();
        assert_eq!(manifest.task_group, "my-feature");
        assert_eq!(manifest.total, 10);
        assert_eq!(manifest.backlog, 2);
        assert_eq!(manifest.pending, 3);
        assert_eq!(manifest.in_progress, 1);
        assert_eq!(manifest.completed, 4);
        assert_eq!(manifest.spec_path, Some("specs/my-feature-SPEC.md".to_string()));
    }

    #[test]
    fn test_read_manifest_not_found() {
        let tmp = tempfile::tempdir().unwrap();
        let result = read_manifest(tmp.path().display().to_string(), "nonexistent".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Manifest not found"));
    }

    #[test]
    fn test_list_task_groups() {
        let tmp = tempfile::tempdir().unwrap();
        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Create groups in different status dirs
        fs::create_dir_all(tasks_base.join("pending").join("auth-feature")).unwrap();
        fs::create_dir_all(tasks_base.join("pending").join("payments")).unwrap();
        fs::create_dir_all(tasks_base.join("completed").join("auth-feature")).unwrap();
        fs::create_dir_all(tasks_base.join("in-progress").join("onboarding")).unwrap();

        let groups = list_task_groups(tmp.path().display().to_string());
        assert_eq!(groups, vec!["auth-feature", "onboarding", "payments"]);
    }

    #[test]
    fn test_list_task_groups_empty_project() {
        let tmp = tempfile::tempdir().unwrap();
        let groups = list_task_groups(tmp.path().display().to_string());
        assert!(groups.is_empty());
    }

    #[test]
    fn test_task_with_all_fields() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let task_json = serde_json::json!({
            "id": "task-42",
            "title": "Full task",
            "description": "A task with all fields populated",
            "status": "pending",
            "acceptance_criteria": {
                "functional": ["Criterion 1", "Criterion 2"],
                "edge_cases": ["Edge 1"],
                "error_handling": ["Error 1"],
                "performance": ["Perf 1"]
            },
            "testing_requirements": ["Unit: test X", "Integration: test Y"],
            "blocked_by": [1, "task-2"],
            "blocks": [5],
            "metadata": {
                "priority": "high",
                "complexity": "M",
                "task_group": "my-feature",
                "spec_path": "specs/feature-SPEC.md",
                "feature_name": "My Feature",
                "source_section": "Section 5.1",
                "spec_phase": 1,
                "spec_phase_name": "Foundation",
                "produces_for": ["task-5"],
                "task_uid": "uid-42"
            },
            "created_at": "2026-04-06T10:00:00Z",
            "updated_at": "2026-04-06T12:00:00Z"
        });

        let task_path = tmp.path().join(".agents").join("tasks")
            .join("pending").join("my-feature").join("task-042.json");
        fs::write(&task_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        let result = read_task(task_path.display().to_string());
        if let TaskFileResult::Ok { task, .. } = &result {
            assert_eq!(task.id, serde_json::json!("task-42"));
            assert_eq!(task.title, "Full task");
            assert_eq!(task.status, "pending");

            let ac = task.acceptance_criteria.as_ref().unwrap();
            assert_eq!(ac.functional.as_ref().unwrap().len(), 2);
            assert_eq!(ac.edge_cases.as_ref().unwrap().len(), 1);

            let meta = task.metadata.as_ref().unwrap();
            assert_eq!(meta.priority, Some("high".to_string()));
            assert_eq!(meta.complexity, Some("M".to_string()));
            assert_eq!(meta.spec_phase, Some(1));
            assert_eq!(meta.produces_for, Some(vec!["task-5".to_string()]));

            assert_eq!(task.blocked_by.as_ref().unwrap().len(), 2);
            assert_eq!(task.blocks.as_ref().unwrap().len(), 1);
            assert_eq!(task.testing_requirements.as_ref().unwrap().len(), 2);
        } else {
            panic!("Expected Ok result for full task");
        }
    }

    #[test]
    fn test_task_with_unknown_fields() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let task_json = serde_json::json!({
            "id": 99,
            "title": "Forward compat",
            "description": "Task with unknown fields",
            "status": "pending",
            "future_field": "should not break",
            "metadata": {
                "priority": "low",
                "new_meta_field": 42
            }
        });

        let task_path = tmp.path().join(".agents").join("tasks")
            .join("pending").join("my-feature").join("task-099.json");
        fs::write(&task_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        let result = read_task(task_path.display().to_string());
        if let TaskFileResult::Ok { task, .. } = &result {
            assert_eq!(task.title, "Forward compat");
            // Unknown field should be captured in extra
            assert_eq!(task.extra.get("future_field"), Some(&serde_json::json!("should not break")));
            let meta = task.metadata.as_ref().unwrap();
            assert_eq!(meta.extra.get("new_meta_field"), Some(&serde_json::json!(42)));
        } else {
            panic!("Expected Ok result for task with unknown fields");
        }
    }

    #[test]
    fn test_read_tasks_ignores_non_task_files() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let group_dir = tmp.path().join(".agents").join("tasks").join("pending").join("my-feature");
        // Write a valid task file
        write_task_json(
            &group_dir.join("task-001.json"),
            serde_json::json!(1),
            "Real Task",
            "pending",
        );
        // Write non-task files that should be ignored
        fs::write(group_dir.join("readme.md"), "# Notes").unwrap();
        fs::write(group_dir.join("config.json"), "{}").unwrap();

        let result = read_tasks(tmp.path().display().to_string());
        assert_eq!(result.pending.len(), 1, "Should only read task-*.json files");
    }

    #[test]
    fn test_read_tasks_multiple_groups() {
        let tmp = tempfile::tempdir().unwrap();
        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Create two groups in pending
        fs::create_dir_all(tasks_base.join("pending").join("group-a")).unwrap();
        fs::create_dir_all(tasks_base.join("pending").join("group-b")).unwrap();

        write_task_json(
            &tasks_base.join("pending").join("group-a").join("task-001.json"),
            serde_json::json!(1),
            "Group A Task",
            "pending",
        );
        write_task_json(
            &tasks_base.join("pending").join("group-b").join("task-002.json"),
            serde_json::json!(2),
            "Group B Task",
            "pending",
        );

        let result = read_tasks(tmp.path().display().to_string());
        assert_eq!(result.pending.len(), 2, "Should include tasks from both groups");
    }

    // --- move_task tests ---

    #[test]
    fn test_move_task_pending_to_in_progress() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-001.json");
        write_task_json(&source_path, serde_json::json!(1), "Move Me", "pending");

        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            None,
        );
        assert!(result.is_ok(), "move_task failed: {:?}", result);

        let result_val = result.unwrap();
        let new_file_path = result_val["file_path"].as_str().unwrap();

        // Source file should be gone
        assert!(!source_path.exists(), "Source file should be removed");

        // Target file should exist in in-progress directory
        assert!(
            new_file_path.contains("in-progress"),
            "New path should be in in-progress dir: {}",
            new_file_path
        );
        assert!(
            Path::new(new_file_path).exists(),
            "Target file should exist at {}",
            new_file_path
        );

        // Read back and verify contents
        let task = &result_val["task"];
        assert_eq!(task["status"], "in_progress");
        assert!(task["updated_at"].as_str().is_some(), "updated_at should be set");
    }

    #[test]
    fn test_move_task_updates_status_field() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-002.json");
        write_task_json(&source_path, serde_json::json!(2), "Status Update", "pending");

        let result = move_task(
            source_path.display().to_string(),
            "completed".to_string(),
            None,
        )
        .unwrap();

        let task = &result["task"];
        assert_eq!(task["status"], "completed", "Status field should be updated to completed");
    }

    #[test]
    fn test_move_task_sets_updated_at_iso8601() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("backlog").join("my-feature").join("task-003.json");
        write_task_json(&source_path, serde_json::json!(3), "Timestamp Check", "backlog");

        let result = move_task(
            source_path.display().to_string(),
            "pending".to_string(),
            None,
        )
        .unwrap();

        let updated_at = result["task"]["updated_at"].as_str().unwrap();
        // Should match ISO 8601 pattern: YYYY-MM-DDTHH:MM:SSZ
        assert!(
            updated_at.ends_with('Z'),
            "Timestamp should end with Z: {}",
            updated_at
        );
        assert_eq!(updated_at.len(), 20, "ISO 8601 timestamp should be 20 chars: {}", updated_at);
        assert_eq!(&updated_at[4..5], "-", "Should have dash at pos 4");
        assert_eq!(&updated_at[10..11], "T", "Should have T at pos 10");
    }

    #[test]
    fn test_move_task_creates_target_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Only create the source directory, not the target
        fs::create_dir_all(tasks_base.join("pending").join("new-group")).unwrap();
        let source_path = tasks_base.join("pending").join("new-group").join("task-001.json");
        write_task_json(&source_path, serde_json::json!(1), "Auto Create Dir", "pending");

        // Target dir (completed/new-group) does not exist yet
        let target_group_dir = tasks_base.join("completed").join("new-group");
        assert!(!target_group_dir.exists(), "Target dir should not exist yet");

        let result = move_task(
            source_path.display().to_string(),
            "completed".to_string(),
            None,
        );
        assert!(result.is_ok(), "move_task should create target dir: {:?}", result);
        assert!(target_group_dir.exists(), "Target dir should have been created");
    }

    #[test]
    fn test_move_task_handles_name_collision() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-001.json");
        write_task_json(&source_path, serde_json::json!(1), "Original", "pending");

        // Pre-create a file at the target location to cause collision
        let collision_path = tasks_base.join("completed").join("my-feature").join("task-001.json");
        write_task_json(&collision_path, serde_json::json!(1), "Existing", "completed");

        let result = move_task(
            source_path.display().to_string(),
            "completed".to_string(),
            None,
        );
        assert!(result.is_ok(), "move_task should handle collision: {:?}", result);

        let new_file_path = result.unwrap()["file_path"].as_str().unwrap().to_string();
        // Should have a numeric suffix
        assert!(
            new_file_path.contains("task-001-1.json"),
            "Should append -1 suffix for collision: {}",
            new_file_path
        );

        // Both files should exist
        assert!(collision_path.exists(), "Original target should still exist");
        assert!(Path::new(&new_file_path).exists(), "New suffixed file should exist");
    }

    #[test]
    fn test_move_task_invalid_status() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-001.json");
        write_task_json(&source_path, serde_json::json!(1), "Bad Status", "pending");

        let result = move_task(
            source_path.display().to_string(),
            "invalid_status".to_string(),
            None,
        );
        assert!(result.is_err(), "Should reject invalid status");
        assert!(
            result.unwrap_err().contains("Invalid status"),
            "Error should mention invalid status"
        );
    }

    #[test]
    fn test_move_task_file_not_found() {
        let result = move_task(
            "/nonexistent/path/task-999.json".to_string(),
            "completed".to_string(),
            None,
        );
        assert!(result.is_err(), "Should return error for missing file");
        let err = result.unwrap_err();
        assert!(
            err.contains("not found") || err.contains("Not found") || err.contains("No such file"),
            "Error should indicate file not found: {}",
            err
        );
    }

    #[test]
    fn test_move_task_preserves_all_fields() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Create tasks referenced by blocked_by
        write_task_json(
            &tasks_base.join("completed").join("my-feature").join("task-001.json"),
            serde_json::json!(1),
            "Blocker 1",
            "completed",
        );
        write_task_json(
            &tasks_base.join("completed").join("my-feature").join("task-002.json"),
            serde_json::json!(2),
            "Blocker 2",
            "completed",
        );

        let source_path = tasks_base.join("pending").join("my-feature").join("task-005.json");

        // Write a task with many fields including unknown ones
        let task_json = serde_json::json!({
            "id": 5,
            "title": "Preserve Fields",
            "description": "All fields should survive the move",
            "status": "pending",
            "acceptance_criteria": {
                "functional": ["Criterion 1"]
            },
            "blocked_by": [1, 2],
            "metadata": {
                "priority": "high",
                "task_group": "my-feature"
            },
            "custom_field": "should survive"
        });
        fs::write(&source_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            None,
        )
        .unwrap();

        let task = &result["task"];
        assert_eq!(task["id"], 5);
        assert_eq!(task["title"], "Preserve Fields");
        assert_eq!(task["description"], "All fields should survive the move");
        assert_eq!(task["status"], "in_progress");
        assert_eq!(task["custom_field"], "should survive");
        assert_eq!(task["blocked_by"], serde_json::json!([1, 2]));
        assert_eq!(task["acceptance_criteria"]["functional"], serde_json::json!(["Criterion 1"]));
    }

    #[test]
    fn test_move_task_atomic_write_no_temp_file_left() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-001.json");
        write_task_json(&source_path, serde_json::json!(1), "Atomic Check", "pending");

        let result = move_task(
            source_path.display().to_string(),
            "completed".to_string(),
            None,
        );
        assert!(result.is_ok());

        // Verify no temp files remain in the target directory
        let target_dir = tasks_base.join("completed").join("my-feature");
        for entry in fs::read_dir(&target_dir).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name().to_string_lossy().to_string();
            assert!(
                !name.starts_with(".tmp-"),
                "Temp file should not remain: {}",
                name
            );
        }
    }

    // --- update_task_fields tests ---

    #[test]
    fn test_update_task_fields_basic() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-001.json");
        write_task_json(&task_path, serde_json::json!(1), "Update Me", "pending");

        let fields = serde_json::json!({
            "title": "Updated Title"
        });

        let result = update_task_fields(task_path.display().to_string(), fields, None);
        assert!(result.is_ok(), "update_task_fields failed: {:?}", result);

        let updated = result.unwrap();
        assert_eq!(updated["task"]["title"], "Updated Title");
        assert!(updated["task"]["updated_at"].as_str().is_some(), "updated_at should be set");
        assert!(updated["mtime_ms"].as_u64().is_some(), "mtime_ms should be returned");

        // Verify the file on disk was updated
        let disk_contents = fs::read_to_string(&task_path).unwrap();
        let disk_task: serde_json::Value = serde_json::from_str(&disk_contents).unwrap();
        assert_eq!(disk_task["title"], "Updated Title");
    }

    #[test]
    fn test_update_task_fields_multiple_fields() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-002.json");
        write_task_json(&task_path, serde_json::json!(2), "Multi Update", "pending");

        let fields = serde_json::json!({
            "title": "New Title",
            "description": "New description",
            "metadata": {
                "priority": "critical",
                "task_group": "my-feature"
            }
        });

        let result = update_task_fields(task_path.display().to_string(), fields, None).unwrap();
        assert_eq!(result["task"]["title"], "New Title");
        assert_eq!(result["task"]["description"], "New description");
        assert_eq!(result["task"]["metadata"]["priority"], "critical");
    }

    #[test]
    fn test_update_task_fields_sets_updated_at() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-003.json");

        let task_json = serde_json::json!({
            "id": 3,
            "title": "Timestamp Test",
            "description": "Test",
            "status": "pending",
            "updated_at": "2020-01-01T00:00:00Z"
        });
        fs::write(&task_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        let fields = serde_json::json!({"title": "Changed"});
        let result = update_task_fields(task_path.display().to_string(), fields, None).unwrap();

        let updated_at = result["task"]["updated_at"].as_str().unwrap();
        assert_ne!(updated_at, "2020-01-01T00:00:00Z", "updated_at should be refreshed");
        assert!(updated_at.ends_with('Z'), "Should be ISO 8601 format");
    }

    #[test]
    fn test_update_task_fields_file_not_found() {
        let fields = serde_json::json!({"title": "No File"});
        let result = update_task_fields(
            "/nonexistent/path/task-999.json".to_string(),
            fields,
            None,
        );
        assert!(result.is_err(), "Should return error for missing file");
        let err = result.unwrap_err();
        assert!(
            err.contains("not found") || err.contains("Not found") || err.contains("No such file"),
            "Error should indicate file not found: {}",
            err
        );
    }

    #[test]
    fn test_update_task_fields_invalid_fields_type() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-004.json");
        write_task_json(&task_path, serde_json::json!(4), "Bad Fields", "pending");

        // Pass an array instead of an object
        let fields = serde_json::json!(["not", "an", "object"]);
        let result = update_task_fields(task_path.display().to_string(), fields, None);
        assert!(result.is_err(), "Should reject non-object fields");
        assert!(result.unwrap_err().contains("must be a JSON object"));
    }

    #[test]
    fn test_update_task_fields_preserves_existing() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Create tasks referenced by blocked_by
        write_task_json(
            &tasks_base.join("completed").join("my-feature").join("task-001.json"),
            serde_json::json!(1),
            "Blocker 1",
            "completed",
        );
        write_task_json(
            &tasks_base.join("completed").join("my-feature").join("task-002.json"),
            serde_json::json!(2),
            "Blocker 2",
            "completed",
        );

        let task_path = tasks_base.join("pending").join("my-feature").join("task-005.json");

        let task_json = serde_json::json!({
            "id": 5,
            "title": "Keep Me",
            "description": "Original description",
            "status": "pending",
            "blocked_by": [1, 2],
            "custom_extra": "preserved"
        });
        fs::write(&task_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        // Only update title
        let fields = serde_json::json!({"title": "Updated Title"});
        let result = update_task_fields(task_path.display().to_string(), fields, None).unwrap();

        // Title should be updated
        assert_eq!(result["task"]["title"], "Updated Title");
        // Other fields should be preserved
        assert_eq!(result["task"]["description"], "Original description");
        assert_eq!(result["task"]["status"], "pending");
        assert_eq!(result["task"]["blocked_by"], serde_json::json!([1, 2]));
        assert_eq!(result["task"]["custom_extra"], "preserved");
    }

    #[test]
    fn test_update_task_fields_atomic_write() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-006.json");
        write_task_json(&task_path, serde_json::json!(6), "Atomic Update", "pending");

        let fields = serde_json::json!({"title": "After Atomic Write"});
        let result = update_task_fields(task_path.display().to_string(), fields, None);
        assert!(result.is_ok());

        // No temp files should remain
        let group_dir = tasks_base.join("pending").join("my-feature");
        for entry in fs::read_dir(&group_dir).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name().to_string_lossy().to_string();
            assert!(
                !name.starts_with(".tmp-"),
                "Temp file should not remain: {}",
                name
            );
        }

        // File should be valid JSON
        let disk_contents = fs::read_to_string(&task_path).unwrap();
        let disk_task: serde_json::Value = serde_json::from_str(&disk_contents).unwrap();
        assert_eq!(disk_task["title"], "After Atomic Write");
    }

    // --- atomic_write unit test ---

    #[test]
    fn test_atomic_write_creates_file() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("test-file.json");

        let result = atomic_write(&target, b"test content");
        assert!(result.is_ok(), "atomic_write failed: {:?}", result);
        assert!(target.exists(), "File should exist after atomic write");

        let contents = fs::read_to_string(&target).unwrap();
        assert_eq!(contents, "test content");
    }

    #[test]
    fn test_atomic_write_overwrites_existing() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("existing.json");
        fs::write(&target, "old content").unwrap();

        let result = atomic_write(&target, b"new content");
        assert!(result.is_ok());

        let contents = fs::read_to_string(&target).unwrap();
        assert_eq!(contents, "new content");
    }

    // --- now_iso8601 unit test ---

    #[test]
    fn test_now_iso8601_format() {
        let ts = now_iso8601();
        assert_eq!(ts.len(), 20, "ISO 8601 timestamp should be 20 chars: {}", ts);
        assert!(ts.ends_with('Z'), "Should end with Z: {}", ts);
        assert_eq!(&ts[4..5], "-");
        assert_eq!(&ts[7..8], "-");
        assert_eq!(&ts[10..11], "T");
        assert_eq!(&ts[13..14], ":");
        assert_eq!(&ts[16..17], ":");
    }

    // --- status_to_dir_name unit test ---

    #[test]
    fn test_status_to_dir_name() {
        assert_eq!(status_to_dir_name("in_progress"), "in-progress");
        assert_eq!(status_to_dir_name("pending"), "pending");
        assert_eq!(status_to_dir_name("backlog"), "backlog");
        assert_eq!(status_to_dir_name("completed"), "completed");
    }

    // --- validate_task_json tests ---

    #[test]
    fn test_validate_valid_task() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Valid task",
            "description": "A valid task",
            "status": "pending",
            "metadata": {
                "priority": "high",
                "complexity": "M",
                "task_group": "my-feature"
            },
            "created_at": "2026-04-06T10:00:00Z",
            "updated_at": "2026-04-06T12:00:00Z",
            "blocked_by": [1, "task-2"],
            "blocks": [3]
        });
        assert!(validate_task_json(&task, None).is_ok());
    }

    #[test]
    fn test_validate_valid_task_with_expected_status() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Valid task",
            "description": "A valid task",
            "status": "in_progress"
        });
        assert!(validate_task_json(&task, Some("in_progress")).is_ok());
    }

    #[test]
    fn test_validate_status_mismatch() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Status mismatch",
            "description": "Task",
            "status": "pending"
        });
        let result = validate_task_json(&task, Some("completed"));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("status"), "Error should mention status: {}", err);
        assert!(err.contains("pending"), "Error should mention current value: {}", err);
        assert!(err.contains("completed"), "Error should mention expected value: {}", err);
    }

    #[test]
    fn test_validate_missing_id() {
        let task = serde_json::json!({
            "title": "No ID",
            "description": "Missing id field",
            "status": "pending"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("'id'"));
    }

    #[test]
    fn test_validate_missing_title() {
        let task = serde_json::json!({
            "id": 1,
            "description": "Missing title",
            "status": "pending"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("'title'"));
    }

    #[test]
    fn test_validate_missing_description() {
        let task = serde_json::json!({
            "id": 1,
            "title": "No desc",
            "status": "pending"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("'description'"));
    }

    #[test]
    fn test_validate_missing_status() {
        let task = serde_json::json!({
            "id": 1,
            "title": "No status",
            "description": "Missing status"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("'status'"));
    }

    #[test]
    fn test_validate_invalid_status_value() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Bad status",
            "description": "Invalid status value",
            "status": "archived"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("'status'"), "Error should mention field: {}", err);
        assert!(err.contains("archived"), "Error should mention invalid value: {}", err);
    }

    #[test]
    fn test_validate_invalid_priority() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Bad priority",
            "description": "Invalid priority",
            "status": "pending",
            "metadata": {
                "priority": "urgent"
            }
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("priority"), "Error should mention priority: {}", err);
        assert!(err.contains("urgent"), "Error should mention invalid value: {}", err);
    }

    #[test]
    fn test_validate_all_valid_priorities() {
        for priority in VALID_PRIORITIES {
            let task = serde_json::json!({
                "id": 1,
                "title": "Priority test",
                "description": "Test",
                "status": "pending",
                "metadata": { "priority": priority }
            });
            assert!(
                validate_task_json(&task, None).is_ok(),
                "Priority '{}' should be valid",
                priority
            );
        }
    }

    #[test]
    fn test_validate_invalid_complexity() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Bad complexity",
            "description": "Invalid complexity",
            "status": "pending",
            "metadata": {
                "complexity": "XXL"
            }
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("complexity"), "Error should mention complexity: {}", err);
        assert!(err.contains("XXL"), "Error should mention invalid value: {}", err);
    }

    #[test]
    fn test_validate_all_valid_complexities() {
        for complexity in VALID_COMPLEXITIES {
            let task = serde_json::json!({
                "id": 1,
                "title": "Complexity test",
                "description": "Test",
                "status": "pending",
                "metadata": { "complexity": complexity }
            });
            assert!(
                validate_task_json(&task, None).is_ok(),
                "Complexity '{}' should be valid",
                complexity
            );
        }
    }

    #[test]
    fn test_validate_invalid_created_at_timestamp() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Bad timestamp",
            "description": "Invalid created_at",
            "status": "pending",
            "created_at": "not-a-date"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("created_at"), "Error should mention field: {}", err);
        assert!(err.contains("not-a-date"), "Error should mention value: {}", err);
    }

    #[test]
    fn test_validate_invalid_updated_at_timestamp() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Bad timestamp",
            "description": "Invalid updated_at",
            "status": "pending",
            "updated_at": "2026-13-01T00:00:00Z"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("updated_at"), "Error should mention field: {}", err);
    }

    #[test]
    fn test_validate_valid_timestamps() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Good timestamps",
            "description": "Valid timestamps",
            "status": "pending",
            "created_at": "2026-04-06T10:00:00Z",
            "updated_at": "2026-04-06T14:30:00+00:00"
        });
        assert!(validate_task_json(&task, None).is_ok());
    }

    #[test]
    fn test_validate_blocked_by_invalid_item() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Bad blocked_by",
            "description": "Invalid blocked_by item",
            "status": "pending",
            "blocked_by": [1, {"nested": "object"}]
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("blocked_by"), "Error should mention field: {}", err);
    }

    #[test]
    fn test_validate_empty_blocked_by_is_valid() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Empty blocked_by",
            "description": "Empty array is fine",
            "status": "pending",
            "blocked_by": []
        });
        assert!(validate_task_json(&task, None).is_ok());
    }

    #[test]
    fn test_validate_optional_metadata_absent() {
        let task = serde_json::json!({
            "id": 1,
            "title": "No metadata",
            "description": "Metadata is optional",
            "status": "pending"
        });
        assert!(validate_task_json(&task, None).is_ok());
    }

    #[test]
    fn test_validate_unknown_fields_preserved() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Forward compat",
            "description": "Unknown fields are fine",
            "status": "pending",
            "future_field": "some value",
            "another_unknown": [1, 2, 3]
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_ok(), "Unknown fields should not cause validation failure");
    }

    #[test]
    fn test_validate_not_an_object() {
        let task = serde_json::json!("just a string");
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not an object"));
    }

    #[test]
    fn test_validate_title_not_a_string() {
        let task = serde_json::json!({
            "id": 1,
            "title": 123,
            "description": "Test",
            "status": "pending"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("'title' must be a string"));
    }

    #[test]
    fn test_validate_description_not_a_string() {
        let task = serde_json::json!({
            "id": 1,
            "title": "Test",
            "description": 456,
            "status": "pending"
        });
        let result = validate_task_json(&task, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("'description' must be a string"));
    }

    // --- Integration: validate_task_json called from move_task ---

    #[test]
    fn test_move_task_rejects_invalid_task_json() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-bad.json");

        // Write a task with an invalid priority
        let task_json = serde_json::json!({
            "id": 1,
            "title": "Bad priority task",
            "description": "Has invalid priority",
            "status": "pending",
            "metadata": {
                "priority": "urgent"
            }
        });
        fs::write(&source_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            None,
        );
        assert!(result.is_err(), "move_task should reject invalid task JSON");
        let err = result.unwrap_err();
        assert!(err.contains("priority"), "Error should mention priority: {}", err);

        // Source file should NOT have been moved — no modification
        assert!(source_path.exists(), "Source file should still exist (write was rejected)");
    }

    #[test]
    fn test_update_task_fields_rejects_invalid_priority() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-val.json");
        write_task_json(&task_path, serde_json::json!(1), "Validate Update", "pending");

        let fields = serde_json::json!({
            "metadata": {
                "priority": "super-high"
            }
        });

        let result = update_task_fields(task_path.display().to_string(), fields, None);
        assert!(result.is_err(), "update_task_fields should reject invalid priority");
        let err = result.unwrap_err();
        assert!(err.contains("priority"), "Error should mention priority: {}", err);

        // File should not have been modified
        let disk_contents = fs::read_to_string(&task_path).unwrap();
        let disk_task: serde_json::Value = serde_json::from_str(&disk_contents).unwrap();
        assert_eq!(disk_task["metadata"]["priority"], "medium", "Original priority should be preserved");
    }

    #[test]
    fn test_unknown_fields_preserved_through_read_validate_write() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-fwd.json");

        // Write a task with unknown fields
        let task_json = serde_json::json!({
            "id": 1,
            "title": "Forward compat",
            "description": "Has unknown fields",
            "status": "pending",
            "future_field": "preserved value",
            "nested_unknown": {"key": "value"},
            "metadata": {
                "priority": "medium",
                "task_group": "my-feature",
                "custom_meta": true
            }
        });
        fs::write(&task_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        // Update a known field — unknown fields should survive
        let fields = serde_json::json!({"title": "Updated Title"});
        let result = update_task_fields(task_path.display().to_string(), fields, None);
        assert!(result.is_ok(), "Should succeed with unknown fields: {:?}", result);

        // Read back from disk and verify unknown fields are preserved
        let disk_contents = fs::read_to_string(&task_path).unwrap();
        let disk_task: serde_json::Value = serde_json::from_str(&disk_contents).unwrap();
        assert_eq!(disk_task["title"], "Updated Title", "Updated field should be changed");
        assert_eq!(disk_task["future_field"], "preserved value", "Unknown top-level field should survive");
        assert_eq!(disk_task["nested_unknown"]["key"], "value", "Unknown nested field should survive");
    }

    // --- get_file_mtime_ms unit tests ---

    #[test]
    fn test_get_file_mtime_ms_returns_positive_for_existing_file() {
        let tmp = tempfile::tempdir().unwrap();
        let file_path = tmp.path().join("test.json");
        fs::write(&file_path, "{}").unwrap();

        let mtime = get_file_mtime_ms(&file_path);
        assert!(mtime > 0, "mtime should be positive for existing file");
    }

    #[test]
    fn test_get_file_mtime_ms_returns_zero_for_nonexistent_file() {
        let mtime = get_file_mtime_ms(Path::new("/nonexistent/file.json"));
        assert_eq!(mtime, 0, "mtime should be 0 for nonexistent file");
    }

    // --- check_conflict unit tests ---

    #[test]
    fn test_check_conflict_no_conflict_when_mtime_matches() {
        let tmp = tempfile::tempdir().unwrap();
        let file_path = tmp.path().join("test.json");
        fs::write(&file_path, "{}").unwrap();

        let mtime = get_file_mtime_ms(&file_path);
        let result = check_conflict(&file_path, mtime);
        assert!(result.is_ok(), "Should not detect conflict when mtime matches");
    }

    #[test]
    fn test_check_conflict_detects_external_modification() {
        let tmp = tempfile::tempdir().unwrap();
        let file_path = tmp.path().join("test.json");
        fs::write(&file_path, "{}").unwrap();

        let original_mtime = get_file_mtime_ms(&file_path);

        // Wait briefly and modify the file to change its mtime
        std::thread::sleep(std::time::Duration::from_millis(50));
        fs::write(&file_path, r#"{"modified": true}"#).unwrap();

        let result = check_conflict(&file_path, original_mtime);
        assert!(result.is_err(), "Should detect conflict when file was modified");
        let err = result.unwrap_err();
        assert!(err.contains("Conflict"), "Error should mention conflict: {}", err);
        assert!(err.contains("modified externally"), "Error should explain the conflict: {}", err);
    }

    #[test]
    fn test_check_conflict_detects_file_deletion() {
        let tmp = tempfile::tempdir().unwrap();
        let file_path = tmp.path().join("test.json");
        fs::write(&file_path, "{}").unwrap();

        let mtime = get_file_mtime_ms(&file_path);

        // Delete the file
        fs::remove_file(&file_path).unwrap();

        let result = check_conflict(&file_path, mtime);
        assert!(result.is_err(), "Should detect conflict when file is deleted");
        let err = result.unwrap_err();
        assert!(err.contains("Conflict"), "Error should mention conflict: {}", err);
        assert!(err.contains("removed externally"), "Error should say file was removed: {}", err);
    }

    // --- Conflict detection integration tests ---

    #[test]
    fn test_move_task_detects_conflict_from_external_modification() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-conflict.json");
        write_task_json(&source_path, serde_json::json!(1), "Conflict Test", "pending");

        // Capture the mtime when first "reading" the task
        let original_mtime = get_file_mtime_ms(&source_path);

        // Simulate external modification (e.g., execute-tasks pipeline changed the file)
        std::thread::sleep(std::time::Duration::from_millis(50));
        let modified_json = serde_json::json!({
            "id": 1,
            "title": "Externally Modified",
            "description": "Changed by pipeline",
            "status": "pending",
            "metadata": { "priority": "high", "task_group": "my-feature" }
        });
        fs::write(&source_path, serde_json::to_string_pretty(&modified_json).unwrap()).unwrap();

        // Attempt to move with the stale mtime — should detect conflict
        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            Some(original_mtime),
        );
        assert!(result.is_err(), "move_task should detect conflict");
        let err = result.unwrap_err();
        assert!(err.contains("Conflict"), "Error should mention conflict: {}", err);

        // File should NOT have been moved — original should still exist
        assert!(source_path.exists(), "Source file should still exist after conflict");
    }

    #[test]
    fn test_move_task_detects_file_deleted_externally() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-deleted.json");
        write_task_json(&source_path, serde_json::json!(1), "Will Be Deleted", "pending");

        let original_mtime = get_file_mtime_ms(&source_path);

        // Delete the file externally
        fs::remove_file(&source_path).unwrap();

        // Attempt to move — should detect deletion
        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            Some(original_mtime),
        );
        assert!(result.is_err(), "move_task should detect deleted file");
        let err = result.unwrap_err();
        assert!(err.contains("removed externally"), "Error should mention removal: {}", err);
    }

    #[test]
    fn test_update_task_fields_detects_conflict() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-conflict2.json");
        write_task_json(&task_path, serde_json::json!(2), "Update Conflict", "pending");

        let original_mtime = get_file_mtime_ms(&task_path);

        // Simulate external modification
        std::thread::sleep(std::time::Duration::from_millis(50));
        let modified_json = serde_json::json!({
            "id": 2,
            "title": "Externally Changed",
            "description": "Test description",
            "status": "pending",
        });
        fs::write(&task_path, serde_json::to_string_pretty(&modified_json).unwrap()).unwrap();

        // Attempt to update with stale mtime — should detect conflict
        let fields = serde_json::json!({"title": "My Local Change"});
        let result = update_task_fields(
            task_path.display().to_string(),
            fields,
            Some(original_mtime),
        );
        assert!(result.is_err(), "update_task_fields should detect conflict");
        let err = result.unwrap_err();
        assert!(err.contains("Conflict"), "Error should mention conflict: {}", err);

        // File should NOT have been modified by our update
        let disk_contents = fs::read_to_string(&task_path).unwrap();
        let disk_task: serde_json::Value = serde_json::from_str(&disk_contents).unwrap();
        assert_eq!(disk_task["title"], "Externally Changed", "File should retain external changes");
    }

    #[test]
    fn test_update_task_fields_detects_file_deleted() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-deleted2.json");
        write_task_json(&task_path, serde_json::json!(2), "Will Be Deleted", "pending");

        let original_mtime = get_file_mtime_ms(&task_path);

        // Delete the file externally
        fs::remove_file(&task_path).unwrap();

        // Attempt to update — should detect deletion
        let fields = serde_json::json!({"title": "Can't update deleted file"});
        let result = update_task_fields(
            task_path.display().to_string(),
            fields,
            Some(original_mtime),
        );
        assert!(result.is_err(), "update_task_fields should detect deleted file");
        let err = result.unwrap_err();
        assert!(err.contains("removed externally"), "Error should mention removal: {}", err);
    }

    #[test]
    fn test_move_task_no_conflict_without_mtime() {
        // When no last_read_mtime_ms is provided, conflict detection is skipped
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-nomtime.json");
        write_task_json(&source_path, serde_json::json!(1), "No Mtime", "pending");

        // Should succeed without providing mtime (backward compatible)
        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            None,
        );
        assert!(result.is_ok(), "move_task should succeed without mtime: {:?}", result);
    }

    #[test]
    fn test_move_task_succeeds_with_correct_mtime() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-goodmtime.json");
        write_task_json(&source_path, serde_json::json!(1), "Good Mtime", "pending");

        let mtime = get_file_mtime_ms(&source_path);

        // Should succeed when mtime matches
        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            Some(mtime),
        );
        assert!(result.is_ok(), "move_task should succeed with correct mtime: {:?}", result);

        // Verify the response includes the new mtime
        let result_val = result.unwrap();
        assert!(result_val["mtime_ms"].as_u64().is_some(), "Response should include mtime_ms");
    }

    // --- validate_blocked_by_references tests ---

    #[test]
    fn test_validate_blocked_by_references_valid() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Create a task that will be referenced
        write_task_json(
            &tasks_base.join("pending").join("my-feature").join("task-001.json"),
            serde_json::json!(1),
            "Blocker Task",
            "pending",
        );

        // Task with blocked_by referencing the existing task
        let task = serde_json::json!({
            "id": 2,
            "title": "Blocked Task",
            "description": "Blocked by task 1",
            "status": "pending",
            "blocked_by": [1]
        });

        let result = validate_blocked_by_references(&task, &tasks_base);
        assert!(result.is_ok(), "Should pass when blocked_by references existing task: {:?}", result);
    }

    #[test]
    fn test_validate_blocked_by_references_unknown_id() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        // No tasks exist, so any blocked_by reference is invalid
        let task = serde_json::json!({
            "id": 2,
            "title": "Blocked Task",
            "description": "References nonexistent task",
            "status": "pending",
            "blocked_by": [999]
        });

        let result = validate_blocked_by_references(&task, &tasks_base);
        assert!(result.is_err(), "Should fail when blocked_by references unknown task");
        let err = result.unwrap_err();
        assert!(err.contains("999"), "Error should mention the unknown ID: {}", err);
        assert!(err.contains("unknown task ID"), "Error should describe the issue: {}", err);
    }

    #[test]
    fn test_validate_blocked_by_references_empty_array() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        let task = serde_json::json!({
            "id": 1,
            "title": "No Blockers",
            "description": "Empty blocked_by",
            "status": "pending",
            "blocked_by": []
        });

        let result = validate_blocked_by_references(&task, &tasks_base);
        assert!(result.is_ok(), "Empty blocked_by should pass: {:?}", result);
    }

    #[test]
    fn test_validate_blocked_by_references_no_field() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        let task = serde_json::json!({
            "id": 1,
            "title": "No blocked_by",
            "description": "No blocked_by field at all",
            "status": "pending"
        });

        let result = validate_blocked_by_references(&task, &tasks_base);
        assert!(result.is_ok(), "Missing blocked_by should pass: {:?}", result);
    }

    #[test]
    fn test_validate_blocked_by_references_string_ids() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");

        // Create a task with a string ID
        let task_json = serde_json::json!({
            "id": "task-abc",
            "title": "String ID Task",
            "description": "Has string ID",
            "status": "completed",
        });
        let task_path = tasks_base.join("completed").join("my-feature").join("task-abc.json");
        fs::write(&task_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        // Task referencing the string ID
        let task = serde_json::json!({
            "id": 2,
            "title": "Blocked by String",
            "description": "References string ID task",
            "status": "pending",
            "blocked_by": ["task-abc"]
        });

        let result = validate_blocked_by_references(&task, &tasks_base);
        assert!(result.is_ok(), "Should resolve string IDs: {:?}", result);
    }

    #[test]
    fn test_move_task_with_invalid_blocked_by_reference() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let source_path = tasks_base.join("pending").join("my-feature").join("task-blockedby.json");

        // Write a task with blocked_by referencing a nonexistent task
        let task_json = serde_json::json!({
            "id": 10,
            "title": "Bad Blocked By",
            "description": "References nonexistent task",
            "status": "pending",
            "blocked_by": [9999]
        });
        fs::write(&source_path, serde_json::to_string_pretty(&task_json).unwrap()).unwrap();

        let result = move_task(
            source_path.display().to_string(),
            "in_progress".to_string(),
            None,
        );
        assert!(result.is_err(), "move_task should reject invalid blocked_by reference");
        let err = result.unwrap_err();
        assert!(err.contains("9999"), "Error should mention the unknown ID: {}", err);

        // File should not have been moved
        assert!(source_path.exists(), "Source file should still exist");
    }

    #[test]
    fn test_update_task_fields_with_invalid_blocked_by_reference() {
        let tmp = tempfile::tempdir().unwrap();
        setup_test_project(tmp.path());

        let tasks_base = tmp.path().join(".agents").join("tasks");
        let task_path = tasks_base.join("pending").join("my-feature").join("task-badblockedby.json");
        write_task_json(&task_path, serde_json::json!(10), "Update Blocked By", "pending");

        // Try to set blocked_by to a nonexistent task
        let fields = serde_json::json!({
            "blocked_by": [9999]
        });

        let result = update_task_fields(
            task_path.display().to_string(),
            fields,
            None,
        );
        assert!(result.is_err(), "update_task_fields should reject invalid blocked_by");
        let err = result.unwrap_err();
        assert!(err.contains("9999"), "Error should mention the unknown ID: {}", err);
    }
}
