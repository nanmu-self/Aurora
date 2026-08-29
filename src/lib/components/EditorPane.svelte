<script lang="ts">
  import { onMount } from 'svelte';
  import type { ViewUpdate } from '@codemirror/view';
  import { initEditor, mountView, unmountView, notifyDocChanged, getView } from '$lib/editor/bridge';
  import { imageDropPasteExtension } from '$lib/editor/images';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';
  import { ai } from '$lib/stores/ai.svelte';

  /**
   * 编辑区：CM6 挂载点。
   * 多标签的关键在 bridge：每个标签持有独立 EditorState（含各自撤销栈与光标），
   * 切换用 view.setState() 无损换入换出。
   * S1 IME 约束依旧成立：预览通知走防抖，update 回调内绝无同步重渲染。
   */
  const PREVIEW_DEBOUNCE_MS = 180;

  interface Props {
    /**
     * 是否可见（仅预览模式下为 false）。
     * 注意：这里只能用 CSS 隐藏而不能卸载——unmountView() 会销毁视图并
     * clear 所有标签的 EditorState（含正文与撤销栈）。
     */
    visible?: boolean;
  }

  let { visible = true }: Props = $props();

  let host: HTMLElement;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  /* ---------------- 选区浮动「加入 AI」按钮 ---------------- */

  /** 按钮位置（viewport 坐标，position:fixed）；null = 不显示 */
  let quoteBtn = $state<{ x: number; y: number } | null>(null);
  let quoteTimer: ReturnType<typeof setTimeout> | undefined;

  /** 拖拽选择期间 selectionSet 连续触发，防抖到选区稳定后再浮现 */
  function scheduleQuoteButton(): void {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(updateQuoteButton, 300);
  }

  function updateQuoteButton(): void {
    const view = getView();
    if (!view || !visible) {
      quoteBtn = null;
      return;
    }
    const { from, to } = view.state.selection.main;
    if (from === to) {
      quoteBtn = null;
      return;
    }
    const coords = view.coordsAtPos(to);
    if (!coords) {
      quoteBtn = null;
      return;
    }
    quoteBtn = { x: coords.left, y: coords.bottom };
  }

  /** mousedown 抢先 preventDefault，避免点击按钮时编辑器丢焦点丢选区 */
  function quoteToChat(): void {
    ai.quoteSelection();
    quoteBtn = null;
  }

  function onUpdate(u: ViewUpdate): void {
    if (u.docChanged) {
      tabs.markActiveDirty();
      status.chars = u.state.doc.length;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(notifyDocChanged, PREVIEW_DEBOUNCE_MS);
    }
    if (u.docChanged || u.selectionSet) {
      const head = u.state.selection.main.head;
      const line = u.state.doc.lineAt(head);
      status.ln = line.number;
      status.col = head - line.from + 1;
    }
    if (u.selectionSet) scheduleQuoteButton();
  }

  onMount(() => {
    initEditor(onUpdate, [imageDropPasteExtension()]);
    mountView(host);
    notifyDocChanged(); // 初始空渲染

    // 编辑区滚动时按钮坐标已失效，直接隐藏（下次 selectionSet 再浮现）
    const onHide = () => (quoteBtn = null);
    host.addEventListener('scroll', onHide, true);

    return () => {
      clearTimeout(previewTimer);
      clearTimeout(quoteTimer);
      host.removeEventListener('scroll', onHide, true);
      unmountView();
    };
  });
  /* 从隐藏恢复可见时，CM6 需要重新量测几何（display:none 期间尺寸为 0） */
  $effect(() => {
    if (visible) getView()?.requestMeasure();
    else quoteBtn = null;
  });
</script>

<section class="editor-pane" class:hidden={!visible}>
  <div class="editor-host" bind:this={host}></div>
  {#if quoteBtn}
    <button
      class="quote-btn"
      style:left="{quoteBtn.x}px"
      style:top="{quoteBtn.y + 6}px"
      onmousedown={(e) => e.preventDefault()}
      onclick={quoteToChat}
      title="把选中文本引用到 AI 对话框"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
      加入 AI
    </button>
  {/if}
</section>

<style>
  .editor-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    background: var(--bg-content);
  }

  /* display:none 的元素不参与 grid 布局，预览区会自然占满唯一列 */
  .editor-pane.hidden {
    display: none;
  }

  .editor-host {
    position: relative; /* CM6 视图绝对定位填满，彻底摆脱百分比链 */
    flex: 1;
    min-height: 0;
    overflow: hidden;
    cursor: text;
  }

  .editor-host :global(.cm-editor) {
    position: absolute;
    inset: 0;
  }

  /* 选区浮动按钮：fixed 按 viewport 坐标贴在选区末端下方 */
  .quote-btn {
    position: fixed;
    z-index: var(--z-popover);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 11.5px;
    font-weight: 500;
    color: #10141c;
    background: var(--aurora-gradient);
    border-radius: 999px;
    box-shadow: 0 4px 14px rgb(0 0 0 / 28%);
    transition: filter var(--dur-fast) var(--ease-out);
    user-select: none;
  }

  .quote-btn:hover {
    filter: brightness(1.06);
  }

  .quote-btn svg {
    width: 12px;
    height: 12px;
  }
</style>
