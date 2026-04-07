use serde::Serialize;
use std::path::Path;
use tauri_plugin_store::StoreExt;

mod discovery;
mod session;
mod specs;
mod tasks;
mod watcher;

const STORE_FILENAME: &str = "settings.json";
const STORE_KEY_PROJECT_DIR: &str = "project_directory";
const STORE_KEY_APP_SETTINGS: &str = "app_settings";

#[derive(Serialize)]
struct PingResponse {
    message: String,
    timestamp: u64,
}

#[derive(Serialize)]
struct ProjectDirectoryResult {
    path: String,
    has_tasks_dir: bool,
}

#[derive(Serialize)]
struct SavedProjectDirectory {
    path: Option<String>,
    exists: bool,
    has_tasks_dir: bool,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn ping(payload: &str) -> PingResponse {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    PingResponse {
        message: format!("pong: {}", payload),
        timestamp,
    }
}

/// Check if the given directory contains `.agents/tasks/`
fn check_tasks_dir(dir_path: &str) -> bool {
    let tasks_path = Path::new(dir_path).join(".agents").join("tasks");
    tasks_path.is_dir()
}

/// Open a native directory picker dialog and return the selected path.
/// Returns None if user cancels.
#[tauri::command]
async fn select_project_directory(
    app: tauri::AppHandle,
) -> Result<Option<ProjectDirectoryResult>, String> {
    use tauri_plugin_dialog::DialogExt;

    let dir = app
        .dialog()
        .file()
        .set_title("Select Project Directory")
        .blocking_pick_folder();

    match dir {
        Some(file_path) => {
            let path_str = file_path.to_string();
            let has_tasks_dir = check_tasks_dir(&path_str);
            Ok(Some(ProjectDirectoryResult {
                path: path_str,
                has_tasks_dir,
            }))
        }
        None => Ok(None),
    }
}

/// Validate a directory path: check it exists and has .agents/tasks/
#[tauri::command]
fn validate_project_directory(path: &str) -> Result<ProjectDirectoryResult, String> {
    let dir = Path::new(path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Check read permission by attempting to read_dir
    match std::fs::read_dir(dir) {
        Ok(_) => {}
        Err(e) => {
            return Err(format!("Permission denied on directory {}: {}", path, e));
        }
    }

    let has_tasks_dir = check_tasks_dir(path);
    Ok(ProjectDirectoryResult {
        path: path.to_string(),
        has_tasks_dir,
    })
}

/// Save the project directory path to persistent store.
#[tauri::command]
fn save_project_path(app: tauri::AppHandle, path: &str) -> Result<(), String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set(
        STORE_KEY_PROJECT_DIR,
        serde_json::Value::String(path.to_string()),
    );
    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// Load the saved project directory from persistent store.
/// Returns info about whether the saved directory still exists.
#[tauri::command]
fn get_saved_project_path(app: tauri::AppHandle) -> Result<SavedProjectDirectory, String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let value = store.get(STORE_KEY_PROJECT_DIR);

    match value {
        Some(serde_json::Value::String(path)) => {
            let dir = Path::new(&path);
            let exists = dir.exists() && dir.is_dir();
            let has_tasks_dir = if exists {
                check_tasks_dir(&path)
            } else {
                false
            };

            if !exists {
                // Clear the stale path
                store.delete(STORE_KEY_PROJECT_DIR);
                let _ = store.save();
            }

            Ok(SavedProjectDirectory {
                path: Some(path),
                exists,
                has_tasks_dir,
            })
        }
        _ => Ok(SavedProjectDirectory {
            path: None,
            exists: false,
            has_tasks_dir: false,
        }),
    }
}

/// Clear the saved project directory path.
#[tauri::command]
fn clear_saved_project_path(app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.delete(STORE_KEY_PROJECT_DIR);
    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// Get app settings from the persistent store.
/// Returns null if no settings are saved.
#[tauri::command]
fn get_app_settings(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    Ok(store.get(STORE_KEY_APP_SETTINGS))
}

/// Save app settings to the persistent store.
#[tauri::command]
fn save_app_settings(
    app: tauri::AppHandle,
    settings: serde_json::Value,
) -> Result<(), String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set(STORE_KEY_APP_SETTINGS, settings);
    store
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(watcher::WatcherState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            ping,
            select_project_directory,
            validate_project_directory,
            save_project_path,
            get_saved_project_path,
            clear_saved_project_path,
            get_app_settings,
            save_app_settings,
            tasks::read_tasks,
            tasks::read_task,
            tasks::read_manifest,
            tasks::list_task_groups,
            tasks::move_task,
            tasks::update_task_fields,
            specs::read_spec,
            specs::check_spec_analysis,
            specs::get_spec_lifecycle,
            session::check_live_session,
            session::read_session_file,
            session::list_result_files,
            session::list_archived_sessions_cmd,
            session::read_archived_session_file,
            watcher::start_watching,
            watcher::stop_watching,
            watcher::add_watch,
            watcher::remove_watch,
            discovery::scan_for_projects,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
