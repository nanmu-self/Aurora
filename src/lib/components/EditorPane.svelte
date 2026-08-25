<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorState } from '@codemirror/state';
  import { EditorView, type ViewUpdate } from '@codemirror/view';
  import { createExtensions } from '$lib/editor/setup';
  import { notifyDocChanged, setActiveView } from '$lib/editor/bridge';
  import { doc } from '$lib/stores/doc.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';

  /**
   * 编辑区：CM6 挂载点（M1）。
   * §4.6-C / S1 IME Spike 的关键约束在 onUpdate 里：
   * 预览通知走防抖，任何情况下都不在 update 回调里做同步重渲染。
   */
  const PREVIEW_DEBOUNCE_MS = 180;

  let host: HTMLElement;
  let view: EditorView | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  function onUpdate(u: ViewUpdate): void {
    if (u.docChanged) {
      doc.dirty = true;
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
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        extensions: [...createExtensions(), EditorView.updateListener.of(onUpdate)],
      }),
    });
    setActiveView(view);
    notifyDocChanged(); // 初始空渲染

    return () => {
      clearTimeout(previewTimer);
      setActiveView(null);
      view?.destroy();
      view = null;
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
    flex: 1;
    min-height: 0;
    overflow: hidden;
    cursor: text;
  }

  .editor-host :global(.cm-editor) {
    height: 100%;
  }
</style>
