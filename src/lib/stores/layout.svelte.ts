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
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Saved>;
      return {
        sidebarWidth: clamp(Number(p.sidebarWidth) || SIDEBAR_DEFAULT, SIDEBAR_MIN, SIDEBAR_MAX),
        splitRatio: clamp(Number(p.splitRatio) || RATIO_DEFAULT, RATIO_MIN, RATIO_MAX),
      };
    }
  } catch {
    /* 静默降级 */
  }
  return { sidebarWidth: SIDEBAR_DEFAULT, splitRatio: RATIO_DEFAULT };
}

class LayoutStore {
  sidebarWidth = $state(SIDEBAR_DEFAULT);
  splitRatio = $state(RATIO_DEFAULT);

  /** 拖动中：用于给 body 加 col-resize 光标、暂停过渡 */
  dragging = $state(false);

  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof localStorage === 'undefined') return;
    const saved = load();
    this.sidebarWidth = saved.sidebarWidth;
    this.splitRatio = saved.splitRatio;
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
          JSON.stringify({ sidebarWidth: this.sidebarWidth, splitRatio: this.splitRatio }),
        );
      } catch {
        /* 静默降级 */
      }
    }, 250);
  }
}

export const layout = new LayoutStore();
