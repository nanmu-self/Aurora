import { onDocChanged } from './bridge';
import { tabs } from '$lib/stores/tabs.svelte';

/**
 * 自动保存（M3）：文档变更后延迟触发，仅对已落盘文件生效。
 * 成功静默 —— 状态栏圆点已经表达保存状态，不弹提示打扰写作。
 * 延迟阈值等配置项在 M4 设置页开放。
 */

const AUTOSAVE_DELAY_MS = 1500;

let timer: ReturnType<typeof setTimeout> | undefined;

export function initAutosave(): void {
  onDocChanged(() => {
    clearTimeout(timer);
    const t = tabs.active;
    if (!t?.path || !t.dirty) return;
    timer = setTimeout(() => {
      void tabs.saveActive();
    }, AUTOSAVE_DELAY_MS);
  });
}

/** 检测到外部变更时调用：放弃挂起的自动保存，避免旧内容覆盖外部修改 */
export function cancelAutosave(): void {
  clearTimeout(timer);
}
