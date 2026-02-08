use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager,
};

/// Holds the file path passed via CLI args (e.g. double-clicking a .md file).
struct InitialFile(Mutex<Option<String>>);

#[derive(serde::Serialize)]
struct InitialFileData {
    path: String,
    content: String,
}

/// Returns the initial file (path + content) if a markdown file was passed via CLI.
/// Reading happens in Rust to bypass frontend fs:scope restrictions.
#[tauri::command]
fn get_initial_file(state: tauri::State<InitialFile>) -> Option<InitialFileData> {
    let path = state.0.lock().unwrap().take()?;
    let content = std::fs::read_to_string(&path).ok()?;
    Some(InitialFileData { path, content })
}

fn is_markdown_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md")
        || lower.ends_with(".markdown")
        || lower.ends_with(".mdown")
        || lower.ends_with(".mkd")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check if a markdown file was passed as CLI argument
    let initial_file = std::env::args().nth(1).filter(|p| is_markdown_file(p));

    tauri::Builder::default()
        .manage(InitialFile(Mutex::new(initial_file)))
        .invoke_handler(tauri::generate_handler![get_initial_file])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Build native menu
            let open_item = MenuItemBuilder::new("Open...")
                .id("open")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&open_item)
                .separator()
                .quit()
                .build()?;

            let menu = Menu::with_items(app, &[&file_menu])?;
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
