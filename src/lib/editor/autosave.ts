import { onDocChanged } from './bridge';
import { tabs } from '$lib/stores/tabs.svelte';
import { settings } from '$lib/stores/settings.svelte';

/**
 * 自动保存（M3）：文档变更后延迟触发，仅对已落盘文件生效。
 * 开关与延迟在设置页可调（M4）；成功静默 —— 状态栏圆点已表达状态。
 */

let timer: ReturnType<typeof setTimeout> | undefined;

export function initAutosave(): void {
  onDocChanged(() => {
    clearTimeout(timer);
    const t = tabs.active;
    if (!settings.autosaveEnabled || !t?.path || !t.dirty) return;
    timer = setTimeout(
      () => {
        void tabs.saveActive();
      },
      Math.max(300, settings.autosaveDelayMs),
    );
  });
}

/** 检测到外部变更时调用：放弃挂起的自动保存，避免旧内容覆盖外部修改 */
export function cancelAutosave(): void {
  clearTimeout(timer);
}
