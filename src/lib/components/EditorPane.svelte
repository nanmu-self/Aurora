<script lang="ts">
  import { onMount } from 'svelte';
  import type { ViewUpdate } from '@codemirror/view';
  import { initEditor, mountView, unmountView, notifyDocChanged, getView } from '$lib/editor/bridge';
  import { imageDropPasteExtension } from '$lib/editor/images';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';

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
  }

  onMount(() => {
    initEditor(onUpdate, [imageDropPasteExtension()]);
    mountView(host);
    notifyDocChanged(); // 初始空渲染

    return () => {
      clearTimeout(previewTimer);
      unmountView();
    };
  });
  /* 从隐藏恢复可见时，CM6 需要重新量测几何（display:none 期间尺寸为 0） */
  $effect(() => {
    if (visible) getView()?.requestMeasure();
  });
</script>

<section class="editor-pane" class:hidden={!visible}>
  <div class="editor-host" bind:this={host}></div>
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
</style>
