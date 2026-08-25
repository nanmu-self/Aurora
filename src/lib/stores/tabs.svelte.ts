import {
  activeMetrics,
  addTabState,
  dropTabState,
  focusTab,
  getActiveText,
  notifyDocChanged,
} from '$lib/editor/bridge';
import { pickSavePath, readTextFile, writeTextFile } from '$lib/commands/fs';
import { basename } from '$lib/path';
import { status } from '$lib/stores/editorStatus.svelte';

function fmtErr(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export interface Tab {
  id: string;
  /** null = 未命名缓冲区 */
  path: string | null;
  title: string;
  dirty: boolean;
  /** 最近一次保存的全文快照（预留：外部变更比对 / 崩溃恢复） */
  savedText: string;
}

/**
 * 多标签页会话。
 * 正文存在 CM6 的 per-tab EditorState 里；本 store 只持有标签元信息，
 * 并把「打开/切换/关闭/保存」编排到 bridge 的对应操作上。
 */
class TabsStore {
  tabs = $state<Tab[]>([]);
  activeId = $state<string | null>(null);
  #seq = 0;

  get active(): Tab | undefined {
    return this.tabs.find((t) => t.id === this.activeId);
  }

  #nextUntitledTitle(): string {
    this.#seq += 1;
    return this.#seq === 1 ? '未命名' : `未命名 ${this.#seq}`;
  }

  newUntitled(): void {
    const id = crypto.randomUUID();
    this.tabs.push({ id, path: null, title: this.#nextUntitledTitle(), dirty: false, savedText: '' });
    addTabState(id, '');
    this.activate(id);
  }

  /** 打开磁盘文件：已打开则激活，否则读入新标签。读取失败向上抛出 */
  async openPath(path: string): Promise<void> {
    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      this.activate(existing.id);
      return;
    }
    const text = await readTextFile(path);
    const id = crypto.randomUUID();
    this.tabs.push({ id, path, title: basename(path), dirty: false, savedText: text });
    addTabState(id, text);
    this.activate(id);
  }

  activate(id: string): void {
    if (!this.tabs.some((t) => t.id === id)) return;
    this.activeId = id;
    focusTab(id);
    const m = activeMetrics();
    status.chars = m.chars;
    status.ln = m.ln;
    status.col = m.col;
    notifyDocChanged(); // 预览跟随活动标签
  }

  /** 编辑器 onUpdate 触发；只在状态翻转时写一次 */
  markActiveDirty(): void {
    const t = this.active;
    if (t && !t.dirty) t.dirty = true;
  }

  close(id: string): void {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    dropTabState(id);
    this.tabs.splice(idx, 1);
    if (this.activeId === id) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      if (next) this.activate(next.id);
      else this.newUntitled(); // 始终保留一个缓冲区
    }
  }

  /** 文件在磁盘上被重命名后，同步更新持有该路径的标签页 */
  retargetPath(oldPath: string, newPath: string): void {
    for (const t of this.tabs) {
      if (t.path === oldPath) {
        t.path = newPath;
        t.title = basename(newPath);
      }
    }
  }

  async saveActive(): Promise<boolean> {
    const t = this.active;
    if (!t) return false;
    if (!t.path) return this.saveActiveAs();
    try {
      await writeTextFile(t.path, getActiveText());
      t.savedText = getActiveText();
      t.dirty = false;
      return true;
    } catch (e) {
      status.show(`保存失败：${fmtErr(e)}`);
      return false;
    }
  }

  async saveActiveAs(): Promise<boolean> {
    const t = this.active;
    if (!t) return false;
    const path = await pickSavePath(t.path ? t.title : '未命名.md');
    if (!path) return false;
    try {
      await writeTextFile(path, getActiveText());
      t.path = path;
      t.title = basename(path);
      t.savedText = getActiveText();
      t.dirty = false;
      return true;
    } catch (e) {
      status.show(`保存失败：${fmtErr(e)}`);
      return false;
    }
  }
}

export const tabs = new TabsStore();
