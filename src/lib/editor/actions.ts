/**
 * 编辑器命名动作：供菜单栏 / 右键菜单调用（快捷键路径仍走 CM6 keymap）。
 *
 * macOS 上菜单项一旦声明了快捷键，按键会被菜单栏截获、不再进入 WebView，
 * 因此这些动作必须能从菜单事件侧复现。
 */
import { redo, selectAll, undo } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { getView } from './bridge';
import { mdCommands } from './setup';

export type EditorAction =
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'find'
  | 'selectAll'
  | 'undo'
  | 'redo';

export function runEditorAction(action: EditorAction): boolean {
  const view = getView();
  if (!view) return false;
  view.focus();

  switch (action) {
    case 'bold':
      return mdCommands.bold(view);
    case 'italic':
      return mdCommands.italic(view);
    case 'code':
      return mdCommands.code(view);
    case 'link':
      return mdCommands.link(view);
    case 'find':
      return openSearchPanel(view);
    case 'selectAll':
      return selectAll(view);
    case 'undo':
      return undo(view);
    case 'redo':
      return redo(view);
  }
}

/** 当前选中的正文（无选区时返回空串）。 */
export function selectedText(): string {
  const view = getView();
  if (!view) return '';
  const { from, to } = view.state.selection.main;
  return from === to ? '' : view.state.sliceDoc(from, to);
}

/** 删除当前选区（剪切的第二步）。 */
export function deleteSelection(): void {
  const view = getView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  if (from === to) return;
  view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from } });
  view.focus();
}
