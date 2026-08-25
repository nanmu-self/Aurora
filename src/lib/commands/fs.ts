import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

/**
 * 文件系统相关 command 的类型化封装（对应 src-tauri/src/fs.rs），
 * 以及系统文件对话框。组件不得直接调用 invoke / dialog。
 */

const MD_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: '文本文件', extensions: ['txt'] },
  { name: '所有文件', extensions: ['*'] },
];

/** 弹出系统打开对话框，返回选中的路径（取消返回 null） */
export function pickOpenPath(): Promise<string | null> {
  return open({ multiple: false, filters: MD_FILTERS }) as Promise<string | null>;
}

/** 弹出系统保存对话框，返回目标路径（取消返回 null） */
export function pickSavePath(defaultName: string): Promise<string | null> {
  return save({ defaultPath: defaultName, filters: MD_FILTERS }) as Promise<string | null>;
}

/** 读取 UTF-8 文本文件 */
export function readTextFile(path: string): Promise<string> {
  return invoke('read_text_file', { path });
}

/** 写入 UTF-8 文本文件 */
export function writeTextFile(path: string, contents: string): Promise<void> {
  return invoke('write_text_file', { path, contents });
}
