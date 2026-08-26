// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod fs;
mod watch;
mod workspace;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            fs::read_text_file,
            fs::write_text_file,
            fs::ensure_dir,
            fs::write_binary_file,
            workspace::list_dir,
            workspace::create_entry,
            workspace::rename_entry,
            workspace::delete_entry,
            workspace::path_exists,
            workspace::allow_workspace_assets,
            workspace::search_workspace,
            watch::watch_workspace,
            watch::unwatch_all
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
