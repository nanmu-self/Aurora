<script lang="ts">
  /**
   * 全局右键菜单：接管 WKWebView 的原生（英文）上下文菜单。
   *
   * - 文件树自己的右键菜单会先 preventDefault，本组件让行；
   * - 编辑器内的剪切/拷贝/粘贴不走 execCommand（点击菜单会丢焦点与 DOM 选区），
   *   而是直接读写 CM6 选区 + 系统剪贴板；
   * - 预览区等只读位置：有选区时给「拷贝」，无选区则不弹菜单（保持安静）。
   */
  import ContextMenu from './ContextMenu.svelte';
  import type { MenuItem } from './ContextMenu.svelte';
  import { closeAllContextMenus } from './menuBus';
  import { deleteSelection, runEditorAction, selectedText } from '$lib/editor/actions';
  import { getView, insertAtCursor } from '$lib/editor/bridge';
  import { readClipboardText, writeClipboardText } from '$lib/commands/clipboard';
  import { ai } from '$lib/stores/ai.svelte';

  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);

  function copyText(text: string): void {
    if (!text) return;
    void writeClipboardText(text).catch((err) => console.warn('[aurora] 写入剪贴板失败', err));
  }

  async function pasteIntoEditor(): Promise<void> {
    try {
      const text = await readClipboardText();
      if (text) insertAtCursor(text);
      getView()?.focus();
    } catch (err) {
      console.warn('[aurora] 读取剪贴板失败', err);
    }
  }

  function editorItems(sel: string): MenuItem[] {
    const items: MenuItem[] = [];
    if (sel) {
      items.push({
        label: '剪切',
        action: () => {
          copyText(sel);
          deleteSelection();
        },
      });
      items.push({ label: '拷贝', action: () => copyText(sel) });
      items.push({ label: 'AI 优化…', action: () => ai.optimizeFromSelection() });
    }
    items.push({ label: '粘贴', action: () => void pasteIntoEditor() });
    items.push({ separator: true, label: '' });
    items.push({ label: '全选', action: () => runEditorAction('selectAll') });
    return items;
  }

  function onContextmenu(e: MouseEvent): void {
    if (e.defaultPrevented) {
      // 文件树等已弹出自己的菜单
      menu = null;
      return;
    }

    const target = e.target as HTMLElement | null;
    const inEditor = !!target?.closest?.('.cm-editor');
    const items = inEditor
      ? editorItems(selectedText())
      : (() => {
          const sel = window.getSelection()?.toString() ?? '';
          return sel ? [{ label: '拷贝', action: () => copyText(sel) } satisfies MenuItem] : [];
        })();

    e.preventDefault(); // 无论是否弹菜单，都要压掉 WebKit 的英文原生菜单
    if (items.length === 0) {
      menu = null;
      return;
    }

    closeAllContextMenus();
    menu = { x: e.clientX, y: e.clientY, items };
  }
</script>

<svelte:window oncontextmenu={onContextmenu} />

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}
