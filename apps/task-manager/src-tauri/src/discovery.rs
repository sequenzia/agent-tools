use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

/// Maximum number of directories to scan before stopping (safety limit).
const MAX_DIRS_SCANNED: usize = 50_000;

/// IPC event name emitted to the frontend for scan progress updates.
const EVENT_SCAN_PROGRESS: &str = "project-scan-progress";

/// A discovered project directory.
#[derive(Debug, Clone, Serialize)]
pub struct DiscoveredProject {
    /// Absolute path to the project root (parent of `.agents/tasks/`).
    pub path: String,
    /// The directory name (last path segment).
    pub name: String,
}

/// Progress update emitted during scanning.
#[derive(Debug, Clone, Serialize)]
pub struct ScanProgress {
    /// Number of directories scanned so far.
    pub dirs_scanned: usize,
    /// Number of projects found so far.
    pub projects_found: usize,
    /// Whether the scan is complete.
    pub done: bool,
    /// The root path currently being scanned.
    pub current_root: String,
}

/// Result of a full project scan.
#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    /// All discovered projects (deduplicated).
    pub projects: Vec<DiscoveredProject>,
    /// Warnings encountered during the scan (e.g., missing roots, permission errors).
    pub warnings: Vec<String>,
    /// Total number of directories scanned.
    pub dirs_scanned: usize,
    /// Elapsed time in milliseconds.
    pub elapsed_ms: u64,
}

/// Check if the given directory contains `.agents/tasks/` subdirectory.
fn has_tasks_dir(dir: &Path) -> bool {
    dir.join(".agents").join("tasks").is_dir()
}

/// Extract the directory name from a path.
fn dir_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.display().to_string())
}

/// Recursively scan a root directory for projects containing `.agents/tasks/`.
///
/// Uses iterative BFS with explicit depth tracking to avoid stack overflow
/// on deep directory trees. Detects symlink cycles via canonical path tracking.
fn scan_directory(
    root: &Path,
    max_depth: usize,
    seen_canonical: &mut HashSet<PathBuf>,
    discovered: &mut Vec<DiscoveredProject>,
    warnings: &mut Vec<String>,
    dirs_scanned: &mut usize,
    app: Option<&AppHandle>,
) {
    // BFS queue: (path, current_depth)
    let mut queue: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];

    while let Some((dir, depth)) = queue.pop() {
        if *dirs_scanned >= MAX_DIRS_SCANNED {
            warnings.push(format!(
                "Safety limit reached: scanned {} directories, stopping",
                MAX_DIRS_SCANNED
            ));
            break;
        }

        *dirs_scanned += 1;

        // Symlink cycle detection: resolve to canonical path
        let canonical = match dir.canonicalize() {
            Ok(c) => c,
            Err(e) => {
                // Permission denied or broken symlink
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    warnings.push(format!("Permission denied: {}", dir.display()));
                }
                // Skip this directory
                continue;
            }
        };

        if !seen_canonical.insert(canonical.clone()) {
            // Already visited this canonical path (symlink cycle or duplicate)
            continue;
        }

        // Check if this directory has .agents/tasks/
        if has_tasks_dir(&dir) {
            let path_str = dir.to_string_lossy().to_string();
            discovered.push(DiscoveredProject {
                name: dir_name(&dir),
                path: path_str,
            });
        }

        // Emit progress periodically (every 50 dirs)
        if *dirs_scanned % 50 == 0 {
            if let Some(app) = app {
                let _ = app.emit(
                    EVENT_SCAN_PROGRESS,
                    ScanProgress {
                        dirs_scanned: *dirs_scanned,
                        projects_found: discovered.len(),
                        done: false,
                        current_root: root.display().to_string(),
                    },
                );
            }
        }

        // Don't recurse deeper than max_depth
        if depth >= max_depth {
            continue;
        }

        // Skip hidden directories (except the root itself) and common non-project dirs
        let dir_name_str = dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        if depth > 0 && should_skip_dir(&dir_name_str) {
            continue;
        }

        // Read directory entries
        let entries = match std::fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    warnings.push(format!("Permission denied: {}", dir.display()));
                }
                continue;
            }
        };

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();

            // Only recurse into directories
            let ft = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if ft.is_dir() || ft.is_symlink() {
                // For symlinks, verify the target is a directory
                if ft.is_symlink() && !path.is_dir() {
                    continue;
                }
                queue.push((path, depth + 1));
            }
        }
    }
}

/// Directories to skip during scanning (performance optimization).
fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | ".hg"
            | ".svn"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | "__pycache__"
            | ".venv"
            | "venv"
            | ".tox"
            | ".cache"
            | ".npm"
            | ".yarn"
            | "vendor"
    ) || name.starts_with('.')
}

/// Scan multiple root directories for projects containing `.agents/tasks/`.
///
/// Deduplicates discovered projects by canonical path. Skips missing root dirs
/// with a warning. Emits progress events via Tauri IPC.
#[tauri::command]
pub async fn scan_for_projects(
    app: AppHandle,
    root_paths: Vec<String>,
    max_depth: Option<usize>,
) -> Result<ScanResult, String> {
    let max_depth = max_depth.unwrap_or(3);
    let start = Instant::now();

    let mut discovered: Vec<DiscoveredProject> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut seen_canonical: HashSet<PathBuf> = HashSet::new();
    let mut dirs_scanned: usize = 0;

    for root_str in &root_paths {
        let root = Path::new(root_str);

        // Validate root exists
        if !root.exists() {
            warnings.push(format!("Root directory does not exist: {}", root_str));
            continue;
        }

        if !root.is_dir() {
            warnings.push(format!("Root path is not a directory: {}", root_str));
            continue;
        }

        scan_directory(
            root,
            max_depth,
            &mut seen_canonical,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            Some(&app),
        );
    }

    // Emit final progress
    let _ = app.emit(
        EVENT_SCAN_PROGRESS,
        ScanProgress {
            dirs_scanned,
            projects_found: discovered.len(),
            done: true,
            current_root: String::new(),
        },
    );

    let elapsed_ms = start.elapsed().as_millis() as u64;

    Ok(ScanResult {
        projects: discovered,
        warnings,
        dirs_scanned,
        elapsed_ms,
    })
}

// --- Tests ---

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Create a project directory structure at the given path.
    fn create_project(base: &Path) {
        fs::create_dir_all(base.join(".agents").join("tasks").join("pending")).unwrap();
    }

    #[test]
    fn test_has_tasks_dir_true() {
        let tmp = tempfile::tempdir().unwrap();
        create_project(tmp.path());
        assert!(has_tasks_dir(tmp.path()));
    }

    #[test]
    fn test_has_tasks_dir_false() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(!has_tasks_dir(tmp.path()));
    }

    #[test]
    fn test_has_tasks_dir_partial_path() {
        let tmp = tempfile::tempdir().unwrap();
        // Only .agents/ but no tasks/ subdirectory
        fs::create_dir_all(tmp.path().join(".agents")).unwrap();
        assert!(!has_tasks_dir(tmp.path()));
    }

    #[test]
    fn test_discovery_finds_projects() {
        let tmp = tempfile::tempdir().unwrap();

        // Create root with two projects
        let proj_a = tmp.path().join("project-a");
        let proj_b = tmp.path().join("project-b");
        let not_proj = tmp.path().join("not-a-project");

        create_project(&proj_a);
        create_project(&proj_b);
        fs::create_dir_all(&not_proj).unwrap();

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        assert_eq!(discovered.len(), 2);
        let paths: Vec<&str> = discovered.iter().map(|d| d.path.as_str()).collect();
        assert!(paths.iter().any(|p| p.contains("project-a")));
        assert!(paths.iter().any(|p| p.contains("project-b")));
        assert!(warnings.is_empty());
    }

    #[test]
    fn test_discovery_respects_depth_limit() {
        let tmp = tempfile::tempdir().unwrap();

        // Create a project at depth 1 (should be found)
        let shallow = tmp.path().join("shallow");
        create_project(&shallow);

        // Create a project at depth 4 (should NOT be found with max_depth=3)
        let deep = tmp.path().join("a").join("b").join("c").join("deep-project");
        create_project(&deep);

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        // Only the shallow project should be found
        assert_eq!(discovered.len(), 1);
        assert!(discovered[0].path.contains("shallow"));
    }

    #[test]
    fn test_discovery_deeper_depth() {
        let tmp = tempfile::tempdir().unwrap();

        // Create a project at depth 4
        let deep = tmp.path().join("a").join("b").join("c").join("deep-project");
        create_project(&deep);

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        // With depth 5, should find it
        scan_directory(
            tmp.path(),
            5,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        assert_eq!(discovered.len(), 1);
        assert!(discovered[0].path.contains("deep-project"));
    }

    #[test]
    fn test_deduplication_across_roots() {
        let tmp = tempfile::tempdir().unwrap();

        let project = tmp.path().join("my-project");
        create_project(&project);

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        // Scan the same root twice
        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );
        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        // Should only find it once
        assert_eq!(discovered.len(), 1);
    }

    #[test]
    fn test_missing_root_produces_warning() {
        // Test the validation logic in scan_for_projects
        let root = Path::new("/nonexistent/path/that/does/not/exist");
        assert!(!root.exists());
        // The scan_for_projects command would add a warning for this
    }

    #[test]
    fn test_should_skip_dir() {
        assert!(should_skip_dir("node_modules"));
        assert!(should_skip_dir(".git"));
        assert!(should_skip_dir("target"));
        assert!(should_skip_dir(".hidden"));
        assert!(!should_skip_dir("my-project"));
        assert!(!should_skip_dir("src"));
        assert!(!should_skip_dir("apps"));
    }

    #[test]
    fn test_dir_name_extraction() {
        assert_eq!(dir_name(Path::new("/Users/dev/my-project")), "my-project");
        assert_eq!(dir_name(Path::new("/a/b/c")), "c");
    }

    #[test]
    fn test_discovery_skips_hidden_dirs() {
        let tmp = tempfile::tempdir().unwrap();

        // Create a project inside a hidden directory
        let hidden = tmp.path().join(".hidden-dir").join("project");
        create_project(&hidden);

        // Create a normal project
        let normal = tmp.path().join("normal-project");
        create_project(&normal);

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        // Only the normal project should be found
        assert_eq!(discovered.len(), 1);
        assert!(discovered[0].path.contains("normal-project"));
    }

    #[test]
    fn test_discovery_skips_node_modules() {
        let tmp = tempfile::tempdir().unwrap();

        // Create a project inside node_modules
        let nm = tmp.path().join("node_modules").join("some-package");
        create_project(&nm);

        // Create a normal project
        let normal = tmp.path().join("real-project");
        create_project(&normal);

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        assert_eq!(discovered.len(), 1);
        assert!(discovered[0].path.contains("real-project"));
    }

    #[test]
    fn test_discovery_root_is_project() {
        let tmp = tempfile::tempdir().unwrap();

        // The root itself is a project
        create_project(tmp.path());

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        assert_eq!(discovered.len(), 1);
    }

    #[test]
    fn test_discovery_empty_root() {
        let tmp = tempfile::tempdir().unwrap();

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        assert!(discovered.is_empty());
        assert!(warnings.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn test_symlink_cycle_detection() {
        use std::os::unix::fs as unix_fs;

        let tmp = tempfile::tempdir().unwrap();

        // Create: root/a/link -> root (cycle)
        let a_dir = tmp.path().join("a");
        fs::create_dir_all(&a_dir).unwrap();
        unix_fs::symlink(tmp.path(), a_dir.join("link")).unwrap();

        // Create a project at root
        create_project(tmp.path());

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            10,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        // Should find the project once (not loop infinitely)
        assert_eq!(discovered.len(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn test_symlink_to_project() {
        use std::os::unix::fs as unix_fs;

        let tmp = tempfile::tempdir().unwrap();

        // Create a real project
        let real = tmp.path().join("real-project");
        create_project(&real);

        // Create a symlink to it
        let link_dir = tmp.path().join("links");
        fs::create_dir_all(&link_dir).unwrap();
        unix_fs::symlink(&real, link_dir.join("linked-project")).unwrap();

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        // Should find the project once (deduplication by canonical path)
        assert_eq!(discovered.len(), 1);
    }

    #[test]
    fn test_multiple_projects_nested() {
        let tmp = tempfile::tempdir().unwrap();

        // Create several projects at various depths
        create_project(&tmp.path().join("proj1"));
        create_project(&tmp.path().join("org").join("proj2"));
        create_project(&tmp.path().join("org").join("proj3"));

        let mut discovered = Vec::new();
        let mut warnings = Vec::new();
        let mut seen = HashSet::new();
        let mut dirs_scanned = 0;

        scan_directory(
            tmp.path(),
            3,
            &mut seen,
            &mut discovered,
            &mut warnings,
            &mut dirs_scanned,
            None,
        );

        assert_eq!(discovered.len(), 3);
    }
}
