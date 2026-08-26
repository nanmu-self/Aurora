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

/* ---------------- 全局搜索（M4） ---------------- */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub line: u64,
    pub text: String,
}

const SEARCH_MAX_HITS: usize = 300;
const SEARCH_MAX_FILES: usize = 5000;
const SEARCH_MAX_FILE_SIZE: u64 = 2 * 1024 * 1024;
const SEARCH_EXTS: [&str; 3] = ["md", "markdown", "txt"];

/// 递归收集可搜索文件（跳过隐藏目录与超大文件，显式栈防爆栈）
fn collect_files(root: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&dir) else { continue };
        for item in rd.flatten() {
            let path = item.path();
            let name = item.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            if path.is_dir() {
                stack.push(path);
            } else if matches!(
                path.extension().and_then(|e| e.to_str()),
                Some(ext) if SEARCH_EXTS.contains(&ext.to_lowercase().as_str())
            ) && std::fs::metadata(&path).map(|m| m.len() <= SEARCH_MAX_FILE_SIZE).unwrap_or(false)
            {
                files.push(path);
                if files.len() >= SEARCH_MAX_FILES {
                    return files;
                }
            }
        }
    }
    files
}

/// 工作区全文搜索：大小写不敏感子串匹配，返回命中行。
#[tauri::command]
pub fn search_workspace(root: String, query: String) -> Result<Vec<SearchHit>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(format!("不是有效目录：{}", root));
    }

    let mut hits = Vec::new();
    for file in collect_files(root_path) {
        let content = match std::fs::read_to_string(&file) {
            Ok(c) => c,
            Err(_) => continue, // 二进制或不可解码文件跳过
        };
        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&q) {
                let trimmed = line.trim();
                let text: String = trimmed.chars().take(160).collect();
                hits.push(SearchHit {
                    path: file.to_string_lossy().to_string(),
                    line: (i + 1) as u64,
                    text,
                });
                if hits.len() >= SEARCH_MAX_HITS {
                    return Ok(hits);
                }
            }
        }
    }
    Ok(hits)
}
