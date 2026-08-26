import {
  allowWorkspaceAssets,
  createEntry,
  deleteEntry,
  listDir,
  pathExists,
  pickWorkspaceDir,
  renameEntry,
  unwatchAll,
  watchWorkspace,
  type DirEntry,
  type EntryKind,
} from '$lib/commands/fs';
import { basename, join } from '$lib/path';
import { status } from '$lib/stores/editorStatus.svelte';

const RECENTS_KEY = 'aurora.recent-workspaces';
const RECENTS_MAX = 8;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

/** 目录树中渲染用的扁平行 */
export interface TreeRow extends DirEntry {
  depth: number;
}

export interface PendingCreate {
  parent: string;
  kind: EntryKind;
}

/**
 * 工作区状态：根目录、懒加载目录树、展开记录、最近工作区。
 *
 * 设计要点：
 * - 树是「按需加载」的：只有展开时才 list_dir，children 记录在
 *   Record<dirPath, entries[]>，展开态在 Record<path, boolean>；
 * - 打开工作区时调用 Rust 侧 allow_workspace_assets 动态授权 asset 协议（§4.6-A / S2）；
 * - 重命名/删除目录后要清掉其子树的所有展开与缓存记录。
 */
class WorkspaceStore {
  root = $state<string | null>(null);
  children = $state<Record<string, DirEntry[]>>({});
  expanded = $state<Record<string, boolean>>({});
  loadingDirs = $state<Record<string, boolean>>({});
  recents = $state<string[]>(loadRecents());

  /** 行内新建输入的目标位置（侧栏工具按钮与右键菜单共用） */
  pendingCreate = $state<PendingCreate | null>(null);

  get name(): string {
    return this.root ? basename(this.root) : '';
  }

  #persistRecents(): void {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(this.recents));
    } catch {
      /* 静默降级 */
    }
  }

  /** 打开工作区：授权 asset 协议 → 开启监听 → 重置树 → 加载根级 */
  async open(rootPath: string): Promise<void> {
    try {
      await allowWorkspaceAssets(rootPath);
    } catch (e) {
      // 授权失败不阻断工作区使用，仅影响图片渲染
      status.show(`asset 授权失败：${String(e)}`);
    }
    try {
      await watchWorkspace(rootPath);
    } catch (e) {
      // 监听失败不阻断使用，仅失去外部变更感知
      status.show(`文件监听未开启：${String(e)}`);
    }
    this.root = rootPath;
    this.children = {};
    this.expanded = { [rootPath]: true };
    this.loadingDirs = {};
    this.recents = [rootPath, ...this.recents.filter((p) => p !== rootPath)].slice(0, RECENTS_MAX);
    this.#persistRecents();
    await this.refreshDir(rootPath);
  }

  async pickAndOpen(): Promise<void> {
    const dir = await pickWorkspaceDir();
    if (!dir) return;
    await this.open(dir);
  }

  /** 点击最近列表项：先校验目录仍存在，失效则从列表剔除 */
  async openRecent(path: string): Promise<void> {
    let ok = false;
    try {
      ok = await pathExists(path);
    } catch {
      ok = false;
    }
    if (!ok) {
      this.recents = this.recents.filter((p) => p !== path);
      this.#persistRecents();
      status.show('该文件夹不存在，已从最近列表移除');
      return;
    }
    await this.open(path);
  }

  close(): void {
    this.root = null;
    this.children = {};
    this.expanded = {};
    this.loadingDirs = {};
    void unwatchAll().catch(() => {});
  }

  async refreshDir(dir: string): Promise<void> {
    this.loadingDirs[dir] = true;
    try {
      this.children[dir] = await listDir(dir);
    } catch (e) {
      status.show(String(e));
    } finally {
      delete this.loadingDirs[dir];
    }
  }

  /** 刷新所有已加载的层级 */
  async refreshAll(): Promise<void> {
    if (!this.root) return;
    const dirs = [this.root, ...Object.keys(this.expanded).filter((k) => this.expanded[k])];
    await Promise.all([...new Set(dirs)].map((d) => this.refreshDir(d)));
  }

  toggle(path: string): void {
    if (this.expanded[path]) {
      this.expanded[path] = false;
      return;
    }
    this.expanded[path] = true;
    if (!this.children[path]) void this.refreshDir(path);
  }

  collapseAll(): void {
    if (!this.root) return;
    this.expanded = { [this.root]: true };
  }

  /** 在指定目录下发起行内新建（展开目录并定位输入框） */
  startCreate(parent: string, kind: EntryKind): void {
    this.expanded[parent] = true;
    if (!this.children[parent]) void this.refreshDir(parent);
    this.pendingCreate = { parent, kind };
  }

  #purgeSubtree(path: string): void {
    for (const key of Object.keys(this.expanded)) {
      if (key === path || key.startsWith(`${path}/`)) delete this.expanded[key];
    }
    for (const key of Object.keys(this.children)) {
      if (key === path || key.startsWith(`${path}/`)) delete this.children[key];
    }
  }

  /** 在指定目录下新建；返回完整路径（供调用方决定是否打开） */
  async create(parent: string, name: string, kind: EntryKind): Promise<string | null> {
    const path = join(parent, name);
    try {
      await createEntry(path, kind);
      await this.refreshDir(parent);
      return path;
    } catch (e) {
      status.show(String(e));
      return null;
    }
  }

  /** 重命名；返回新路径（失败返回 null） */
  async rename(oldPath: string, newName: string): Promise<string | null> {
    const parent = oldPath.slice(0, oldPath.lastIndexOf('/')) || '/';
    try {
      const newPath = await renameEntry(oldPath, newName);
      this.#purgeSubtree(oldPath); // 子树缓存全部失效
      await this.refreshDir(parent);
      return newPath;
    } catch (e) {
      status.show(String(e));
      return null;
    }
  }

  /** 删除（进废纸篓）；parent 用于刷新所在层 */
  async remove(path: string, parent: string): Promise<void> {
    try {
      await deleteEntry(path);
      this.#purgeSubtree(path);
      await this.refreshDir(parent);
    } catch (e) {
      status.show(String(e));
    }
  }
}

export const workspace = new WorkspaceStore();
