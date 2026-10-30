use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use tauri::{
    menu::{Menu, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_fs::FsExt;

const MARKDOWN_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];

/// Emitted to the frontend when the OS asks the running instance to open a file.
const OPEN_FILE_EVENT: &str = "open-file";

#[derive(Default)]
struct OpenRequests {
    /// File the OS asked to open before the frontend was listening.
    pending: Option<PathBuf>,
    /// Set once the frontend has subscribed to `OPEN_FILE_EVENT`.
    frontend_ready: bool,
}

#[derive(Default)]
struct OpenState(Mutex<OpenRequests>);

impl OpenState {
    /// Locks the state, recovering it if a previous holder panicked.
    fn lock(&self) -> MutexGuard<'_, OpenRequests> {
        self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| MARKDOWN_EXTENSIONS.iter().any(|m| ext.eq_ignore_ascii_case(m)))
}

/// Returns the first markdown file in a process' arguments (skipping the
/// executable), resolving relative paths against `cwd`.
fn markdown_arg<S: AsRef<Path>>(args: &[S], cwd: &Path) -> Option<PathBuf> {
    args.iter()
        .skip(1)
        .map(|arg| cwd.join(arg))
        .find(|path| is_markdown_file(path))
}

/// Grants the frontend access to a markdown file the user explicitly opened:
/// read/write through the fs plugin, and the asset protocol for its directory
/// so relative images can load.
fn grant_access(app: &AppHandle, path: &Path) -> Result<(), String> {
    if !path.is_absolute() || !is_markdown_file(path) {
        return Err("Only Markdown files can be opened".into());
    }
    if !path.is_file() {
        return Err(format!("File not found: {}", path.display()));
    }

    app.fs_scope().allow_file(path).map_err(|e| e.to_string())?;
    if let Some(dir) = path.parent() {
        app.asset_protocol_scope()
            .allow_directory(dir, true)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Hands a file to the frontend, or queues it for `get_initial_file` if the
/// frontend is not listening yet.
fn request_open(app: &AppHandle, path: PathBuf) {
    let state = app.state::<OpenState>();
    let mut requests = state.lock();
    if !requests.frontend_ready {
        requests.pending = Some(path);
        return;
    }
    drop(requests);
    let _ = app.emit_to("main", OPEN_FILE_EVENT, path.to_string_lossy());
}

#[cfg(desktop)]
fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Allows the frontend to read/write a file it is about to open (drag & drop,
/// recent files). Dialog-picked paths are already allowed by the dialog plugin.
#[tauri::command]
fn allow_path(app: AppHandle, path: PathBuf) -> Result<(), String> {
    grant_access(&app, &path)
}

/// Returns the file passed on launch (CLI argument / file association), if any,
/// and marks the frontend as ready to receive `OPEN_FILE_EVENT`.
#[tauri::command]
fn get_initial_file(app: AppHandle, state: tauri::State<OpenState>) -> Option<String> {
    let path = {
        let mut requests = state.lock();
        requests.frontend_ready = true;
        requests.pending.take()?
    };
    grant_access(&app, &path).ok()?;
    Some(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if a markdown file was passed as CLI argument
    let args: Vec<_> = std::env::args_os().collect();
    let initial_file = std::env::current_dir()
        .ok()
        .and_then(|cwd| markdown_arg(&args, &cwd));

    let mut builder = tauri::Builder::default();

    // Must be registered first: a second launch (e.g. double-clicking another
    // .md file) forwards its arguments here and exits.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            focus_main_window(app);
            if let Some(path) = markdown_arg(&args, Path::new(&cwd)) {
                request_open(app, path);
            }
        }));
    }

    builder
        .manage(OpenState(Mutex::new(OpenRequests {
            pending: initial_file,
            frontend_ready: false,
        })))
        .invoke_handler(tauri::generate_handler![allow_path, get_initial_file])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Build native menu
            let open_item = MenuItemBuilder::new("Open...")
                .id("open")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;

            let menu = Menu::new(app)?;
            let is_macos = cfg!(target_os = "macos");

            // macOS always shows the first submenu as the app menu, where Quit lives
            if is_macos {
                let app_menu = SubmenuBuilder::new(app, app.package_info().name.clone())
                    .about(None)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
                menu.append(&app_menu)?;
            }

            let mut file_menu = SubmenuBuilder::new(app, "File").item(&open_item);
            if !is_macos {
                file_menu = file_menu.separator().quit();
            }
            menu.append(&file_menu.build()?)?;

            // The macOS webview only gets clipboard and undo shortcuts from these items
            if is_macos {
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                menu.append(&edit_menu)?;
            }

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app, event| {
                if event.id() == "open" {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("menu-open-file", ());
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // macOS delivers file associations as an event instead of CLI args
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                for path in urls.into_iter().filter_map(|url| url.to_file_path().ok()) {
                    if is_markdown_file(&path) {
                        request_open(_app, path);
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_markdown_extensions_case_insensitively() {
        assert!(is_markdown_file(Path::new("notes.md")));
        assert!(is_markdown_file(Path::new("README.MD")));
        assert!(is_markdown_file(Path::new("doc.markdown")));
        assert!(is_markdown_file(Path::new("doc.mdown")));
        assert!(is_markdown_file(Path::new("doc.mkd")));
        assert!(!is_markdown_file(Path::new("notes.txt")));
        assert!(!is_markdown_file(Path::new("md")));
        assert!(!is_markdown_file(Path::new("folder.md/file")));
    }

    #[test]
    fn markdown_arg_skips_executable_and_non_markdown_args() {
        let cwd = Path::new("work");
        let args = ["md-viewer.md", "--flag", "notes.txt", "readme.md"];
        assert_eq!(markdown_arg(&args, cwd), Some(cwd.join("readme.md")));
        assert_eq!(markdown_arg(&["md-viewer"], cwd), None);
        assert_eq!(markdown_arg::<&str>(&[], cwd), None);
    }

    #[test]
    fn markdown_arg_keeps_absolute_paths() {
        let absolute = std::env::temp_dir().join("doc.md");
        let args = [PathBuf::from("md-viewer"), absolute.clone()];
        assert_eq!(markdown_arg(&args, Path::new("elsewhere")), Some(absolute));
    }
}
