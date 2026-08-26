//! 本地文件的读写命令。
//!
//! 原则（执行计划 §4.3）：所有磁盘 IO 走 Rust command，前端不碰裸路径权限。
//! M1 为单文件模式；M2 引入工作区后，在 canonicalize 之后追加沙箱断言
//! （路径必须位于工作区根内，拒绝符号链接逃逸）。

use std::path::Path;

use base64::Engine;
use crate::watch;

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
/// 写入前登记自写抑制窗口（§4.6-B 第二层防御），
/// 避免自动保存触发的 watcher 事件被误判为外部修改。
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.is_dir() {
            return Err(format!("目标目录不存在：{}", dir.display()));
        }
    }
    std::fs::write(p, contents).map_err(|e| format!("写入失败：{e}"))?;
    watch::mark_self_write(&path);
    Ok(())
}

/// 递归创建目录（图片落盘前确保 assets/ 存在）。
#[tauri::command]
pub fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("创建目录失败：{e}"))
}

/// 写入二进制文件（base64 传输）。用于图片粘贴/拖入落盘（M3）。
#[tauri::command]
pub fn write_binary_file(path: String, data_b64: String) -> Result<(), String> {
    use base64::engine::general_purpose::STANDARD as B64;
    let bytes = B64
        .decode(data_b64.as_bytes())
        .map_err(|e| format!("数据解码失败：{e}"))?;
    let p = Path::new(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() && !dir.is_dir() {
            return Err(format!("目标目录不存在：{}", dir.display()));
        }
    }
    std::fs::write(p, bytes).map_err(|e| format!("写入失败：{e}"))?;
    watch::mark_self_write(&path);
    Ok(())
}
