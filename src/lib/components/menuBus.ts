/** 关闭所有右键菜单的广播事件名（新菜单打开前先广播一次） */
export const CLOSE_MENUS_EVENT = 'aurora-menu-close';

export function closeAllContextMenus(): void {
  window.dispatchEvent(new CustomEvent(CLOSE_MENUS_EVENT));
}
