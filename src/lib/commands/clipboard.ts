import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * 剪贴板封装（右键菜单的剪切/拷贝/粘贴走这里）。
 *
 * 不用 document.execCommand：点击菜单按钮会夺走 contenteditable 的焦点与
 * DOM 选区，execCommand 会静默失败；改为读写 CM6 自身的选区 + 系统剪贴板。
 */
export function readClipboardText(): Promise<string> {
  return readText();
}

export function writeClipboardText(text: string): Promise<void> {
  return writeText(text);
}
