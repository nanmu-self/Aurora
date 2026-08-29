import { invoke, Channel } from '@tauri-apps/api/core';

/**
 * AI 命令封装（OpenAI 兼容协议，Rust 侧代理请求）。
 * 浏览器调试环境（非 Tauri）调用会失败，调用方先用 inTauri() 判断。
 */

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Rust 侧约定的「用户主动取消」错误文本 */
export const AI_CANCELLED = '__AURORA_CANCELLED__';

/** 流式对话：onDelta 逐段收到增量文本，resolve 为完整文本 */
export function aiChat(
  config: AiConfig,
  messages: AiChatMessage[],
  onDelta: (delta: string) => void,
): Promise<string> {
  const channel = new Channel<string>();
  channel.onmessage = onDelta;
  return invoke('ai_chat', { config, messages, onDelta: channel });
}

/** 非流式最小请求（设置页「测试连接」用），返回模型回复 */
export function aiTest(config: AiConfig): Promise<string> {
  return invoke('ai_test', { config });
}

/** 中止进行中的 ai_chat */
export function aiCancel(): Promise<void> {
  return invoke('ai_cancel');
}
