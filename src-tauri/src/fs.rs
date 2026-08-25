//! 本地文本文件的读写命令。
//!
//! 原则（执行计划 §4.3）：所有磁盘 IO 走 Rust command，前端不碰裸路径权限。
//! M1 为单文件模式；M2 引入工作区后，在 canonicalize 之后追加沙箱断言
//! （路径必须位于工作区根内，拒绝符号链接逃逸）。

use std::path::Path;

/// 读取 UTF-8 文本文件。
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.is_file() {
        return Err(format!("文件不存在或不是常规文件：{}", path));
    }
    std::fs::read_to_string(p).map_err(|e| format!("读取失败：{e}"))
}

/// 写入文本文件（UTF-8）。父目录必须已存在，不做静默创建。
///
/// 注：M3 接入文件监听时，写入前应在此登记 (path, 内容哈希) 到自写抑制队列，
/// 避免 watcher 把自身保存误判为外部修改（§4.6-B）。
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.is_dir() {
            return Err(format!("目标目录不存在：{}", dir.display()));
        }
    }
    std::fs::write(p, contents).map_err(|e| format!("写入失败：{e}"))
}
