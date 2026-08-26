import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

/**
 * 文件系统 / 工作区相关 command 的类型化封装
 * （对应 src-tauri/src/fs.rs 与 src-tauri/src/workspace.rs）。
 * 组件不得直接调用 invoke / dialog / opener。
 */

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export type EntryKind = 'file' | 'dir';

const MD_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: '文本文件', extensions: ['txt'] },
  { name: '所有文件', extensions: ['*'] },
];

/* ---------------- 单文件 ---------------- */

/** 弹出系统打开文件对话框（取消返回 null） */
export function pickOpenPath(): Promise<string | null> {
  return open({ multiple: false, filters: MD_FILTERS }) as Promise<string | null>;
}

/** 弹出系统保存对话框（取消返回 null） */
export function pickSavePath(defaultName: string): Promise<string | null> {
  return save({ defaultPath: defaultName, filters: MD_FILTERS }) as Promise<string | null>;
}

/** 导出 HTML 用保存对话框 */
export function pickSaveHtmlPath(defaultName: string): Promise<string | null> {
  return save({
    defaultPath: defaultName,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  }) as Promise<string | null>;
}

export function readTextFile(path: string): Promise<string> {
  return invoke('read_text_file', { path });
}

export function writeTextFile(path: string, contents: string): Promise<void> {
  return invoke('write_text_file', { path, contents });
}

/* ---------------- 图片落盘（M3） ---------------- */

export function ensureDir(path: string): Promise<void> {
  return invoke('ensure_dir', { path });
}

/** 写入二进制文件（base64 传输） */
export async function writeBinaryFile(path: string, bytes: Uint8Array): Promise<void> {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  await invoke('write_binary_file', { path, dataB64: btoa(binary) });
}

/* ---------------- 文件监听（M3 / S3） ---------------- */

export function watchWorkspace(dir: string): Promise<void> {
  return invoke('watch_workspace', { dir });
}

export function unwatchAll(): Promise<void> {
  return invoke('unwatch_all');
}

/* ---------------- 工作区全局搜索（M4） ---------------- */

export interface SearchHit {
  path: string;
  line: number;
  text: string;
}

export function searchWorkspace(root: string, query: string): Promise<SearchHit[]> {
  return invoke('search_workspace', { root, query });
}

/* ---------------- 工作区 ---------------- */

/** 选择文件夹作为工作区（取消返回 null） */
export function pickWorkspaceDir(): Promise<string | null> {
  return open({ directory: true, multiple: false }) as Promise<string | null>;
}

export function listDir(dir: string): Promise<DirEntry[]> {
  return invoke('list_dir', { dir });
}

export function createEntry(path: string, kind: EntryKind): Promise<void> {
  return invoke('create_entry', { path, kind });
}

/** 重命名，返回新的完整路径 */
export function renameEntry(oldPath: string, newName: string): Promise<string> {
  return invoke('rename_entry', { oldPath, newName });
}

/** 移到系统废纸篓 */
export function deleteEntry(path: string): Promise<void> {
  return invoke('delete_entry', { path });
}

export function pathExists(path: string): Promise<boolean> {
  return invoke('path_exists', { path });
}

/** 将目录动态加入 asset 协议白名单（运行时授权） */
export function allowWorkspaceAssets(dir: string): Promise<void> {
  return invoke('allow_workspace_assets', { dir });
}

/** 在系统文件管理器中显示该条目 */
export function revealInOS(path: string): Promise<void> {
  return revealItemInDir(path);
}
