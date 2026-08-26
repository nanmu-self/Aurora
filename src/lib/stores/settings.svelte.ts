/**
 * 应用设置状态（M4 设置页数据源）。
 *
 * - 主题三态沿用独立键 'aurora.theme'（app.html 首屏脚本依赖它防闪屏，勿改名）；
 * - 其余设置统一持久化到 'aurora.settings'；
 * - 实际生效主题（resolved）由 +layout.svelte 的 $effect 同步到 <html data-theme>。
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'aurora.theme';
const SETTINGS_KEY = 'aurora.settings';

export interface ExtraSettings {
  /** 自动保存开关 */
  autosaveEnabled: boolean;
  /** 自动保存延迟（毫秒） */
  autosaveDelayMs: number;
  /** 编辑器字号（px） */
  editorFontSize: number;
  /** 双栏滚动同步开关 */
  scrollSync: boolean;
}

const EXTRA_DEFAULTS: ExtraSettings = {
  autosaveEnabled: true,
  autosaveDelayMs: 1500,
  editorFontSize: 14,
  scrollSync: true,
};

function loadSavedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* 静默降级 */
  }
  return 'system';
}

function loadExtras(): ExtraSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExtraSettings>;
      return { ...EXTRA_DEFAULTS, ...parsed };
    }
  } catch {
    /* 静默降级 */
  }
  return { ...EXTRA_DEFAULTS };
}

class SettingsStore {
  /** 用户主题偏好（持久化） */
  mode = $state<ThemeMode>(loadSavedMode());

  autosaveEnabled = $state<boolean>(loadExtras().autosaveEnabled);
  autosaveDelayMs = $state<number>(loadExtras().autosaveDelayMs);
  editorFontSize = $state<number>(loadExtras().editorFontSize);
  scrollSync = $state<boolean>(loadExtras().scrollSync);

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
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* 同 loadSavedMode */
    }
  }

  /** 在深 / 浅之间切换（标题栏的主题按钮） */
  toggle(): void {
    this.set(this.resolved === 'dark' ? 'light' : 'dark');
  }

  /** 更新附加设置并持久化 */
  update(patch: Partial<ExtraSettings>): void {
    if (patch.autosaveEnabled !== undefined) this.autosaveEnabled = patch.autosaveEnabled;
    if (patch.autosaveDelayMs !== undefined) this.autosaveDelayMs = patch.autosaveDelayMs;
    if (patch.editorFontSize !== undefined) this.editorFontSize = patch.editorFontSize;
    if (patch.scrollSync !== undefined) this.scrollSync = patch.scrollSync;
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          autosaveEnabled: this.autosaveEnabled,
          autosaveDelayMs: this.autosaveDelayMs,
          editorFontSize: this.editorFontSize,
          scrollSync: this.scrollSync,
        }),
      );
    } catch {
      /* 静默降级 */
    }
  }
}

export const settings = new SettingsStore();
