/**
 * 应用设置状态。
 *
 * 主题三态：跟随系统 / 浅色 / 深色；
 * 实际生效主题（resolved）由 +layout.svelte 的 $effect 同步到 <html data-theme>。
 * 存储键 'aurora.theme' 同时被 app.html 的首屏脚本读取（防闪屏），改名需两处同步。
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'aurora.theme';

function loadSavedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* 隐私模式等场景下静默降级 */
  }
  return 'system';
}

class SettingsStore {
  /** 用户偏好（持久化到 localStorage） */
  mode = $state<ThemeMode>(loadSavedMode());

  /** 系统当前是否深色（监听实时变化） */
  #systemDark = $state(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true,
  );

  constructor() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
      this.#systemDark = e.matches;
    });
  }

  /** 当前实际生效的主题 */
  get resolved(): ResolvedTheme {
    if (this.mode === 'system') return this.#systemDark ? 'dark' : 'light';
    return this.mode;
  }

  set(mode: ThemeMode): void {
    this.mode = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* 同 loadSavedMode */
    }
  }

  /** 在深 / 浅之间切换（标题栏的主题按钮） */
  toggle(): void {
    this.set(this.resolved === 'dark' ? 'light' : 'dark');
  }
}

export const settings = new SettingsStore();
