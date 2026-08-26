// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod fs;
mod menu;
mod watch;
mod workspace;

use tauri::Emitter;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 由前端在「未保存保护」确认后调用，确定性退出进程。
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        // 中文菜单栏（替换 Tauri 默认英文菜单）
        .menu(|app| menu::build(app))
        // 自定义菜单项统一转发给前端处理（预定义项不会走到这里）
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().0.as_str());
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            exit_app,
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
