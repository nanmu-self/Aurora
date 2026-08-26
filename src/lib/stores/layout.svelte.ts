/**
 * 布局尺寸状态：侧栏宽度 + 编辑区/预览区比例，持久化到 'aurora.layout'。
 *
 * 约束（防止拖到不可用）：
 * - 侧栏 168–560px；
 * - 分栏比例 0.15–0.85（编辑区占比）。
 */

const LAYOUT_KEY = 'aurora.layout';

export const SIDEBAR_DEFAULT = 232;
export const SIDEBAR_MIN = 168;
export const SIDEBAR_MAX = 560;
export const RATIO_DEFAULT = 0.5;
export const RATIO_MIN = 0.15;
export const RATIO_MAX = 0.85;

interface Saved {
  sidebarWidth: number;
  splitRatio: number;
  sidebarCollapsed: boolean;
  viewMode: ViewMode;
}

/** 分栏 / 仅编辑区 / 仅预览区 */
export type ViewMode = 'split' | 'editor' | 'preview';

function isViewMode(v: unknown): v is ViewMode {
  return v === 'split' || v === 'editor' || v === 'preview';
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function load(): Saved {
  const fallback: Saved = {
    sidebarWidth: SIDEBAR_DEFAULT,
    splitRatio: RATIO_DEFAULT,
    sidebarCollapsed: false,
    viewMode: 'split',
  };
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Saved>;
      return {
        sidebarWidth: clamp(Number(p.sidebarWidth) || SIDEBAR_DEFAULT, SIDEBAR_MIN, SIDEBAR_MAX),
        splitRatio: clamp(Number(p.splitRatio) || RATIO_DEFAULT, RATIO_MIN, RATIO_MAX),
        sidebarCollapsed: p.sidebarCollapsed === true,
        viewMode: isViewMode(p.viewMode) ? p.viewMode : 'split',
      };
    }
  } catch {
    /* 静默降级 */
  }
  return fallback;
}

class LayoutStore {
  sidebarWidth = $state(SIDEBAR_DEFAULT);
  splitRatio = $state(RATIO_DEFAULT);
  sidebarCollapsed = $state(false);
  viewMode = $state<ViewMode>('split');

  /** 拖动中：用于给 body 加 col-resize 光标、暂停过渡 */
  dragging = $state(false);

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof localStorage === 'undefined') return;
    const saved = load();
    this.sidebarWidth = saved.sidebarWidth;
    this.splitRatio = saved.splitRatio;
    this.sidebarCollapsed = saved.sidebarCollapsed;
    this.viewMode = saved.viewMode;
  }

  /** 编辑区是否可见（仅预览模式下隐藏，但始终保持挂载） */
  get editorVisible(): boolean {
    return this.viewMode !== 'preview';
  }

  /** 预览区是否可见（仅编辑模式下卸载，省掉后台渲染） */
  get previewVisible(): boolean {
    return this.viewMode !== 'editor';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.#persist();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.#persist();
  }

  /** 在三种模式间循环：分栏 → 仅编辑 → 仅预览 */
  cycleViewMode(): void {
    const order: ViewMode[] = ['split', 'editor', 'preview'];
    this.setViewMode(order[(order.indexOf(this.viewMode) + 1) % order.length]);
  }

  setSidebarWidth(px: number): void {
    this.sidebarWidth = clamp(Math.round(px), SIDEBAR_MIN, SIDEBAR_MAX);
    this.#persist();
  }

  setSplitRatio(ratio: number): void {
    this.splitRatio = clamp(ratio, RATIO_MIN, RATIO_MAX);
    this.#persist();
  }

  resetSidebar(): void {
    this.setSidebarWidth(SIDEBAR_DEFAULT);
  }

  resetSplit(): void {
    this.setSplitRatio(RATIO_DEFAULT);
  }

  /** 拖动期间每帧都在改，写盘防抖 250ms */
  #persist(): void {
    if (typeof localStorage === 'undefined') return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      try {
        localStorage.setItem(
          LAYOUT_KEY,
          JSON.stringify({
            sidebarWidth: this.sidebarWidth,
            splitRatio: this.splitRatio,
            sidebarCollapsed: this.sidebarCollapsed,
            viewMode: this.viewMode,
          }),
        );
      } catch {
        /* 静默降级 */
      }
    }, 250);
  }
}

export const layout = new LayoutStore();
