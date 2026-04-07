use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Result of reading a spec file.
#[derive(Debug, Clone, Serialize)]
pub struct SpecContent {
    /// The raw markdown content of the spec file.
    pub content: String,
    /// The resolved absolute path of the spec file.
    pub resolved_path: String,
    /// File size in bytes.
    pub size: u64,
}

/// Result of checking for a spec analysis file.
#[derive(Debug, Clone, Serialize)]
pub struct SpecAnalysisCheck {
    /// Whether the analysis file exists.
    pub exists: bool,
    /// The expected path of the analysis file.
    pub analysis_path: String,
}

/// Resolve a spec path against the project directory.
///
/// If `spec_path` is absolute, it is used as-is.
/// If relative, it is joined to `project_path`.
/// Returns the canonicalized path, or an error if the path contains
/// invalid components or cannot be resolved.
fn resolve_spec_path(project_path: &str, spec_path: &str) -> Result<PathBuf, String> {
    // Reject paths with null bytes
    if spec_path.contains('\0') || project_path.contains('\0') {
        return Err("Path contains invalid null byte characters".to_string());
    }

    let spec = Path::new(spec_path);
    let resolved = if spec.is_absolute() {
        spec.to_path_buf()
    } else {
        Path::new(project_path).join(spec)
    };

    // Normalize the path by resolving `.` and `..` components without requiring
    // the file to exist (canonicalize requires the file to exist).
    // We do a manual normalization pass.
    let mut components = Vec::new();
    for component in resolved.components() {
        match component {
            std::path::Component::ParentDir => {
                if components.is_empty() {
                    return Err(format!(
                        "Invalid path: resolves above filesystem root: {}",
                        spec_path
                    ));
                }
                components.pop();
            }
            std::path::Component::CurDir => {
                // Skip `.` components
            }
            other => {
                components.push(other);
            }
        }
    }

    let normalized: PathBuf = components.iter().collect();
    Ok(normalized)
}

/// Derive the analysis file path from a spec path.
///
/// For `some-SPEC.md`, the analysis file is `some-SPEC.analysis.md`.
fn analysis_path_for(spec_path: &Path) -> PathBuf {
    let stem = spec_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("spec");
    let new_name = format!("{}.analysis.md", stem);
    spec_path.with_file_name(new_name)
}

/// Read a spec markdown file from disk and return its raw content.
///
/// The `spec_path` is resolved relative to `project_path` if it is not absolute.
/// Returns the file content, resolved path, and file size.
#[tauri::command]
pub fn read_spec(project_path: String, spec_path: String) -> Result<SpecContent, String> {
    let resolved = resolve_spec_path(&project_path, &spec_path)?;

    if !resolved.exists() {
        return Err(format!("Spec file not found: {}", resolved.display()));
    }

    if !resolved.is_file() {
        return Err(format!("Path is not a file: {}", resolved.display()));
    }

    let metadata = std::fs::metadata(&resolved)
        .map_err(|e| format!("Permission denied reading spec file {}: {}", resolved.display(), e))?;

    let size = metadata.len();

    let content = std::fs::read_to_string(&resolved)
        .map_err(|e| format!("Failed to read spec file {}: {}", resolved.display(), e))?;

    Ok(SpecContent {
        content,
        resolved_path: resolved.display().to_string(),
        size,
    })
}

/// Check if an analysis file exists alongside the spec file.
///
/// The analysis file is expected at the same location as the spec file
/// but with `.analysis.md` suffix (e.g., `feature-SPEC.analysis.md`).
#[tauri::command]
pub fn check_spec_analysis(
    project_path: String,
    spec_path: String,
) -> Result<SpecAnalysisCheck, String> {
    let resolved = resolve_spec_path(&project_path, &spec_path)?;
    let analysis = analysis_path_for(&resolved);

    Ok(SpecAnalysisCheck {
        exists: analysis.exists() && analysis.is_file(),
        analysis_path: analysis.display().to_string(),
    })
}

/// The stages of the SDD spec lifecycle pipeline.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SpecLifecycleStage {
    Created,
    Analyzed,
    TasksGenerated,
    ExecutionInProgress,
    Complete,
    Unknown,
}

/// Result of checking the spec lifecycle stage.
#[derive(Debug, Clone, Serialize)]
pub struct SpecLifecycleInfo {
    /// The current lifecycle stage.
    pub current_stage: SpecLifecycleStage,
    /// Which stages are completed.
    pub completed_stages: Vec<SpecLifecycleStage>,
    /// Whether the spec was modified after tasks were generated.
    pub spec_modified_after_tasks: bool,
    /// Whether an analysis file exists.
    pub has_analysis: bool,
    /// Total number of tasks found for this spec.
    pub total_tasks: usize,
    /// Number of completed tasks.
    pub completed_tasks: usize,
    /// Whether a live session is active.
    pub has_live_session: bool,
}

/// Get file modification time in milliseconds since epoch.
fn get_mtime_ms(path: &Path) -> Option<u64> {
    path.metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

/// Determine the lifecycle stage of a spec by checking filesystem state.
///
/// Logic:
/// 1. Spec file exists → at least "Created"
/// 2. Analysis file exists → "Analyzed"
/// 3. Tasks exist in `.agents/tasks/` with matching task_group → "Tasks Generated"
/// 4. `__live_session__` with `.lock` exists → "Execution In Progress"
/// 5. All tasks in completed/ → "Complete"
#[tauri::command]
pub fn get_spec_lifecycle(
    project_path: String,
    spec_path: String,
    task_group: Option<String>,
) -> Result<SpecLifecycleInfo, String> {
    let resolved = resolve_spec_path(&project_path, &spec_path)?;

    // Check if spec file exists
    if !resolved.exists() || !resolved.is_file() {
        return Ok(SpecLifecycleInfo {
            current_stage: SpecLifecycleStage::Unknown,
            completed_stages: vec![],
            spec_modified_after_tasks: false,
            has_analysis: false,
            total_tasks: 0,
            completed_tasks: 0,
            has_live_session: false,
        });
    }

    let mut completed_stages = vec![SpecLifecycleStage::Created];

    // Check analysis file
    let analysis = analysis_path_for(&resolved);
    let has_analysis = analysis.exists() && analysis.is_file();
    if has_analysis {
        completed_stages.push(SpecLifecycleStage::Analyzed);
    }

    // Check for tasks with matching task_group
    let tasks_base = Path::new(&project_path).join(".agents").join("tasks");
    let status_dirs = ["backlog", "pending", "in-progress", "completed"];
    let mut total_tasks: usize = 0;
    let mut completed_tasks: usize = 0;
    let mut has_tasks = false;
    let mut latest_task_mtime: u64 = 0;

    // Derive task_group from spec filename if not provided
    let group = task_group.or_else(|| {
        // Convention: spec filename `foo-SPEC.md` → task group `foo`
        // Also try the full stem as a group name
        resolved
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|stem| {
                // Strip -SPEC suffix if present
                if stem.ends_with("-SPEC") {
                    stem[..stem.len() - 5].to_string()
                } else {
                    stem.to_string()
                }
            })
    });

    if let Some(ref group_name) = group {
        for &status_dir in &status_dirs {
            let group_dir = tasks_base.join(status_dir).join(group_name);
            if !group_dir.exists() || !group_dir.is_dir() {
                continue;
            }
            if let Ok(entries) = std::fs::read_dir(&group_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            if name.starts_with("task-") && name.ends_with(".json") {
                                total_tasks += 1;
                                has_tasks = true;
                                if status_dir == "completed" {
                                    completed_tasks += 1;
                                }
                                // Track the latest task file mtime for
                                // spec-modified-after-tasks detection
                                if let Some(mtime) = get_mtime_ms(&path) {
                                    if mtime > latest_task_mtime {
                                        latest_task_mtime = mtime;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if has_tasks {
        completed_stages.push(SpecLifecycleStage::TasksGenerated);
    }

    // Check for live session
    let live_session_path = Path::new(&project_path)
        .join(".agents")
        .join("sessions")
        .join("__live_session__");
    let has_live_session = live_session_path.exists()
        && live_session_path.is_dir()
        && live_session_path.join(".lock").exists();

    // Determine if execution is in progress or complete
    let all_complete = has_tasks && total_tasks > 0 && completed_tasks == total_tasks;

    if all_complete {
        completed_stages.push(SpecLifecycleStage::ExecutionInProgress);
        completed_stages.push(SpecLifecycleStage::Complete);
    } else if has_live_session && has_tasks {
        completed_stages.push(SpecLifecycleStage::ExecutionInProgress);
    }

    // Check if spec was modified after tasks were generated
    let spec_modified_after_tasks = if has_tasks && latest_task_mtime > 0 {
        get_mtime_ms(&resolved)
            .map(|spec_mtime| spec_mtime > latest_task_mtime)
            .unwrap_or(false)
    } else {
        false
    };

    // Current stage is the last completed stage
    let current_stage = completed_stages
        .last()
        .cloned()
        .unwrap_or(SpecLifecycleStage::Created);

    Ok(SpecLifecycleInfo {
        current_stage,
        completed_stages,
        spec_modified_after_tasks,
        has_analysis,
        total_tasks,
        completed_tasks,
        has_live_session,
    })
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_resolve_relative_spec_path() {
        let result = resolve_spec_path("/projects/my-app", "internal/specs/feature-SPEC.md");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert_eq!(
            path,
            PathBuf::from("/projects/my-app/internal/specs/feature-SPEC.md")
        );
    }

    #[test]
    fn test_resolve_absolute_spec_path() {
        let result = resolve_spec_path("/projects/my-app", "/other/path/spec.md");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert_eq!(path, PathBuf::from("/other/path/spec.md"));
    }

    #[test]
    fn test_resolve_spec_path_with_dot_segments() {
        let result = resolve_spec_path("/projects/my-app", "internal/../specs/feature-SPEC.md");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert_eq!(
            path,
            PathBuf::from("/projects/my-app/specs/feature-SPEC.md")
        );
    }

    #[test]
    fn test_resolve_spec_path_with_current_dir() {
        let result = resolve_spec_path("/projects/my-app", "./specs/feature-SPEC.md");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert_eq!(
            path,
            PathBuf::from("/projects/my-app/specs/feature-SPEC.md")
        );
    }

    #[test]
    fn test_resolve_spec_path_rejects_null_bytes() {
        let result = resolve_spec_path("/projects/my-app", "specs/\0bad.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("null byte"));
    }

    #[test]
    fn test_analysis_path_for_standard_spec() {
        let spec = Path::new("/projects/internal/specs/feature-SPEC.md");
        let analysis = analysis_path_for(spec);
        assert_eq!(
            analysis,
            PathBuf::from("/projects/internal/specs/feature-SPEC.analysis.md")
        );
    }

    #[test]
    fn test_analysis_path_for_simple_filename() {
        let spec = Path::new("/projects/my-spec.md");
        let analysis = analysis_path_for(spec);
        assert_eq!(
            analysis,
            PathBuf::from("/projects/my-spec.analysis.md")
        );
    }

    #[test]
    fn test_read_spec_success() {
        let tmp = tempfile::tempdir().unwrap();
        let spec_dir = tmp.path().join("internal").join("specs");
        fs::create_dir_all(&spec_dir).unwrap();

        let spec_file = spec_dir.join("feature-SPEC.md");
        let spec_content = "# Feature Spec\n\nThis is the spec content.\n";
        fs::write(&spec_file, spec_content).unwrap();

        let result = read_spec(
            tmp.path().display().to_string(),
            "internal/specs/feature-SPEC.md".to_string(),
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        let content = result.unwrap();
        assert_eq!(content.content, spec_content);
        assert!(content.resolved_path.contains("feature-SPEC.md"));
        assert_eq!(content.size, spec_content.len() as u64);
    }

    #[test]
    fn test_read_spec_not_found() {
        let tmp = tempfile::tempdir().unwrap();
        let result = read_spec(
            tmp.path().display().to_string(),
            "nonexistent/spec.md".to_string(),
        );
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("not found"),
            "Error should mention 'not found': {}",
            err
        );
    }

    #[test]
    fn test_read_spec_is_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let dir_path = tmp.path().join("specs");
        fs::create_dir_all(&dir_path).unwrap();

        let result = read_spec(
            tmp.path().display().to_string(),
            "specs".to_string(),
        );
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("not a file"),
            "Error should mention 'not a file': {}",
            err
        );
    }

    #[test]
    fn test_read_spec_large_file() {
        let tmp = tempfile::tempdir().unwrap();
        let spec_file = tmp.path().join("large-SPEC.md");

        // Create a file larger than 100KB
        let large_content: String = "x".repeat(150_000);
        fs::write(&spec_file, &large_content).unwrap();

        let result = read_spec(
            tmp.path().display().to_string(),
            "large-SPEC.md".to_string(),
        );
        assert!(result.is_ok(), "Should handle large files: {:?}", result);

        let content = result.unwrap();
        assert_eq!(content.content.len(), 150_000);
        assert!(content.size >= 150_000);
    }

    #[test]
    fn test_check_spec_analysis_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let spec_dir = tmp.path().join("specs");
        fs::create_dir_all(&spec_dir).unwrap();

        // Create both spec and analysis files
        fs::write(spec_dir.join("feature-SPEC.md"), "# Spec").unwrap();
        fs::write(spec_dir.join("feature-SPEC.analysis.md"), "# Analysis").unwrap();

        let result = check_spec_analysis(
            tmp.path().display().to_string(),
            "specs/feature-SPEC.md".to_string(),
        );
        assert!(result.is_ok());

        let check = result.unwrap();
        assert!(check.exists, "Analysis file should be detected as existing");
        assert!(check.analysis_path.contains("feature-SPEC.analysis.md"));
    }

    #[test]
    fn test_check_spec_analysis_not_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let spec_dir = tmp.path().join("specs");
        fs::create_dir_all(&spec_dir).unwrap();

        // Only create the spec file, not the analysis
        fs::write(spec_dir.join("feature-SPEC.md"), "# Spec").unwrap();

        let result = check_spec_analysis(
            tmp.path().display().to_string(),
            "specs/feature-SPEC.md".to_string(),
        );
        assert!(result.is_ok());

        let check = result.unwrap();
        assert!(
            !check.exists,
            "Analysis file should not be detected when missing"
        );
    }

    #[test]
    fn test_check_spec_analysis_with_invalid_path() {
        let result = check_spec_analysis(
            "/some/project".to_string(),
            "specs/\0bad.md".to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("null byte"));
    }

    #[test]
    fn test_resolve_various_relative_formats() {
        // Bare filename
        let r1 = resolve_spec_path("/project", "SPEC.md").unwrap();
        assert_eq!(r1, PathBuf::from("/project/SPEC.md"));

        // Nested path
        let r2 = resolve_spec_path("/project", "a/b/c/SPEC.md").unwrap();
        assert_eq!(r2, PathBuf::from("/project/a/b/c/SPEC.md"));

        // Path with ./
        let r3 = resolve_spec_path("/project", "./a/SPEC.md").unwrap();
        assert_eq!(r3, PathBuf::from("/project/a/SPEC.md"));

        // Path with ../
        let r4 = resolve_spec_path("/project", "a/../b/SPEC.md").unwrap();
        assert_eq!(r4, PathBuf::from("/project/b/SPEC.md"));
    }

    // --- Lifecycle tests ---

    #[test]
    fn test_lifecycle_spec_created_only() {
        let tmp = tempfile::tempdir().unwrap();
        let spec_dir = tmp.path().join("internal").join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("feature-SPEC.md"), "# Feature").unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "internal/specs/feature-SPEC.md".to_string(),
            None,
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.current_stage, SpecLifecycleStage::Created);
        assert_eq!(info.completed_stages, vec![SpecLifecycleStage::Created]);
        assert!(!info.has_analysis);
        assert_eq!(info.total_tasks, 0);
        assert_eq!(info.completed_tasks, 0);
    }

    #[test]
    fn test_lifecycle_spec_analyzed() {
        let tmp = tempfile::tempdir().unwrap();
        let spec_dir = tmp.path().join("internal").join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("feature-SPEC.md"), "# Feature").unwrap();
        fs::write(spec_dir.join("feature-SPEC.analysis.md"), "# Analysis").unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "internal/specs/feature-SPEC.md".to_string(),
            None,
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.current_stage, SpecLifecycleStage::Analyzed);
        assert!(info.has_analysis);
        assert_eq!(
            info.completed_stages,
            vec![SpecLifecycleStage::Created, SpecLifecycleStage::Analyzed]
        );
    }

    #[test]
    fn test_lifecycle_tasks_generated() {
        let tmp = tempfile::tempdir().unwrap();

        // Create spec
        let spec_dir = tmp.path().join("internal").join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("feature-SPEC.md"), "# Feature").unwrap();

        // Create tasks in pending/feature/
        let task_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("pending")
            .join("feature");
        fs::create_dir_all(&task_dir).unwrap();
        fs::write(task_dir.join("task-1.json"), r#"{"id":1}"#).unwrap();
        fs::write(task_dir.join("task-2.json"), r#"{"id":2}"#).unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "internal/specs/feature-SPEC.md".to_string(),
            Some("feature".to_string()),
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.current_stage, SpecLifecycleStage::TasksGenerated);
        assert_eq!(info.total_tasks, 2);
        assert_eq!(info.completed_tasks, 0);
    }

    #[test]
    fn test_lifecycle_execution_in_progress() {
        let tmp = tempfile::tempdir().unwrap();

        // Create spec
        let spec_dir = tmp.path().join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("feature-SPEC.md"), "# Feature").unwrap();

        // Create tasks — some pending, some in-progress
        let pending_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("pending")
            .join("feature");
        fs::create_dir_all(&pending_dir).unwrap();
        fs::write(pending_dir.join("task-1.json"), r#"{"id":1}"#).unwrap();

        let ip_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("in-progress")
            .join("feature");
        fs::create_dir_all(&ip_dir).unwrap();
        fs::write(ip_dir.join("task-2.json"), r#"{"id":2}"#).unwrap();

        // Create live session with lock
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join(".lock"), "pid:123").unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "specs/feature-SPEC.md".to_string(),
            Some("feature".to_string()),
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.current_stage, SpecLifecycleStage::ExecutionInProgress);
        assert!(info.has_live_session);
        assert_eq!(info.total_tasks, 2);
    }

    #[test]
    fn test_lifecycle_complete() {
        let tmp = tempfile::tempdir().unwrap();

        // Create spec
        let spec_dir = tmp.path().join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("feature-SPEC.md"), "# Feature").unwrap();

        // All tasks in completed
        let completed_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("completed")
            .join("feature");
        fs::create_dir_all(&completed_dir).unwrap();
        fs::write(completed_dir.join("task-1.json"), r#"{"id":1}"#).unwrap();
        fs::write(completed_dir.join("task-2.json"), r#"{"id":2}"#).unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "specs/feature-SPEC.md".to_string(),
            Some("feature".to_string()),
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.current_stage, SpecLifecycleStage::Complete);
        assert_eq!(info.total_tasks, 2);
        assert_eq!(info.completed_tasks, 2);
    }

    #[test]
    fn test_lifecycle_unknown_when_spec_missing() {
        let tmp = tempfile::tempdir().unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "nonexistent/spec.md".to_string(),
            None,
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.current_stage, SpecLifecycleStage::Unknown);
    }

    #[test]
    fn test_lifecycle_spec_modified_after_tasks() {
        let tmp = tempfile::tempdir().unwrap();

        // Create tasks first
        let task_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("pending")
            .join("feature");
        fs::create_dir_all(&task_dir).unwrap();
        fs::write(task_dir.join("task-1.json"), r#"{"id":1}"#).unwrap();

        // Small delay to ensure different mtime
        std::thread::sleep(std::time::Duration::from_millis(50));

        // Create spec after tasks (simulates modification after task generation)
        let spec_dir = tmp.path().join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("feature-SPEC.md"), "# Modified Feature").unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "specs/feature-SPEC.md".to_string(),
            Some("feature".to_string()),
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert!(
            info.spec_modified_after_tasks,
            "Should detect spec modified after tasks"
        );
    }

    #[test]
    fn test_lifecycle_derives_task_group_from_spec_name() {
        let tmp = tempfile::tempdir().unwrap();

        // Create spec with -SPEC suffix
        let spec_dir = tmp.path().join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("my-feature-SPEC.md"), "# Feature").unwrap();

        // Create tasks under the derived group name (without -SPEC)
        let task_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("pending")
            .join("my-feature");
        fs::create_dir_all(&task_dir).unwrap();
        fs::write(task_dir.join("task-1.json"), r#"{"id":1}"#).unwrap();

        // Don't pass task_group — should derive from spec name
        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "specs/my-feature-SPEC.md".to_string(),
            None,
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        assert_eq!(info.current_stage, SpecLifecycleStage::TasksGenerated);
        assert_eq!(info.total_tasks, 1);
    }

    #[test]
    fn test_lifecycle_partial_completion() {
        let tmp = tempfile::tempdir().unwrap();

        // Create spec
        let spec_dir = tmp.path().join("specs");
        fs::create_dir_all(&spec_dir).unwrap();
        fs::write(spec_dir.join("feature-SPEC.md"), "# Feature").unwrap();

        // Some tasks completed, some pending
        let completed_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("completed")
            .join("feature");
        fs::create_dir_all(&completed_dir).unwrap();
        fs::write(completed_dir.join("task-1.json"), r#"{"id":1}"#).unwrap();

        let pending_dir = tmp
            .path()
            .join(".agents")
            .join("tasks")
            .join("pending")
            .join("feature");
        fs::create_dir_all(&pending_dir).unwrap();
        fs::write(pending_dir.join("task-2.json"), r#"{"id":2}"#).unwrap();

        let result = get_spec_lifecycle(
            tmp.path().display().to_string(),
            "specs/feature-SPEC.md".to_string(),
            Some("feature".to_string()),
        );
        assert!(result.is_ok());
        let info = result.unwrap();
        // Without live session, should be at TasksGenerated stage
        assert_eq!(info.current_stage, SpecLifecycleStage::TasksGenerated);
        assert_eq!(info.total_tasks, 2);
        assert_eq!(info.completed_tasks, 1);
    }

    #[test]
    fn test_lifecycle_stage_serialization() {
        let stage = SpecLifecycleStage::TasksGenerated;
        let json = serde_json::to_string(&stage).unwrap();
        assert_eq!(json, "\"tasks_generated\"");

        let stage = SpecLifecycleStage::ExecutionInProgress;
        let json = serde_json::to_string(&stage).unwrap();
        assert_eq!(json, "\"execution_in_progress\"");
    }
}
