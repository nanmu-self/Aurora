/** 纯 UI 状态（不持久化）。 */

class UiStore {
  /** 侧栏活动页签：文件树（M2 接入真实数据）/ 大纲（M3 接入） */
  sidebarTab = $state<'files' | 'outline'>('files');
}

export const ui = new UiStore();
