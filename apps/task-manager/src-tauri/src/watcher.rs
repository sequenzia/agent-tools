use crate::session::{self, SessionChangeEvent};
use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Duration for the debounce window (milliseconds).
const DEBOUNCE_MS: u64 = 100;

/// IPC event name emitted to the frontend for file changes.
const EVENT_FILE_CHANGE: &str = "task-file-change";

/// IPC event name emitted when the watched directory is disconnected.
const EVENT_WATCH_DISCONNECTED: &str = "task-watch-disconnected";

/// IPC event name emitted when a watch error occurs.
const EVENT_WATCH_ERROR: &str = "task-watch-error";

/// IPC event name emitted when session state changes.
const EVENT_SESSION_CHANGE: &str = "session-change";

/// IPC event name emitted when result files appear or change in the live session.
const EVENT_RESULT_FILE_CHANGE: &str = "result-file-change";

/// A result file change event pushed to the frontend when result-*.md files change.
#[derive(Debug, Clone, Serialize)]
pub struct ResultFileChangeEvent {
    /// The filename (e.g., "result-5.md").
    pub filename: String,
    /// The type of change: "create", "modify", or "delete".
    pub kind: String,
    /// The project path this event belongs to.
    pub project_path: String,
}

/// A single file change event pushed to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct FileChangeEvent {
    /// The type of change: "create", "modify", "delete", or "unknown".
    pub kind: String,
    /// Absolute path of the changed file.
    pub path: String,
    /// The project path this event belongs to.
    pub project_path: String,
}

/// A batch of file change events (debounced).
#[derive(Debug, Clone, Serialize)]
pub struct FileChangeBatch {
    pub events: Vec<FileChangeEvent>,
    pub project_path: String,
}

/// Error event payload.
#[derive(Debug, Clone, Serialize)]
pub struct WatchErrorEvent {
    pub message: String,
    pub project_path: String,
}

/// Disconnection event payload.
#[derive(Debug, Clone, Serialize)]
pub struct WatchDisconnectedEvent {
    pub message: String,
    pub project_path: String,
}

/// State managed by Tauri to track the shared watcher and active project paths.
///
/// A single notify watcher instance is shared across all watched project paths
/// for efficient resource usage. Each project path is added to or removed from
/// the same underlying OS watcher via commands sent to the watcher thread.
/// Session watching uses a separate shared watcher thread for isolation.
pub struct WatcherState {
    /// The set of project paths currently being watched.
    watched_projects: Mutex<HashSet<String>>,
    /// A sender to communicate commands to the shared task watcher thread.
    command_tx: Mutex<Option<std::sync::mpsc::Sender<WatcherCommand>>>,
    /// A sender to signal the shared task watcher thread to stop.
    stop_tx: Mutex<Option<std::sync::mpsc::Sender<()>>>,
    /// A sender to communicate commands to the shared session watcher thread.
    session_command_tx: Mutex<Option<std::sync::mpsc::Sender<WatcherCommand>>>,
    /// A sender to signal the shared session watcher thread to stop.
    session_stop_tx: Mutex<Option<std::sync::mpsc::Sender<()>>>,
}

/// Commands sent to the shared watcher threads.
enum WatcherCommand {
    AddPath(String),
    RemovePath(String),
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            watched_projects: Mutex::new(HashSet::new()),
            command_tx: Mutex::new(None),
            stop_tx: Mutex::new(None),
            session_command_tx: Mutex::new(None),
            session_stop_tx: Mutex::new(None),
        }
    }
}

/// Build the `.agents/tasks/` path for a given project.
fn tasks_watch_path(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".agents").join("tasks")
}

/// Build the `.agents/sessions/` path for a given project.
fn sessions_watch_path(project_path: &str) -> PathBuf {
    Path::new(project_path).join(".agents").join("sessions")
}

/// Check if a path is a .json file within the tasks directory structure.
fn is_task_json_file(path: &Path) -> bool {
    matches!(path.extension().and_then(|e| e.to_str()), Some("json"))
}

/// Check if a path is within the sessions directory (contains `sessions/__live_session__`).
fn is_session_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    path_str.contains("__live_session__")
}

/// Check if a path is a result file within `__live_session__/` (result-*.md pattern).
fn is_result_file(path: &Path) -> Option<String> {
    if !is_session_path(path) {
        return None;
    }
    let filename = path.file_name()?.to_str()?;
    if filename.starts_with("result-") && filename.ends_with(".md") {
        Some(filename.to_string())
    } else {
        None
    }
}

/// Classify a debounced event kind into a human-readable string.
/// The debouncer-mini only provides `Any` and `AnyContinuous` -- it merges
/// create/modify/delete into generic "something changed" events.
/// We inspect whether the file exists afterward to infer create vs delete.
fn classify_event(path: &Path) -> String {
    if path.exists() {
        "modify".to_string()
    } else {
        "delete".to_string()
    }
}

/// Resolve a file path to its owning project path from the watched set.
/// Checks both `.agents/tasks/` and `.agents/sessions/` directories.
#[cfg(test)]
fn resolve_project_path(file_path: &Path, watched: &HashSet<String>) -> Option<String> {
    for project in watched {
        let tasks_dir = tasks_watch_path(project);
        let sessions_dir = sessions_watch_path(project);
        if file_path.starts_with(&tasks_dir) || file_path.starts_with(&sessions_dir) {
            return Some(project.clone());
        }
    }
    None
}

/// Resolve a file path to its owning project path, checking only task directories.
fn resolve_task_project_path(file_path: &Path, watched: &HashSet<String>) -> Option<String> {
    for project in watched {
        let tasks_dir = tasks_watch_path(project);
        if file_path.starts_with(&tasks_dir) {
            return Some(project.clone());
        }
    }
    None
}

/// Resolve a file path to its owning project path, checking only session directories.
fn resolve_session_project_path(file_path: &Path, watched: &HashSet<String>) -> Option<String> {
    for project in watched {
        let sessions_dir = sessions_watch_path(project);
        if file_path.starts_with(&sessions_dir) {
            return Some(project.clone());
        }
    }
    None
}

/// Validate that a project path has a watchable tasks directory.
fn validate_watch_path(project_path: &str) -> Result<PathBuf, String> {
    let watch_path = tasks_watch_path(project_path);

    if !watch_path.exists() {
        return Err(format!(
            "Tasks directory does not exist: {}",
            watch_path.display()
        ));
    }

    if !watch_path.is_dir() {
        return Err(format!(
            "Tasks path is not a directory: {}",
            watch_path.display()
        ));
    }

    std::fs::read_dir(&watch_path)
        .map_err(|e| format!("Permission denied on tasks directory: {}", e))?;

    Ok(watch_path)
}

/// Ensure the shared task watcher thread is running, starting it if needed.
fn ensure_task_watcher_thread(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut stop_tx_guard = state
        .stop_tx
        .lock()
        .map_err(|e| format!("Failed to acquire stop_tx lock: {}", e))?;

    if stop_tx_guard.is_some() {
        return Ok(());
    }

    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<WatcherCommand>();

    let app_handle = app.clone();

    std::thread::spawn(move || {
        let (event_tx, event_rx) = std::sync::mpsc::channel();

        let debouncer = new_debouncer(Duration::from_millis(DEBOUNCE_MS), event_tx);

        let mut debouncer = match debouncer {
            Ok(d) => d,
            Err(e) => {
                let _ = app_handle.emit(
                    EVENT_WATCH_ERROR,
                    WatchErrorEvent {
                        message: format!("Failed to create file watcher: {}", e),
                        project_path: String::new(),
                    },
                );
                return;
            }
        };

        let mut active_paths: HashSet<String> = HashSet::new();

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            while let Ok(cmd) = cmd_rx.try_recv() {
                match cmd {
                    WatcherCommand::AddPath(project_path) => {
                        let watch_path = tasks_watch_path(&project_path);
                        if let Err(e) = debouncer
                            .watcher()
                            .watch(&watch_path, RecursiveMode::Recursive)
                        {
                            let _ = app_handle.emit(
                                EVENT_WATCH_ERROR,
                                WatchErrorEvent {
                                    message: format!("Failed to start watching: {}", e),
                                    project_path: project_path.clone(),
                                },
                            );
                        } else {
                            active_paths.insert(project_path);
                        }
                    }
                    WatcherCommand::RemovePath(project_path) => {
                        let watch_path = tasks_watch_path(&project_path);
                        let _ = debouncer.watcher().unwatch(&watch_path);
                        active_paths.remove(&project_path);
                    }
                }
            }

            match event_rx.recv_timeout(Duration::from_millis(500)) {
                Ok(Ok(events)) => {
                    let mut batches: std::collections::HashMap<String, Vec<FileChangeEvent>> =
                        std::collections::HashMap::new();

                    for event in events {
                        let path = &event.path;

                        if !is_task_json_file(path) {
                            continue;
                        }

                        let kind = classify_event(path);

                        if let Some(project_path) =
                            resolve_task_project_path(path, &active_paths)
                        {
                            batches
                                .entry(project_path.clone())
                                .or_default()
                                .push(FileChangeEvent {
                                    kind,
                                    path: path.display().to_string(),
                                    project_path,
                                });
                        }
                    }

                    for (project_path, events) in batches {
                        let _ = app_handle.emit(
                            EVENT_FILE_CHANGE,
                            FileChangeBatch {
                                events,
                                project_path,
                            },
                        );
                    }
                }
                Ok(Err(errors)) => {
                    let error_msg = format!("{}", errors);

                    let mut disconnected: Vec<String> = Vec::new();
                    for project_path in &active_paths {
                        let watch_path = tasks_watch_path(project_path);
                        if !watch_path.exists() {
                            disconnected.push(project_path.clone());
                            let _ = app_handle.emit(
                                EVENT_WATCH_DISCONNECTED,
                                WatchDisconnectedEvent {
                                    message: format!(
                                        "Watched directory removed: {}",
                                        watch_path.display()
                                    ),
                                    project_path: project_path.clone(),
                                },
                            );
                        }
                    }

                    for path in &disconnected {
                        let watch_path = tasks_watch_path(path);
                        let _ = debouncer.watcher().unwatch(&watch_path);
                        active_paths.remove(path);
                    }

                    if disconnected.is_empty() {
                        let _ = app_handle.emit(
                            EVENT_WATCH_ERROR,
                            WatchErrorEvent {
                                message: error_msg,
                                project_path: String::new(),
                            },
                        );
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    let mut disconnected: Vec<String> = Vec::new();
                    for project_path in &active_paths {
                        let watch_path = tasks_watch_path(project_path);
                        if !watch_path.exists() {
                            disconnected.push(project_path.clone());
                            let _ = app_handle.emit(
                                EVENT_WATCH_DISCONNECTED,
                                WatchDisconnectedEvent {
                                    message: format!(
                                        "Watched directory removed: {}",
                                        watch_path.display()
                                    ),
                                    project_path: project_path.clone(),
                                },
                            );
                        }
                    }
                    for path in &disconnected {
                        let watch_path = tasks_watch_path(path);
                        let _ = debouncer.watcher().unwatch(&watch_path);
                        active_paths.remove(path);
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    let _ = app_handle.emit(
                        EVENT_WATCH_ERROR,
                        WatchErrorEvent {
                            message: "File watcher channel disconnected".to_string(),
                            project_path: String::new(),
                        },
                    );
                    return;
                }
            }
        }

        drop(debouncer);
    });

    *stop_tx_guard = Some(stop_tx);

    let mut cmd_tx_guard = state
        .command_tx
        .lock()
        .map_err(|e| format!("Failed to acquire command_tx lock: {}", e))?;
    *cmd_tx_guard = Some(cmd_tx);

    Ok(())
}

/// Ensure the shared session watcher thread is running, starting it if needed.
fn ensure_session_watcher_thread(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut stop_tx_guard = state
        .session_stop_tx
        .lock()
        .map_err(|e| format!("Failed to acquire session_stop_tx lock: {}", e))?;

    if stop_tx_guard.is_some() {
        return Ok(());
    }

    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<WatcherCommand>();

    let app_handle = app.clone();

    std::thread::spawn(move || {
        let (event_tx, event_rx) = std::sync::mpsc::channel();

        let debouncer = new_debouncer(Duration::from_millis(DEBOUNCE_MS), event_tx);

        let mut debouncer = match debouncer {
            Ok(d) => d,
            Err(_) => return, // Silently fail -- session watching is supplementary.
        };

        let mut active_paths: HashSet<String> = HashSet::new();
        // Track per-project session status to avoid duplicate events.
        let mut last_statuses: std::collections::HashMap<String, session::SessionStatus> =
            std::collections::HashMap::new();

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            while let Ok(cmd) = cmd_rx.try_recv() {
                match cmd {
                    WatcherCommand::AddPath(project_path) => {
                        let sessions_path = sessions_watch_path(&project_path);

                        // Ensure sessions directory exists before watching.
                        if !sessions_path.exists() {
                            let _ = std::fs::create_dir_all(&sessions_path);
                        }

                        if let Err(_) = debouncer
                            .watcher()
                            .watch(&sessions_path, RecursiveMode::Recursive)
                        {
                            // Silently fail -- session watching is supplementary.
                        } else {
                            // Emit initial session status so frontend knows the current state.
                            let initial_status =
                                session::classify_session_event(&project_path);
                            let live_session = Path::new(&project_path)
                                .join(".agents")
                                .join("sessions")
                                .join("__live_session__");
                            let _ = app_handle.emit(
                                EVENT_SESSION_CHANGE,
                                SessionChangeEvent {
                                    status: initial_status.clone(),
                                    project_path: project_path.clone(),
                                    session_path: live_session.display().to_string(),
                                },
                            );
                            last_statuses
                                .insert(project_path.clone(), initial_status);
                            active_paths.insert(project_path);
                        }
                    }
                    WatcherCommand::RemovePath(project_path) => {
                        let sessions_path = sessions_watch_path(&project_path);
                        let _ = debouncer.watcher().unwatch(&sessions_path);
                        active_paths.remove(&project_path);
                        last_statuses.remove(&project_path);
                    }
                }
            }

            match event_rx.recv_timeout(Duration::from_millis(500)) {
                Ok(Ok(events)) => {
                    // Determine which projects had session-relevant events.
                    let mut affected_projects: HashSet<String> = HashSet::new();
                    // Track result file changes per project.
                    let mut result_file_events: Vec<(String, String, String)> = Vec::new();

                    for event in &events {
                        let path = &event.path;
                        if is_session_path(path)
                            || path.to_string_lossy().contains("sessions")
                        {
                            if let Some(project_path) =
                                resolve_session_project_path(path, &active_paths)
                            {
                                affected_projects.insert(project_path.clone());

                                // Check if this is a result file change.
                                if let Some(filename) = is_result_file(path) {
                                    let kind = classify_event(path);
                                    result_file_events.push((
                                        filename,
                                        kind,
                                        project_path,
                                    ));
                                }
                            }
                        }
                    }

                    // Emit result file change events.
                    for (filename, kind, project_path) in result_file_events {
                        let _ = app_handle.emit(
                            EVENT_RESULT_FILE_CHANGE,
                            ResultFileChangeEvent {
                                filename,
                                kind,
                                project_path,
                            },
                        );
                    }

                    for project_path in affected_projects {
                        let current_status =
                            session::classify_session_event(&project_path);
                        let last = last_statuses.get(&project_path);

                        if last.map_or(true, |l| *l != current_status) {
                            let live_session = Path::new(&project_path)
                                .join(".agents")
                                .join("sessions")
                                .join("__live_session__");
                            let _ = app_handle.emit(
                                EVENT_SESSION_CHANGE,
                                SessionChangeEvent {
                                    status: current_status.clone(),
                                    project_path: project_path.clone(),
                                    session_path: live_session.display().to_string(),
                                },
                            );
                            last_statuses
                                .insert(project_path, current_status);
                        }
                    }
                }
                Ok(Err(_)) => {
                    // Watch errors -- check for disconnected session dirs.
                    let mut disconnected: Vec<String> = Vec::new();
                    for project_path in &active_paths {
                        let sessions_path = sessions_watch_path(project_path);
                        if !sessions_path.exists() {
                            disconnected.push(project_path.clone());
                        }
                    }
                    for path in &disconnected {
                        let sessions_path = sessions_watch_path(path);
                        let _ = debouncer.watcher().unwatch(&sessions_path);
                        active_paths.remove(path);
                        last_statuses.remove(path);
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Periodically recheck session status for all active projects.
                    for project_path in &active_paths {
                        let current_status =
                            session::classify_session_event(project_path);
                        let last = last_statuses.get(project_path);

                        if last.map_or(true, |l| *l != current_status) {
                            let live_session = Path::new(project_path)
                                .join(".agents")
                                .join("sessions")
                                .join("__live_session__");
                            let _ = app_handle.emit(
                                EVENT_SESSION_CHANGE,
                                SessionChangeEvent {
                                    status: current_status.clone(),
                                    project_path: project_path.clone(),
                                    session_path: live_session.display().to_string(),
                                },
                            );
                            last_statuses
                                .insert(project_path.clone(), current_status);
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    return;
                }
            }
        }

        drop(debouncer);
    });

    *stop_tx_guard = Some(stop_tx);

    let mut cmd_tx_guard = state
        .session_command_tx
        .lock()
        .map_err(|e| format!("Failed to acquire session_command_tx lock: {}", e))?;
    *cmd_tx_guard = Some(cmd_tx);

    Ok(())
}

/// Start watching `.agents/tasks/` and `.agents/sessions/` for one or more project
/// paths simultaneously. Accepts multiple project paths; each project's file events
/// include the source project path in their payload for correct frontend routing.
/// Shares a single notify watcher instance across all watched paths.
///
/// If some paths fail validation, successfully validated paths are still watched.
/// Returns an error only if all paths fail.
#[tauri::command]
pub fn start_watching(app: AppHandle, project_paths: Vec<String>) -> Result<(), String> {
    let mut errors: Vec<String> = Vec::new();

    for project_path in &project_paths {
        match add_watch_inner(&app, project_path) {
            Ok(()) => {}
            Err(e) => {
                errors.push(format!("{}: {}", project_path, e));
            }
        }
    }

    if !errors.is_empty() && errors.len() == project_paths.len() {
        return Err(format!("Failed to watch all paths: {}", errors.join("; ")));
    }

    Ok(())
}

/// Stop watching all project paths and shut down the shared watcher threads.
#[tauri::command]
pub fn stop_watching(app: AppHandle) -> Result<(), String> {
    let state = app.state::<WatcherState>();

    // Signal the task watcher thread to stop.
    {
        let mut stop_tx_guard = state
            .stop_tx
            .lock()
            .map_err(|e| format!("Failed to acquire stop_tx lock: {}", e))?;
        if let Some(tx) = stop_tx_guard.take() {
            let _ = tx.send(());
        }
    }

    // Signal the session watcher thread to stop.
    {
        let mut stop_tx_guard = state
            .session_stop_tx
            .lock()
            .map_err(|e| format!("Failed to acquire session_stop_tx lock: {}", e))?;
        if let Some(tx) = stop_tx_guard.take() {
            let _ = tx.send(());
        }
    }

    // Clear the command channels.
    {
        let mut cmd_tx_guard = state
            .command_tx
            .lock()
            .map_err(|e| format!("Failed to acquire command_tx lock: {}", e))?;
        *cmd_tx_guard = None;
    }
    {
        let mut cmd_tx_guard = state
            .session_command_tx
            .lock()
            .map_err(|e| format!("Failed to acquire session_command_tx lock: {}", e))?;
        *cmd_tx_guard = None;
    }

    // Clear the watched set.
    let mut watched = state
        .watched_projects
        .lock()
        .map_err(|e| format!("Failed to acquire watched_projects lock: {}", e))?;
    watched.clear();

    Ok(())
}

/// Inner implementation for adding a single watch (tasks + sessions).
fn add_watch_inner(app: &AppHandle, project_path: &str) -> Result<(), String> {
    let state = app.state::<WatcherState>();

    // Check if already watching this project (no-op).
    {
        let watched = state
            .watched_projects
            .lock()
            .map_err(|e| format!("Failed to acquire watched_projects lock: {}", e))?;
        if watched.contains(project_path) {
            return Ok(());
        }
    }

    // Validate the task path before trying to watch.
    validate_watch_path(project_path)?;

    // Ensure the shared task watcher thread is running.
    ensure_task_watcher_thread(app)?;

    // Send the add command to the task watcher thread.
    {
        let cmd_tx_guard = state
            .command_tx
            .lock()
            .map_err(|e| format!("Failed to acquire command_tx lock: {}", e))?;
        if let Some(tx) = cmd_tx_guard.as_ref() {
            tx.send(WatcherCommand::AddPath(project_path.to_string()))
                .map_err(|e| format!("Failed to send add command: {}", e))?;
        } else {
            return Err("Watcher thread not running".to_string());
        }
    }

    // Start session watching if `.agents/` directory exists.
    let agents_dir = Path::new(project_path).join(".agents");
    if agents_dir.exists() && agents_dir.is_dir() {
        // Ensure session watcher thread is running.
        if ensure_session_watcher_thread(app).is_ok() {
            let cmd_tx_guard = state
                .session_command_tx
                .lock()
                .map_err(|e| format!("Failed to acquire session_command_tx lock: {}", e))?;
            if let Some(tx) = cmd_tx_guard.as_ref() {
                let _ = tx.send(WatcherCommand::AddPath(project_path.to_string()));
            }
        }
    }

    // Track in the watched set.
    {
        let mut watched = state
            .watched_projects
            .lock()
            .map_err(|e| format!("Failed to acquire watched_projects lock: {}", e))?;
        watched.insert(project_path.to_string());
    }

    Ok(())
}

/// Add a project directory to the watch set dynamically.
/// If the project is already being watched, this is a no-op (no error).
/// Shares the single notify watcher instance with other watched paths.
#[tauri::command]
pub fn add_watch(app: AppHandle, project_path: String) -> Result<(), String> {
    add_watch_inner(&app, &project_path)
}

/// Remove a project directory from the watch set dynamically.
/// If the project is not currently being watched, this is a no-op (no error).
/// Frees resources associated with the project's watch.
#[tauri::command]
pub fn remove_watch(app: AppHandle, project_path: String) -> Result<(), String> {
    let state = app.state::<WatcherState>();

    // Check if this project is being watched (no-op if not).
    {
        let watched = state
            .watched_projects
            .lock()
            .map_err(|e| format!("Failed to acquire watched_projects lock: {}", e))?;
        if !watched.contains(&project_path) {
            return Ok(());
        }
    }

    // Send the remove command to the task watcher thread.
    {
        let cmd_tx_guard = state
            .command_tx
            .lock()
            .map_err(|e| format!("Failed to acquire command_tx lock: {}", e))?;
        if let Some(tx) = cmd_tx_guard.as_ref() {
            let _ = tx.send(WatcherCommand::RemovePath(project_path.clone()));
        }
    }

    // Send the remove command to the session watcher thread.
    {
        let cmd_tx_guard = state
            .session_command_tx
            .lock()
            .map_err(|e| format!("Failed to acquire session_command_tx lock: {}", e))?;
        if let Some(tx) = cmd_tx_guard.as_ref() {
            let _ = tx.send(WatcherCommand::RemovePath(project_path.clone()));
        }
    }

    // Remove from the watched set.
    {
        let mut watched = state
            .watched_projects
            .lock()
            .map_err(|e| format!("Failed to acquire watched_projects lock: {}", e))?;
        watched.remove(&project_path);
    }

    Ok(())
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_is_task_json_file() {
        assert!(is_task_json_file(Path::new("/foo/bar/task-001.json")));
        assert!(is_task_json_file(Path::new("/foo/bar/task-099.json")));
        assert!(is_task_json_file(Path::new("/foo/bar/any-file.json")));
        assert!(!is_task_json_file(Path::new("/foo/bar/.DS_Store")));
        assert!(!is_task_json_file(Path::new("/foo/bar/readme.md")));
        assert!(!is_task_json_file(Path::new("/foo/bar/config.toml")));
        assert!(!is_task_json_file(Path::new("/foo/bar/notes.txt")));
        assert!(!is_task_json_file(Path::new("/foo/bar/no-extension")));
    }

    #[test]
    fn test_classify_event_existing_file() {
        let tmp = tempfile::tempdir().unwrap();
        let file_path = tmp.path().join("task-001.json");
        fs::write(&file_path, "{}").unwrap();

        let kind = classify_event(&file_path);
        assert_eq!(kind, "modify");
    }

    #[test]
    fn test_classify_event_deleted_file() {
        let kind = classify_event(Path::new("/nonexistent/task-001.json"));
        assert_eq!(kind, "delete");
    }

    #[test]
    fn test_tasks_watch_path() {
        let path = tasks_watch_path("/home/user/my-project");
        assert_eq!(
            path,
            PathBuf::from("/home/user/my-project/.agents/tasks")
        );
    }

    #[test]
    fn test_sessions_watch_path() {
        let path = sessions_watch_path("/home/user/my-project");
        assert_eq!(
            path,
            PathBuf::from("/home/user/my-project/.agents/sessions")
        );
    }

    #[test]
    fn test_is_session_path() {
        assert!(is_session_path(Path::new(
            "/project/.agents/sessions/__live_session__/progress.md"
        )));
        assert!(is_session_path(Path::new(
            "/project/.agents/sessions/__live_session__/.lock"
        )));
        assert!(is_session_path(Path::new(
            "/project/.agents/sessions/__live_session__"
        )));
        assert!(!is_session_path(Path::new(
            "/project/.agents/sessions/2026-04-06T14-30-00/summary.md"
        )));
        assert!(!is_session_path(Path::new(
            "/project/.agents/tasks/pending/group/task-001.json"
        )));
    }

    #[test]
    fn test_watcher_state_new() {
        let state = WatcherState::new();
        let watched = state.watched_projects.lock().unwrap();
        assert!(watched.is_empty());
        let cmd_tx = state.command_tx.lock().unwrap();
        assert!(cmd_tx.is_none());
        let stop_tx = state.stop_tx.lock().unwrap();
        assert!(stop_tx.is_none());
        let session_cmd_tx = state.session_command_tx.lock().unwrap();
        assert!(session_cmd_tx.is_none());
        let session_stop_tx = state.session_stop_tx.lock().unwrap();
        assert!(session_stop_tx.is_none());
    }

    #[test]
    fn test_file_change_event_serialization() {
        let event = FileChangeEvent {
            kind: "modify".to_string(),
            path: "/project/.agents/tasks/pending/group/task-001.json".to_string(),
            project_path: "/project".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"kind\":\"modify\""));
        assert!(json.contains("\"path\":\"/project/.agents/tasks/pending/group/task-001.json\""));
        assert!(json.contains("\"project_path\":\"/project\""));
    }

    #[test]
    fn test_file_change_batch_serialization() {
        let batch = FileChangeBatch {
            events: vec![
                FileChangeEvent {
                    kind: "modify".to_string(),
                    path: "/p/.agents/tasks/pending/g/task-001.json".to_string(),
                    project_path: "/p".to_string(),
                },
                FileChangeEvent {
                    kind: "delete".to_string(),
                    path: "/p/.agents/tasks/pending/g/task-002.json".to_string(),
                    project_path: "/p".to_string(),
                },
            ],
            project_path: "/p".to_string(),
        };
        let json = serde_json::to_string(&batch).unwrap();
        assert!(json.contains("\"events\""));
        assert!(json.contains("task-001.json"));
        assert!(json.contains("task-002.json"));
    }

    #[test]
    fn test_watch_error_event_serialization() {
        let event = WatchErrorEvent {
            message: "Something went wrong".to_string(),
            project_path: "/project".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"message\":\"Something went wrong\""));
    }

    #[test]
    fn test_watch_disconnected_event_serialization() {
        let event = WatchDisconnectedEvent {
            message: "Directory removed".to_string(),
            project_path: "/project".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"message\":\"Directory removed\""));
    }

    #[test]
    fn test_filter_non_json_files() {
        let paths = vec![
            Path::new("/tasks/pending/group/task-001.json"),
            Path::new("/tasks/pending/group/.DS_Store"),
            Path::new("/tasks/pending/group/readme.md"),
            Path::new("/tasks/pending/group/task-002.json"),
        ];

        let filtered: Vec<&Path> = paths
            .iter()
            .copied()
            .filter(|p| is_task_json_file(p))
            .collect();

        assert_eq!(filtered.len(), 2);
        assert!(filtered[0].to_str().unwrap().contains("task-001.json"));
        assert!(filtered[1].to_str().unwrap().contains("task-002.json"));
    }

    #[test]
    fn test_resolve_project_path_single_project() {
        let mut watched = HashSet::new();
        watched.insert("/home/user/project-a".to_string());

        let file_path =
            Path::new("/home/user/project-a/.agents/tasks/pending/group/task-001.json");
        let result = resolve_project_path(file_path, &watched);
        assert_eq!(result, Some("/home/user/project-a".to_string()));
    }

    #[test]
    fn test_resolve_project_path_multiple_projects() {
        let mut watched = HashSet::new();
        watched.insert("/home/user/project-a".to_string());
        watched.insert("/home/user/project-b".to_string());

        let file_a =
            Path::new("/home/user/project-a/.agents/tasks/pending/group/task-001.json");
        let file_b =
            Path::new("/home/user/project-b/.agents/tasks/completed/group/task-005.json");

        assert_eq!(
            resolve_project_path(file_a, &watched),
            Some("/home/user/project-a".to_string())
        );
        assert_eq!(
            resolve_project_path(file_b, &watched),
            Some("/home/user/project-b".to_string())
        );
    }

    #[test]
    fn test_resolve_project_path_no_match() {
        let mut watched = HashSet::new();
        watched.insert("/home/user/project-a".to_string());

        let file_path =
            Path::new("/home/user/project-c/.agents/tasks/pending/group/task-001.json");
        let result = resolve_project_path(file_path, &watched);
        assert_eq!(result, None);
    }

    #[test]
    fn test_resolve_project_path_empty_set() {
        let watched = HashSet::new();
        let file_path =
            Path::new("/home/user/project-a/.agents/tasks/pending/group/task-001.json");
        let result = resolve_project_path(file_path, &watched);
        assert_eq!(result, None);
    }

    #[test]
    fn test_resolve_project_path_session_path() {
        let mut watched = HashSet::new();
        watched.insert("/home/user/project-a".to_string());

        let file_path = Path::new(
            "/home/user/project-a/.agents/sessions/__live_session__/progress.md",
        );
        let result = resolve_project_path(file_path, &watched);
        assert_eq!(result, Some("/home/user/project-a".to_string()));
    }

    #[test]
    fn test_resolve_task_project_path() {
        let mut watched = HashSet::new();
        watched.insert("/home/user/project-a".to_string());

        let task_file =
            Path::new("/home/user/project-a/.agents/tasks/pending/group/task-001.json");
        let session_file = Path::new(
            "/home/user/project-a/.agents/sessions/__live_session__/progress.md",
        );

        assert_eq!(
            resolve_task_project_path(task_file, &watched),
            Some("/home/user/project-a".to_string())
        );
        // Session file should NOT match task resolver.
        assert_eq!(resolve_task_project_path(session_file, &watched), None);
    }

    #[test]
    fn test_resolve_session_project_path() {
        let mut watched = HashSet::new();
        watched.insert("/home/user/project-a".to_string());

        let task_file =
            Path::new("/home/user/project-a/.agents/tasks/pending/group/task-001.json");
        let session_file = Path::new(
            "/home/user/project-a/.agents/sessions/__live_session__/progress.md",
        );

        // Task file should NOT match session resolver.
        assert_eq!(resolve_session_project_path(task_file, &watched), None);
        assert_eq!(
            resolve_session_project_path(session_file, &watched),
            Some("/home/user/project-a".to_string())
        );
    }

    #[test]
    fn test_validate_watch_path_exists() {
        let tmp = tempfile::tempdir().unwrap();
        let agents_dir = tmp.path().join(".agents").join("tasks");
        fs::create_dir_all(&agents_dir).unwrap();

        let result = validate_watch_path(tmp.path().to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), agents_dir);
    }

    #[test]
    fn test_validate_watch_path_not_exists() {
        let result = validate_watch_path("/nonexistent/project");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_validate_watch_path_not_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let agents_dir = tmp.path().join(".agents");
        fs::create_dir_all(&agents_dir).unwrap();
        let tasks_file = agents_dir.join("tasks");
        fs::write(&tasks_file, "not a dir").unwrap();

        let result = validate_watch_path(tmp.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a directory"));
    }

    #[test]
    fn test_file_change_event_with_different_projects() {
        let event_a = FileChangeEvent {
            kind: "modify".to_string(),
            path: "/project-a/.agents/tasks/pending/g/task-001.json".to_string(),
            project_path: "/project-a".to_string(),
        };
        let event_b = FileChangeEvent {
            kind: "delete".to_string(),
            path: "/project-b/.agents/tasks/completed/g/task-002.json".to_string(),
            project_path: "/project-b".to_string(),
        };

        let json_a = serde_json::to_string(&event_a).unwrap();
        let json_b = serde_json::to_string(&event_b).unwrap();

        assert!(json_a.contains("\"project_path\":\"/project-a\""));
        assert!(json_b.contains("\"project_path\":\"/project-b\""));
    }

    #[test]
    fn test_file_change_batch_different_projects() {
        let batch_a = FileChangeBatch {
            events: vec![FileChangeEvent {
                kind: "modify".to_string(),
                path: "/a/.agents/tasks/pending/g/task-001.json".to_string(),
                project_path: "/a".to_string(),
            }],
            project_path: "/a".to_string(),
        };
        let batch_b = FileChangeBatch {
            events: vec![FileChangeEvent {
                kind: "modify".to_string(),
                path: "/b/.agents/tasks/pending/g/task-001.json".to_string(),
                project_path: "/b".to_string(),
            }],
            project_path: "/b".to_string(),
        };

        let json_a = serde_json::to_string(&batch_a).unwrap();
        let json_b = serde_json::to_string(&batch_b).unwrap();

        assert!(json_a.contains("\"project_path\":\"/a\""));
        assert!(json_b.contains("\"project_path\":\"/b\""));
    }

    #[test]
    fn test_is_result_file_matches() {
        let path = Path::new(
            "/project/.agents/sessions/__live_session__/result-5.md",
        );
        assert_eq!(is_result_file(path), Some("result-5.md".to_string()));
    }

    #[test]
    fn test_is_result_file_matches_complex_id() {
        let path = Path::new(
            "/project/.agents/sessions/__live_session__/result-152.md",
        );
        assert_eq!(is_result_file(path), Some("result-152.md".to_string()));
    }

    #[test]
    fn test_is_result_file_rejects_non_result() {
        let path = Path::new(
            "/project/.agents/sessions/__live_session__/progress.md",
        );
        assert_eq!(is_result_file(path), None);
    }

    #[test]
    fn test_is_result_file_rejects_context_file() {
        let path = Path::new(
            "/project/.agents/sessions/__live_session__/context-task-5.md",
        );
        assert_eq!(is_result_file(path), None);
    }

    #[test]
    fn test_is_result_file_rejects_non_session_path() {
        let path = Path::new("/project/.agents/tasks/result-5.md");
        assert_eq!(is_result_file(path), None);
    }

    #[test]
    fn test_result_file_change_event_serialization() {
        let event = ResultFileChangeEvent {
            filename: "result-5.md".to_string(),
            kind: "modify".to_string(),
            project_path: "/project".to_string(),
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"filename\":\"result-5.md\""));
        assert!(json.contains("\"kind\":\"modify\""));
        assert!(json.contains("\"project_path\":\"/project\""));
    }
}
