//! 工作区文件系统操作：目录树读取、条目增删改名、asset 协议动态授权。
//!
//! 安全约定（执行计划 §4.6-A）：
//! - 所有路径操作不做通配授权；前端只能通过离散 command 触达具体路径；
//! - 删除一律进系统废纸篓（trash crate），不做物理删除；
//! - 重命名/新建在目标已存在时报错，绝不静默覆盖；
//! - 隐藏文件（`.` 开头）默认不出现在目录树中。

use serde::Serialize;
use std::path::Path;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// 列出目录的一级子项：目录在前、名称不区分大小写排序，过滤隐藏项。
#[tauri::command]
pub fn list_dir(dir: String) -> Result<Vec<Entry>, String> {
    let p = Path::new(&dir);
    if !p.is_dir() {
        return Err(format!("不是有效目录：{}", dir));
    }

    let mut entries: Vec<Entry> = Vec::new();
    let rd = std::fs::read_dir(p).map_err(|e| format!("读取目录失败：{e}"))?;
    for item in rd.flatten() {
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue; // 隐藏文件/目录
        }
        let path = item.path();
        let is_dir = path.is_dir();
        entries.push(Entry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

/// 新建文件或目录。目标已存在时拒绝（防覆盖）。
#[tauri::command]
pub fn create_entry(path: String, kind: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err(format!("同名条目已存在：{}", path));
    }
    match kind.as_str() {
        "file" => std::fs::write(p, "").map_err(|e| format!("创建文件失败：{e}")),
        "dir" => std::fs::create_dir(p).map_err(|e| format!("创建文件夹失败：{e}")),
        other => Err(format!("未知类型：{other}")),
    }
}

/// 重命名（同目录内）。返回新完整路径。
#[tauri::command]
pub fn rename_entry(old_path: String, new_name: String) -> Result<String, String> {
    let old = Path::new(&old_path);
    let parent = old
        .parent()
        .ok_or_else(|| format!("无法定位父目录：{}", old_path))?;
    if new_name.is_empty() || new_name.contains('/') || new_name.contains('\\') {
        return Err("名称不能为空且不能包含路径分隔符".into());
    }
    let target = parent.join(&new_name);
    if target.exists() {
        return Err(format!("同名条目已存在：{}", new_name));
    }
    std::fs::rename(old, &target).map_err(|e| format!("重命名失败：{e}"))?;
    Ok(target.to_string_lossy().to_string())
}

/// 删除到系统废纸篓（可恢复），不做物理删除。
#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
    trash::delete(path.clone()).map_err(|e| format!("移到废纸篓失败：{e}"))
}

/// 路径是否存在（用于最近工作区有效性校验）。
#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// 将工作区根目录动态加入 asset 协议白名单（S2 Spike 的核心验证点）。
/// 静态 scope 无法覆盖任意用户目录，必须在打开工作区时运行时授权。
#[tauri::command]
pub fn allow_workspace_assets(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(&dir, true)
        .map_err(|e| format!("asset 授权失败：{e}"))
}
