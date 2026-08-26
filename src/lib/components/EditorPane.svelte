<script lang="ts">
  import { onMount } from 'svelte';
  import type { ViewUpdate } from '@codemirror/view';
  import { initEditor, mountView, unmountView, notifyDocChanged } from '$lib/editor/bridge';
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
</script>

<section class="editor-pane">
  <div class="editor-host" bind:this={host}></div>
</section>

<style>
  .editor-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    background: var(--bg-content);
    border-right: 1px solid var(--border-subtle);
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
