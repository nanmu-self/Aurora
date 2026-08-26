import { invoke } from '@tauri-apps/api/core';

/**
 * 所有 Tauri command 的类型化封装层。
 *
 * 规则（执行计划 §4.3）：组件不直接调用 invoke()，一律经由本目录的封装函数；
 * M1 起按域拆分文件：fs.ts / watch.ts / dialog.ts ...
 */

/** 后端连通性自检（脚手架自带命令，M0 用于验证 IPC 链路）。 */
export function greet(name: string): Promise<string> {
  return invoke('greet', { name });
}

/** 退出应用（仅在「未保存保护」确认之后调用）。 */
export function exitApp(): Promise<void> {
  return invoke('exit_app');
}
