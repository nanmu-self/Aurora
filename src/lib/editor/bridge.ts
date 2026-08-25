import { EditorState } from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { createExtensions } from './setup';

/**
 * 编辑器 ↔ 外部世界的桥（M2 升级为多标签会话管理）：
 *
 * - 每个标签页持有独立的 EditorState（含各自的 history 撤销栈与光标位置），
 *   切换标签用 view.setState() 无损换入换出 —— CM6 官方推荐的多文档模式；
 * - 正文唯一事实源是 EditorState（§4.3 原则 2），绝不把正文镜像进 rune；
 * - 文档变更通过命令式事件广播给预览（调用方负责防抖）。
 */

type Listener = () => void;

let view: EditorView | null = null;
let currentId: string | null = null;
let makeState: ((text: string) => EditorState) | null = null;

/** tabId → 该标签的完整编辑器状态 */
const states = new Map<string, EditorState>();

const listeners = new Set<Listener>();

/* ---------------- 生命周期 ---------------- */

/** 必须在创建视图前调用；onUpdate 为编辑器统一更新回调 */
export function initEditor(onUpdate: (u: ViewUpdate) => void): void {
  makeState = (text = '') =>
    EditorState.create({
      doc: text,
      extensions: [...createExtensions(), EditorView.updateListener.of(onUpdate)],
    });
}

export function mountView(parent: HTMLElement): void {
  if (!makeState) throw new Error('[aurora] initEditor() must be called before mountView()');
  view = new EditorView({ parent, state: makeState('') });
}

export function unmountView(): void {
  view?.destroy();
  view = null;
  currentId = null;
  states.clear();
}

/* ---------------- 标签页状态 ---------------- */

/** 为标签预建状态（打开文件时携带全文；新建缓冲区传 ''） */
export function addTabState(id: string, text: string): void {
  if (!makeState) throw new Error('[aurora] initEditor() must be called first');
  states.set(id, makeState(text));
}

/** 切换到目标标签：当前视图状态存回，目标状态换入 */
export function focusTab(id: string): void {
  if (!view || !makeState) return;
  if (currentId === id) return;
  if (currentId !== null) {
    states.set(currentId, view.state);
  }
  let st = states.get(id);
  if (!st) {
    st = makeState('');
    states.set(id, st);
  }
  view.setState(st);
  currentId = id;
}

/** 标签关闭后释放其状态 */
export function dropTabState(id: string): void {
  states.delete(id);
}

/* ---------------- 只读访问与广播 ---------------- */

export function getActiveText(): string {
  return view ? view.state.doc.toString() : '';
}

/** 激活标签的状态指标（切标签后回填状态栏用） */
export function activeMetrics(): { chars: number; ln: number; col: number } {
  if (!view) return { chars: 0, ln: 1, col: 1 };
  const { state } = view;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return { chars: state.doc.length, ln: line.number, col: head - line.from + 1 };
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
