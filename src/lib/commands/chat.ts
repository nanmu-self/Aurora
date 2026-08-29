import { invoke } from '@tauri-apps/api/core';

/**
 * 聊天记录持久化命令封装（SQLite，Rust 侧 chatdb.rs）。
 * 浏览器调试环境（非 Tauri）调用会失败，调用方需 catch 静默降级。
 */

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ChatMessageRow {
  role: 'user' | 'assistant';
  content: string;
  quote: string | null;
  createdAt: number;
}

export function chatCreateSession(title: string): Promise<ChatSessionMeta> {
  return invoke('chat_create_session', { title });
}

export function chatAppendMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  quote?: string | null,
): Promise<void> {
  return invoke('chat_append_message', { sessionId, role, content, quote: quote ?? null });
}

export function chatListSessions(): Promise<ChatSessionMeta[]> {
  return invoke('chat_list_sessions');
}

export function chatGetMessages(sessionId: string): Promise<ChatMessageRow[]> {
  return invoke('chat_get_messages', { sessionId });
}

export function chatDeleteSession(sessionId: string): Promise<void> {
  return invoke('chat_delete_session', { sessionId });
}
