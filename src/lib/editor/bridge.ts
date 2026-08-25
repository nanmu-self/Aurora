import type { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { historyCompartment } from '$lib/editor/setup';

/**
 * 编辑器 ↔ 外部世界的桥：
 * - EditorView 实例不进 Svelte 响应式系统（§4.3 原则 2：正文唯一事实源是 CM6 State）；
 * - 文档变更通过命令式事件通知预览，绝不把正文镜像进 rune。
 */

type Listener = () => void;

let activeView: EditorView | null = null;
const listeners = new Set<Listener>();

export function setActiveView(view: EditorView | null): void {
  activeView = view;
}

/** 当前活动编辑器的全文（仅在防抖回调 / 保存等离散时机调用） */
export function getActiveText(): string {
  return activeView ? activeView.state.doc.toString() : '';
}

/**
 * 用给定文本整体替换当前文档（打开文件 / 新建缓冲区）。
 * 先摘掉 history 再装回 —— 撤销栈随旧文档一起丢弃。
 */
export function replaceActiveDoc(text: string): void {
  if (!activeView) return;
  const { state } = activeView;
  activeView.dispatch({ effects: historyCompartment.reconfigure([]) });
  activeView.dispatch({
    changes: { from: 0, to: state.doc.length, insert: text },
  });
  activeView.dispatch({ effects: historyCompartment.reconfigure(history()) });
}

/** 编辑器文档变更后广播（调用方负责防抖） */
export function notifyDocChanged(): void {
  for (const fn of listeners) fn();
}

/** 订阅文档变更，返回退订函数 */
export function onDocChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
