// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod ai;
mod fs;
mod menu;
mod watch;
mod workspace;

use std::sync::Mutex;
use tauri::Manager;
#[cfg(target_os = "macos")]
use tauri::Emitter;
// RunEvent::Opened 仅在 macOS/iOS/Android 上存在，故这里按平台裁剪导入。
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
use tauri::RunEvent;

/// 单例应用状态：缓存“带文件启动 / 运行中被要求打开”的文件路径。
/// 冷启动时前端可能尚未挂载监听，先落盘在此处供其就绪后拉取。
struct OpenedFiles(Mutex<Vec<String>>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 由前端在「未保存保护」确认后调用，确定性退出进程。
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 前端就绪后拉取累积的外部打开请求（不消费，openPath 侧按路径去重）。
#[tauri::command]
fn startup_files(app: tauri::AppHandle) -> Vec<String> {
    app.try_state::<OpenedFiles>()
        .map(|s| s.0.lock().expect("opened files poisoned").clone())
        .unwrap_or_default()
}

/// 启动参数中的文档路径（macOS 双击文档冷启动 / Dock 拖拽等）。
fn collect_arg_files() -> Vec<String> {
    use std::path::{Path, PathBuf};
    const EXT: [&str; 4] = ["md", "markdown", "mdown", "mkd"];
    let mut out = Vec::new();
    for arg in std::env::args_os().skip(1) {
        // 跳过 macOS 的 -psn_* 与常规 CLI 开关
        let s = arg.to_string_lossy();
        if s.starts_with('-') || Path::new(s.as_ref()).extension().is_none_or(|e| {
            !EXT.contains(&e.to_ascii_lowercase().to_string_lossy().as_ref())
        }) {
            continue;
        }
        let p = PathBuf::from(&arg);
        // absolute() 不依赖 cwd 解析盘符/前缀问题；存在性检查留给读取阶段报错
        match std::path::absolute(p) {
            Ok(abs) => out.push(abs.to_string_lossy().into_owned()),
            Err(_) => out.push(s.into_owned()),
        }
    }
    out.dedup();
    out
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    let devtools = tauri_plugin_devtools::init();

    let mut builder = tauri::Builder::default();
    builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    // macOS 使用原生菜单栏（位于屏幕顶部，与系统完美融合）；
    // Windows/Linux 不设置原生菜单，改为前端渲染自定义菜单栏（避免白底独立一行）。
    #[cfg(target_os = "macos")]
    {
        builder = builder
            // 中文菜单栏（替换 Tauri 默认英文菜单）
            .menu(|app| menu::build(app))
            // 自定义菜单项统一转发给前端处理（预定义项不会走到这里）
            .on_menu_event(|app, event| {
                let _ = app.emit("menu", event.id().0.as_str());
            });
    }

    builder
        .invoke_handler(tauri::generate_handler![
            greet,
            exit_app,
            startup_files,
            menu::sync_view_menu,
            ai::ai_chat,
            ai::ai_test,
            ai::ai_cancel,
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
        .setup(|app| {
            app.manage(OpenedFiles(Mutex::new(collect_arg_files())));
            app.manage(ai::initial_cancel_flag());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // Finder 双击文档 / 拖到 Dock 图标：系统把路径交给我们（macOS openDocument 事件链）。
            // 注意：RunEvent::Opened 仅在 macOS/iOS/Android 上存在（tauri 按 cfg 裁剪），
            // 因此在其它平台（如 Windows）必须用同样的 cfg 门控，否则无法编译。
            match event {
                #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
                RunEvent::Opened { urls } => {
                    let paths: Vec<String> = urls
                        .iter()
                        .filter_map(|u| u.to_file_path().ok())
                        .map(|p| p.to_string_lossy().into_owned())
                        .collect();
                    if paths.is_empty() {
                        return;
                    }
                    if let Some(state) = _app.try_state::<OpenedFiles>() {
                        state
                            .0
                            .lock()
                            .expect("opened files poisoned")
                            .extend(paths.clone());
                    }
                    let _ = _app.emit("opened-files", paths);
                }
                _ => {}
            }
        });
}
