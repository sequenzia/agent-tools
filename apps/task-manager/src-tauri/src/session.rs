use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Known session files that can be read from a live session.
const KNOWN_SESSION_FILES: &[&str] = &[
    "execution_plan.md",
    "progress.md",
    "task_log.md",
    "execution_context.md",
    "session_summary.md",
];

/// Build the `.agents/sessions/__live_session__/` path for a given project.
fn live_session_path(project_path: &str) -> PathBuf {
    Path::new(project_path)
        .join(".agents")
        .join("sessions")
        .join("__live_session__")
}

/// Build the `.agents/sessions/` path for a given project.
#[allow(dead_code)]
fn sessions_dir_path(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".agents").join("sessions")
}

/// Session status representing the lifecycle state.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    /// Active execution — `.lock` file present and session directory exists.
    Active,
    /// Session directory exists but no `.lock` file — interrupted or stale.
    Interrupted,
    /// No `__live_session__` directory found.
    Inactive,
}

/// Information about a live session.
#[derive(Debug, Clone, Serialize)]
pub struct LiveSessionInfo {
    /// Whether a live session directory exists.
    pub exists: bool,
    /// The session status (active, interrupted, inactive).
    pub status: SessionStatus,
    /// Absolute path to the live session directory.
    pub session_path: String,
    /// List of session files that exist in the directory.
    pub available_files: Vec<String>,
    /// The project path this session belongs to.
    pub project_path: String,
}

/// Result of reading a single session file.
#[derive(Debug, Clone, Serialize)]
pub struct SessionFileResult {
    /// The filename that was requested.
    pub filename: String,
    /// The file content, if successfully read.
    pub content: Option<String>,
    /// Error message, if reading failed.
    pub error: Option<String>,
    /// Whether the file exists.
    pub exists: bool,
}

/// Event payload emitted when live session state changes.
#[derive(Debug, Clone, Serialize)]
pub struct SessionChangeEvent {
    /// The new session status.
    pub status: SessionStatus,
    /// The project path this event belongs to.
    pub project_path: String,
    /// Absolute path to the session directory.
    pub session_path: String,
}

/// Check if a `.lock` file exists in the live session directory.
fn has_lock_file(session_path: &Path) -> bool {
    session_path.join(".lock").exists()
}

/// List available session files in the live session directory.
fn list_available_files(session_path: &Path) -> Vec<String> {
    let mut files = Vec::new();

    for filename in KNOWN_SESSION_FILES {
        if session_path.join(filename).is_file() {
            files.push(filename.to_string());
        }
    }

    // Also check for result files (result-*.md pattern).
    if let Ok(entries) = std::fs::read_dir(session_path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("result-") && name.ends_with(".md") {
                files.push(name);
            }
        }
    }

    files
}

/// Check if a live session exists and return its status.
///
/// Inspects `.agents/sessions/__live_session__/` for the given project:
/// - If the directory does not exist → `Inactive`
/// - If the directory exists with a `.lock` file → `Active`
/// - If the directory exists without a `.lock` file → `Interrupted`
#[tauri::command]
pub fn check_live_session(project_path: String) -> Result<LiveSessionInfo, String> {
    let session_path = live_session_path(&project_path);

    if !session_path.exists() || !session_path.is_dir() {
        return Ok(LiveSessionInfo {
            exists: false,
            status: SessionStatus::Inactive,
            session_path: session_path.display().to_string(),
            available_files: Vec::new(),
            project_path,
        });
    }

    // Check read permission.
    std::fs::read_dir(&session_path)
        .map_err(|e| format!("Permission denied on session directory: {}", e))?;

    let has_lock = has_lock_file(&session_path);
    let status = if has_lock {
        SessionStatus::Active
    } else {
        SessionStatus::Interrupted
    };

    let available_files = list_available_files(&session_path);

    Ok(LiveSessionInfo {
        exists: true,
        status,
        session_path: session_path.display().to_string(),
        available_files,
        project_path,
    })
}

/// Read a specific file from the live session directory.
///
/// Supports reading any markdown file from `.agents/sessions/__live_session__/`.
/// The filename must be a simple name (no path separators) for security.
#[tauri::command]
pub fn read_session_file(
    project_path: String,
    filename: String,
) -> Result<SessionFileResult, String> {
    // Security: reject filenames with path separators.
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(format!("Invalid filename: {}", filename));
    }

    let session_path = live_session_path(&project_path);
    let file_path = session_path.join(&filename);

    if !file_path.exists() {
        return Ok(SessionFileResult {
            filename,
            content: None,
            error: None,
            exists: false,
        });
    }

    match std::fs::read_to_string(&file_path) {
        Ok(content) => Ok(SessionFileResult {
            filename,
            content: Some(content),
            error: None,
            exists: true,
        }),
        Err(e) => Ok(SessionFileResult {
            filename,
            content: None,
            error: Some(format!("Failed to read file: {}", e)),
            exists: true,
        }),
    }
}

/// Information about an archived (completed) session.
#[derive(Debug, Clone, Serialize)]
pub struct ArchivedSessionInfo {
    /// The directory name (e.g., "exec-session-20260405-120000").
    pub name: String,
    /// Absolute path to the archived session directory.
    pub path: String,
    /// List of session files that exist in the directory.
    pub available_files: Vec<String>,
    /// Whether session_summary.md exists.
    pub has_summary: bool,
    /// Directory modification time as milliseconds since epoch.
    pub mtime_ms: u64,
    /// Outcome summary parsed from session_summary.md (if available).
    pub summary: Option<SessionSummary>,
    /// Whether any error occurred reading this session.
    pub error: Option<String>,
}

/// Parsed summary statistics from a session's session_summary.md.
#[derive(Debug, Clone, Serialize)]
pub struct SessionSummary {
    /// Number of tasks that passed.
    pub tasks_passed: u32,
    /// Number of tasks that failed.
    pub tasks_failed: u32,
    /// Total number of tasks.
    pub tasks_total: u32,
    /// Raw summary text (first few lines).
    pub headline: String,
}

/// Parse session_summary.md for basic statistics.
/// Looks for patterns like "X passed", "X failed", "X total" or "X/Y tasks".
fn parse_session_summary(content: &str) -> SessionSummary {
    let mut tasks_passed: u32 = 0;
    let mut tasks_failed: u32 = 0;
    let mut tasks_total: u32 = 0;

    // Extract headline: first non-empty, non-heading-marker lines
    let headline: String = content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .take(3)
        .collect::<Vec<&str>>()
        .join("\n");

    for line in content.lines() {
        let lower = line.to_lowercase();

        // Match patterns like "passed: 5" or "5 passed"
        if lower.contains("passed") || lower.contains("pass") {
            if let Some(n) = extract_number_near_keyword(&lower, &["passed", "pass"]) {
                tasks_passed = n;
            }
        }
        if lower.contains("failed") || lower.contains("fail") {
            if let Some(n) = extract_number_near_keyword(&lower, &["failed", "fail"]) {
                tasks_failed = n;
            }
        }
        if lower.contains("total") {
            if let Some(n) = extract_number_near_keyword(&lower, &["total"]) {
                tasks_total = n;
            }
        }
    }

    // Infer total if not explicitly found
    if tasks_total == 0 && (tasks_passed > 0 || tasks_failed > 0) {
        tasks_total = tasks_passed + tasks_failed;
    }

    SessionSummary {
        tasks_passed,
        tasks_failed,
        tasks_total,
        headline,
    }
}

/// Extract a number that appears near one of the given keywords in a line.
fn extract_number_near_keyword(line: &str, keywords: &[&str]) -> Option<u32> {
    for keyword in keywords {
        if let Some(pos) = line.find(keyword) {
            // Look for number before the keyword (e.g., "5 passed")
            let before = &line[..pos];
            if let Some(n) = extract_last_number(before) {
                return Some(n);
            }
            // Look for number after the keyword (e.g., "passed: 5")
            let after = &line[pos + keyword.len()..];
            if let Some(n) = extract_first_number(after) {
                return Some(n);
            }
        }
    }
    None
}

/// Extract the last number from a string.
fn extract_last_number(s: &str) -> Option<u32> {
    let mut result = None;
    let mut current = String::new();
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            current.push(ch);
        } else {
            if !current.is_empty() {
                result = current.parse().ok();
                current.clear();
            }
        }
    }
    if !current.is_empty() {
        result = current.parse().ok();
    }
    result
}

/// Extract the first number from a string.
fn extract_first_number(s: &str) -> Option<u32> {
    let mut current = String::new();
    let mut started = false;
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            current.push(ch);
            started = true;
        } else if started {
            break;
        }
    }
    if !current.is_empty() {
        current.parse().ok()
    } else {
        None
    }
}

/// Get the modification time of a path as milliseconds since epoch.
fn get_mtime_ms(path: &Path) -> u64 {
    path.metadata()
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Build an ArchivedSessionInfo for a single session directory.
fn build_archived_session_info(sessions_dir: &Path, dir_name: &str) -> ArchivedSessionInfo {
    let session_path = sessions_dir.join(dir_name);
    let available_files = list_available_files(&session_path);
    let has_summary = available_files.contains(&"session_summary.md".to_string());
    let mtime_ms = get_mtime_ms(&session_path);

    let summary = if has_summary {
        let summary_path = session_path.join("session_summary.md");
        match std::fs::read_to_string(&summary_path) {
            Ok(content) => Some(parse_session_summary(&content)),
            Err(e) => {
                return ArchivedSessionInfo {
                    name: dir_name.to_string(),
                    path: session_path.display().to_string(),
                    available_files,
                    has_summary: true,
                    mtime_ms,
                    summary: None,
                    error: Some(format!("Failed to read session_summary.md: {}", e)),
                };
            }
        }
    } else {
        None
    };

    ArchivedSessionInfo {
        name: dir_name.to_string(),
        path: session_path.display().to_string(),
        available_files,
        has_summary,
        mtime_ms,
        summary,
        error: None,
    }
}

/// List all archived sessions with their info, sorted by most recent first.
///
/// Reads `.agents/sessions/` and returns info for each timestamped directory
/// (excluding `__live_session__`).
#[tauri::command]
pub fn list_archived_sessions_cmd(project_path: String) -> Result<Vec<ArchivedSessionInfo>, String> {
    let sessions_dir = sessions_dir_path(&project_path);

    if !sessions_dir.exists() || !sessions_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut sessions: Vec<ArchivedSessionInfo> = Vec::new();

    let entries = std::fs::read_dir(&sessions_dir)
        .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

    for entry in entries.flatten() {
        if let Ok(ft) = entry.file_type() {
            if ft.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name != "__live_session__" {
                    sessions.push(build_archived_session_info(&sessions_dir, &name));
                }
            }
        }
    }

    // Sort by most recent first (highest mtime_ms first)
    sessions.sort_by(|a, b| b.mtime_ms.cmp(&a.mtime_ms));

    Ok(sessions)
}

/// Read a specific file from an archived session directory.
///
/// The session_name must be a simple directory name (no path separators) for security.
/// The filename must also be a simple name (no path separators).
#[tauri::command]
pub fn read_archived_session_file(
    project_path: String,
    session_name: String,
    filename: String,
) -> Result<SessionFileResult, String> {
    // Security: reject names with path separators
    for name in [&session_name, &filename] {
        if name.contains('/') || name.contains('\\') || name.contains("..") {
            return Err(format!("Invalid name: {}", name));
        }
    }

    // Reject __live_session__ access through this command
    if session_name == "__live_session__" {
        return Err("Use read_session_file for live session access".to_string());
    }

    let session_path = sessions_dir_path(&project_path).join(&session_name);

    if !session_path.exists() || !session_path.is_dir() {
        return Err(format!("Session directory not found: {}", session_name));
    }

    let file_path = session_path.join(&filename);

    if !file_path.exists() {
        return Ok(SessionFileResult {
            filename,
            content: None,
            error: None,
            exists: false,
        });
    }

    match std::fs::read_to_string(&file_path) {
        Ok(content) => Ok(SessionFileResult {
            filename,
            content: Some(content),
            error: None,
            exists: true,
        }),
        Err(e) => Ok(SessionFileResult {
            filename,
            content: None,
            error: Some(format!("Failed to read file: {}", e)),
            exists: true,
        }),
    }
}

/// Check if the session directory path is suitable for watching.
/// Returns the `.agents/sessions/` path if `.agents/` exists, or None.
#[allow(dead_code)]
pub fn get_sessions_watch_path(project_path: &str) -> Option<PathBuf> {
    let agents_dir = Path::new(project_path).join(".agents");
    if agents_dir.exists() && agents_dir.is_dir() {
        Some(agents_dir.join("sessions"))
    } else {
        None
    }
}

/// List all result files (result-*.md) in the live session directory.
/// Returns a list of filenames sorted alphabetically.
#[tauri::command]
pub fn list_result_files(project_path: String) -> Result<Vec<String>, String> {
    let session_path = live_session_path(&project_path);

    if !session_path.exists() || !session_path.is_dir() {
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(&session_path)
        .map_err(|e| format!("Failed to read session directory: {}", e))?;

    let mut result_files: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("result-") && name.ends_with(".md") {
            result_files.push(name);
        }
    }

    result_files.sort();
    Ok(result_files)
}

/// Determine session status from a path event targeting the sessions directory.
/// This is called by the watcher when changes are detected in `.agents/sessions/`.
pub fn classify_session_event(project_path: &str) -> SessionStatus {
    let session_path = live_session_path(project_path);

    if !session_path.exists() || !session_path.is_dir() {
        return SessionStatus::Inactive;
    }

    if has_lock_file(&session_path) {
        SessionStatus::Active
    } else {
        SessionStatus::Interrupted
    }
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_live_session_path() {
        let path = live_session_path("/home/user/my-project");
        assert_eq!(
            path,
            PathBuf::from("/home/user/my-project/.agents/sessions/__live_session__")
        );
    }

    #[test]
    fn test_sessions_dir_path() {
        let path = sessions_dir_path("/home/user/my-project");
        assert_eq!(
            path,
            PathBuf::from("/home/user/my-project/.agents/sessions")
        );
    }

    #[test]
    fn test_has_lock_file_present() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp.path().join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join(".lock"), "pid:12345").unwrap();

        assert!(has_lock_file(&session_dir));
    }

    #[test]
    fn test_has_lock_file_absent() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp.path().join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        assert!(!has_lock_file(&session_dir));
    }

    #[test]
    fn test_list_available_files_empty_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp.path().join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        let files = list_available_files(&session_dir);
        assert!(files.is_empty());
    }

    #[test]
    fn test_list_available_files_with_known_files() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp.path().join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        fs::write(session_dir.join("progress.md"), "# Progress").unwrap();
        fs::write(session_dir.join("execution_plan.md"), "# Plan").unwrap();
        fs::write(session_dir.join("task_log.md"), "# Log").unwrap();

        let files = list_available_files(&session_dir);
        assert_eq!(files.len(), 3);
        assert!(files.contains(&"progress.md".to_string()));
        assert!(files.contains(&"execution_plan.md".to_string()));
        assert!(files.contains(&"task_log.md".to_string()));
    }

    #[test]
    fn test_list_available_files_with_result_files() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp.path().join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        fs::write(session_dir.join("result-5.md"), "# Result").unwrap();
        fs::write(session_dir.join("result-10.md"), "# Result").unwrap();

        let files = list_available_files(&session_dir);
        assert_eq!(files.len(), 2);
        assert!(files.contains(&"result-5.md".to_string()));
        assert!(files.contains(&"result-10.md".to_string()));
    }

    #[test]
    fn test_list_available_files_ignores_unknown() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp.path().join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        fs::write(session_dir.join("random_file.txt"), "data").unwrap();
        fs::write(session_dir.join("notes.md"), "notes").unwrap();
        fs::write(session_dir.join("progress.md"), "# Progress").unwrap();

        let files = list_available_files(&session_dir);
        assert_eq!(files.len(), 1);
        assert!(files.contains(&"progress.md".to_string()));
    }

    #[test]
    fn test_check_live_session_inactive() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        let result = check_live_session(project_path.clone()).unwrap();
        assert!(!result.exists);
        assert_eq!(result.status, SessionStatus::Inactive);
        assert!(result.available_files.is_empty());
    }

    #[test]
    fn test_check_live_session_active() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join(".lock"), "pid:12345").unwrap();
        fs::write(session_dir.join("progress.md"), "# Progress").unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let result = check_live_session(project_path).unwrap();

        assert!(result.exists);
        assert_eq!(result.status, SessionStatus::Active);
        assert!(result.available_files.contains(&"progress.md".to_string()));
    }

    #[test]
    fn test_check_live_session_interrupted() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join("progress.md"), "# Progress").unwrap();
        // No .lock file — interrupted

        let project_path = tmp.path().to_string_lossy().to_string();
        let result = check_live_session(project_path).unwrap();

        assert!(result.exists);
        assert_eq!(result.status, SessionStatus::Interrupted);
    }

    #[test]
    fn test_read_session_file_success() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join("progress.md"), "Wave 2 of 3").unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let result =
            read_session_file(project_path, "progress.md".to_string()).unwrap();

        assert!(result.exists);
        assert_eq!(result.content.unwrap(), "Wave 2 of 3");
        assert!(result.error.is_none());
    }

    #[test]
    fn test_read_session_file_not_found() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let result =
            read_session_file(project_path, "nonexistent.md".to_string()).unwrap();

        assert!(!result.exists);
        assert!(result.content.is_none());
        assert!(result.error.is_none());
    }

    #[test]
    fn test_read_session_file_rejects_path_traversal() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        let result = read_session_file(project_path.clone(), "../etc/passwd".to_string());
        assert!(result.is_err());

        let result = read_session_file(project_path.clone(), "foo/bar.md".to_string());
        assert!(result.is_err());

        let result = read_session_file(project_path, "foo\\bar.md".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_classify_session_event_inactive() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        let status = classify_session_event(&project_path);
        assert_eq!(status, SessionStatus::Inactive);
    }

    #[test]
    fn test_classify_session_event_active() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(session_dir.join(".lock"), "").unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let status = classify_session_event(&project_path);
        assert_eq!(status, SessionStatus::Active);
    }

    #[test]
    fn test_classify_session_event_interrupted() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let status = classify_session_event(&project_path);
        assert_eq!(status, SessionStatus::Interrupted);
    }

    #[test]
    fn test_list_archived_sessions_cmd_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        let sessions = list_archived_sessions_cmd(project_path).unwrap();
        assert!(sessions.is_empty());
    }

    #[test]
    fn test_list_archived_sessions_cmd_with_archives() {
        let tmp = tempfile::tempdir().unwrap();
        let sessions_dir = tmp.path().join(".agents").join("sessions");
        fs::create_dir_all(&sessions_dir).unwrap();

        fs::create_dir_all(sessions_dir.join("__live_session__")).unwrap();
        fs::create_dir_all(sessions_dir.join("2026-04-06T14-30-00")).unwrap();
        fs::create_dir_all(sessions_dir.join("exec-session-20260405-120000")).unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let sessions = list_archived_sessions_cmd(project_path).unwrap();

        assert_eq!(sessions.len(), 2);
        let names: Vec<&str> = sessions.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"2026-04-06T14-30-00"));
        assert!(names.contains(&"exec-session-20260405-120000"));
        // __live_session__ should be excluded
        assert!(!names.contains(&"__live_session__"));
    }

    #[test]
    fn test_list_archived_sessions_cmd_sorted_by_mtime_desc() {
        let tmp = tempfile::tempdir().unwrap();
        let sessions_dir = tmp.path().join(".agents").join("sessions");
        fs::create_dir_all(&sessions_dir).unwrap();

        fs::create_dir_all(sessions_dir.join("session-old")).unwrap();
        fs::write(sessions_dir.join("session-old").join("progress.md"), "old").unwrap();
        fs::create_dir_all(sessions_dir.join("session-new")).unwrap();
        fs::write(sessions_dir.join("session-new").join("progress.md"), "new").unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let sessions = list_archived_sessions_cmd(project_path).unwrap();

        assert_eq!(sessions.len(), 2);
        // Most recent should be first (session-new was created/modified last)
        assert!(sessions[0].mtime_ms >= sessions[1].mtime_ms);
    }

    #[test]
    fn test_list_archived_sessions_cmd_with_summary() {
        let tmp = tempfile::tempdir().unwrap();
        let sessions_dir = tmp.path().join(".agents").join("sessions");
        let session_dir = sessions_dir.join("exec-session-20260406-140000");
        fs::create_dir_all(&session_dir).unwrap();

        fs::write(
            session_dir.join("session_summary.md"),
            "# Session Summary\n\n- 8 passed\n- 2 failed\n- 10 total\n",
        )
        .unwrap();
        fs::write(session_dir.join("execution_plan.md"), "# Plan").unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let sessions = list_archived_sessions_cmd(project_path).unwrap();

        assert_eq!(sessions.len(), 1);
        let session = &sessions[0];
        assert_eq!(session.name, "exec-session-20260406-140000");
        assert!(session.has_summary);
        assert!(session.error.is_none());

        let summary = session.summary.as_ref().unwrap();
        assert_eq!(summary.tasks_passed, 8);
        assert_eq!(summary.tasks_failed, 2);
        assert_eq!(summary.tasks_total, 10);
    }

    #[test]
    fn test_list_archived_sessions_cmd_without_summary() {
        let tmp = tempfile::tempdir().unwrap();
        let sessions_dir = tmp.path().join(".agents").join("sessions");
        let session_dir = sessions_dir.join("exec-session-20260406-140000");
        fs::create_dir_all(&session_dir).unwrap();

        fs::write(session_dir.join("execution_plan.md"), "# Plan").unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let sessions = list_archived_sessions_cmd(project_path).unwrap();

        assert_eq!(sessions.len(), 1);
        let session = &sessions[0];
        assert!(!session.has_summary);
        assert!(session.summary.is_none());
        assert!(session.error.is_none());
    }

    #[test]
    fn test_parse_session_summary_with_stats() {
        let content = "# Session Summary\n\n- 8 passed\n- 2 failed\n- 10 total tasks\n";
        let summary = parse_session_summary(content);

        assert_eq!(summary.tasks_passed, 8);
        assert_eq!(summary.tasks_failed, 2);
        assert_eq!(summary.tasks_total, 10);
        assert!(!summary.headline.is_empty());
    }

    #[test]
    fn test_parse_session_summary_colon_format() {
        let content = "# Results\n\nPassed: 5\nFailed: 3\nTotal: 8\n";
        let summary = parse_session_summary(content);

        assert_eq!(summary.tasks_passed, 5);
        assert_eq!(summary.tasks_failed, 3);
        assert_eq!(summary.tasks_total, 8);
    }

    #[test]
    fn test_parse_session_summary_infers_total() {
        let content = "# Summary\n\n- 7 passed\n- 1 failed\n";
        let summary = parse_session_summary(content);

        assert_eq!(summary.tasks_passed, 7);
        assert_eq!(summary.tasks_failed, 1);
        assert_eq!(summary.tasks_total, 8);
    }

    #[test]
    fn test_parse_session_summary_empty_content() {
        let summary = parse_session_summary("");
        assert_eq!(summary.tasks_passed, 0);
        assert_eq!(summary.tasks_failed, 0);
        assert_eq!(summary.tasks_total, 0);
    }

    #[test]
    fn test_read_archived_session_file_success() {
        let tmp = tempfile::tempdir().unwrap();
        let sessions_dir = tmp.path().join(".agents").join("sessions");
        let session_dir = sessions_dir.join("exec-session-20260406-140000");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(
            session_dir.join("execution_plan.md"),
            "# Execution Plan\nWave 1: tasks 1,2,3",
        )
        .unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let result = read_archived_session_file(
            project_path,
            "exec-session-20260406-140000".to_string(),
            "execution_plan.md".to_string(),
        )
        .unwrap();

        assert!(result.exists);
        assert_eq!(
            result.content.unwrap(),
            "# Execution Plan\nWave 1: tasks 1,2,3"
        );
        assert!(result.error.is_none());
    }

    #[test]
    fn test_read_archived_session_file_not_found() {
        let tmp = tempfile::tempdir().unwrap();
        let sessions_dir = tmp.path().join(".agents").join("sessions");
        let session_dir = sessions_dir.join("exec-session-20260406-140000");
        fs::create_dir_all(&session_dir).unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let result = read_archived_session_file(
            project_path,
            "exec-session-20260406-140000".to_string(),
            "nonexistent.md".to_string(),
        )
        .unwrap();

        assert!(!result.exists);
        assert!(result.content.is_none());
    }

    #[test]
    fn test_read_archived_session_file_rejects_path_traversal() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        // Path traversal in session name
        let result = read_archived_session_file(
            project_path.clone(),
            "../etc".to_string(),
            "passwd".to_string(),
        );
        assert!(result.is_err());

        // Path traversal in filename
        let result = read_archived_session_file(
            project_path.clone(),
            "session".to_string(),
            "../etc/passwd".to_string(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_read_archived_session_file_rejects_live_session() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        let result = read_archived_session_file(
            project_path,
            "__live_session__".to_string(),
            "progress.md".to_string(),
        );
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Use read_session_file for live session access"));
    }

    #[test]
    fn test_read_archived_session_file_missing_session_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        let result = read_archived_session_file(
            project_path,
            "nonexistent-session".to_string(),
            "progress.md".to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Session directory not found"));
    }

    #[test]
    fn test_get_sessions_watch_path_with_agents_dir() {
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join(".agents")).unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let result = get_sessions_watch_path(&project_path);

        assert!(result.is_some());
        assert_eq!(
            result.unwrap(),
            tmp.path().join(".agents").join("sessions")
        );
    }

    #[test]
    fn test_get_sessions_watch_path_without_agents_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();

        let result = get_sessions_watch_path(&project_path);
        assert!(result.is_none());
    }

    #[test]
    fn test_session_change_event_serialization() {
        let event = SessionChangeEvent {
            status: SessionStatus::Active,
            project_path: "/project".to_string(),
            session_path: "/project/.agents/sessions/__live_session__".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"status\":\"active\""));
        assert!(json.contains("\"project_path\":\"/project\""));
    }

    #[test]
    fn test_live_session_info_serialization() {
        let info = LiveSessionInfo {
            exists: true,
            status: SessionStatus::Active,
            session_path: "/project/.agents/sessions/__live_session__".to_string(),
            available_files: vec!["progress.md".to_string()],
            project_path: "/project".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"exists\":true"));
        assert!(json.contains("\"status\":\"active\""));
        assert!(json.contains("\"progress.md\""));
    }

    #[test]
    fn test_session_status_serialization() {
        let active = serde_json::to_string(&SessionStatus::Active).unwrap();
        assert_eq!(active, "\"active\"");

        let interrupted = serde_json::to_string(&SessionStatus::Interrupted).unwrap();
        assert_eq!(interrupted, "\"interrupted\"");

        let inactive = serde_json::to_string(&SessionStatus::Inactive).unwrap();
        assert_eq!(inactive, "\"inactive\"");
    }

    #[test]
    fn test_list_result_files_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let files = list_result_files(project_path).unwrap();
        assert!(files.is_empty());
    }

    #[test]
    fn test_list_result_files_with_results() {
        let tmp = tempfile::tempdir().unwrap();
        let session_dir = tmp
            .path()
            .join(".agents")
            .join("sessions")
            .join("__live_session__");
        fs::create_dir_all(&session_dir).unwrap();

        fs::write(session_dir.join("result-5.md"), "# Result").unwrap();
        fs::write(session_dir.join("result-10.md"), "# Result").unwrap();
        fs::write(session_dir.join("result-152.md"), "# Result").unwrap();
        // Non-result files should be excluded
        fs::write(session_dir.join("progress.md"), "# Progress").unwrap();
        fs::write(session_dir.join("context-task-5.md"), "# Context").unwrap();

        let project_path = tmp.path().to_string_lossy().to_string();
        let files = list_result_files(project_path).unwrap();
        assert_eq!(files.len(), 3);
        assert_eq!(files[0], "result-10.md");
        assert_eq!(files[1], "result-152.md");
        assert_eq!(files[2], "result-5.md");
    }

    #[test]
    fn test_list_result_files_no_session_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let project_path = tmp.path().to_string_lossy().to_string();
        let files = list_result_files(project_path).unwrap();
        assert!(files.is_empty());
    }
}
