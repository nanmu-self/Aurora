/**
 * 运行时平台检测工具。
 *
 * 背景与结论：
 * - Tauri v2 程序内总是注入 `window.isTauri = true` 与 `window.__TAURI_INTERNALS__`，
 *   而纯浏览器（访问 devUrl / pnpm dev 预览）中二者都不存在。
 * - `@tauri-apps/plugin-os` 的 `platform()` 依赖 Rust 侧注册 `tauri-plugin-os`
 *   才会注入 `window.__TAURI_OS_PLUGIN_INTERNALS__`；本项目未注册该插件，
 *   在 Tauri 内调用会抛 `Cannot read properties of undefined (reading 'platform')`。
 * - 因此这里不依赖任何插件，直接用 `navigator.platform`（Tauri WebView 内与浏览器
 *   中都返回真实平台：Windows→Win32、macOS→MacIntel、Linux→Linux...）。
 *
 * `inTauri()` 用 `'__TAURI_INTERNALS__' in window` 检测，供调用方跳过
 * 浏览器下不可用的 Tauri IPC（invoke / listen / dialog 等）。
 */

export function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 返回 'macos' | 'windows' | 'linux' | 其它平台字符串。不依赖任何 Tauri 插件。 */
export function currentPlatform(): string {
  const p =
    typeof navigator !== 'undefined' ? (navigator.platform ?? navigator.userAgent) : '';
  const s = p.toLowerCase();
  if (s.includes('mac')) return 'macos';
  if (s.includes('win')) return 'windows';
  if (s.includes('linux')) return 'linux';
  return 'unknown';
}

export function isMac(): boolean {
  return currentPlatform() === 'macos';
}

export function isWindows(): boolean {
  return currentPlatform() === 'windows';
}
