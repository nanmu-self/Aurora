<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorView } from '@codemirror/view';
  import { BlockRenderer } from '$lib/markdown/renderer';
  import { getActiveText, getView, onDocChanged } from '$lib/editor/bridge';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { dirname } from '$lib/path';
  import 'katex/dist/katex.min.css';
  import '$lib/styles/prose.css';

  /**
   * 实时预览（§4.6-C）：防抖渲染 + 块级增量 patch；
   * M3 新增双向滚动同步（§4.6-D）：
   * 编辑器行号 ↔ 预览块 data-start-line 锚点，二分定位锚点对后线性插值。
   * 用方向锁防止两侧 scroll 事件互激（程序化滚动引发的事件被忽略）。
   */
  const PREVIEW_DEBOUNCE_MS = 180;
  const SYNC_LOCK_RELEASE_MS = 80;

  let scrollEl: HTMLElement;
  let container: HTMLElement;

  const renderer = new BlockRenderer();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function renderNow(): void {
    const t = tabs.active;
    const baseDir = t?.path ? dirname(t.path) : workspace.root;
    renderer.render(getActiveText(), container, {
      baseDir,
      workspaceRoot: workspace.root,
    });
  }

  function schedule(): void {
    clearTimeout(timer);
    timer = setTimeout(renderNow, PREVIEW_DEBOUNCE_MS);
  }

  /* ---------------- 滚动同步 ---------------- */

  type Lock = 'editor' | 'preview' | null;
  let lock: Lock = null;
  let rafId = 0;

  interface Anchor {
    top: number;
    start: number;
  }

  /** 收集预览块锚点（offsetTop 相对 .preview-col，见样式 position:relative） */
  function anchors(): Anchor[] {
    const list: Anchor[] = [];
    for (const el of Array.from(container.children) as HTMLElement[]) {
      const start = Number(el.dataset.startLine ?? 0);
      if (start > 0) list.push({ top: el.offsetTop, start });
    }
    list.sort((a, b) => a.start - b.start);
    return list;
  }

  const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

  function releaseSoon(k: Exclude<Lock, null>): void {
    setTimeout(() => {
      if (lock === k) lock = null;
    }, SYNC_LOCK_RELEASE_MS);
  }

  function editorToPreview(): void {
    if (!settings.scrollSync) return;
    const v = getView();
    if (!v || !scrollEl || !container) return;
    if (v.scrollDOM.scrollHeight <= v.scrollDOM.clientHeight + 2) return;
    const bs = anchors();
    if (bs.length === 0) return;

    const h = v.scrollDOM.scrollTop;
    const blk = v.lineBlockAtHeight(h);
    const line = v.state.doc.lineAt(blk.from).number;
    // 行内像素占比近似为小数行，参与插值让同步更顺滑
    const L = line + clamp01((h - blk.top) / Math.max(blk.height, 1));

    let hi = bs.findIndex((b) => b.start >= line);
    if (hi === -1) hi = bs.length - 1;
    const lo = Math.max(hi - 1, 0);
    const a = bs[lo];
    const b2 = bs[hi];
    const span = b2.start - a.start;
    const target =
      a === b2 ? a.top : a.top + ((L - a.start) / span) * (b2.top - a.top);

    lock = 'editor';
    scrollEl.scrollTop = Math.max(target - 12, 0);
    releaseSoon('editor');
  }

  function previewToEditor(): void {
    if (!settings.scrollSync) return;
    const v = getView();
    if (!v) return;
    if (scrollEl.scrollHeight <= scrollEl.clientHeight + 2) return;
    const bs = anchors();
    if (bs.length === 0) return;

    const st = scrollEl.scrollTop;
    let hi = bs.findIndex((b) => b.top > st);
    if (hi === -1) hi = bs.length - 1;
    const lo = Math.max(hi - 1, 0);
    const a = bs[lo];
    const b2 = bs[hi];
    const span = b2.top - a.top;
    const t = a === b2 ? 0 : clamp01((st - a.top) / span);
    const L = Math.round(a.start + (b2.start - a.start) * t);

    const targetLine = v.state.doc.line(Math.max(1, Math.min(L, v.state.doc.lines)));
    lock = 'preview'; // 先上锁再触发编辑器滚动，吞掉由此产生的 scroll 事件
    v.dispatch({
      effects: EditorView.scrollIntoView(targetLine.from, { y: 'start', yMargin: 8 }),
    });
    releaseSoon('preview');
  }

  function onEditorScroll(): void {
    if (lock === 'preview') return;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(editorToPreview);
  }

  function onPreviewScroll(): void {
    if (lock === 'editor') return;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(previewToEditor);
  }

  /* ---------------- 生命周期 ---------------- */

  onMount(() => {
    renderNow();
    const off = onDocChanged(schedule);
    const edScroll = getView()?.scrollDOM;
    edScroll?.addEventListener('scroll', onEditorScroll, { passive: true });
    scrollEl.addEventListener('scroll', onPreviewScroll, { passive: true });
    return () => {
      off();
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
      edScroll?.removeEventListener('scroll', onEditorScroll);
      scrollEl.removeEventListener('scroll', onPreviewScroll);
    };
  });

  // 大纲跳转依赖 jumpToLine 的 scrollIntoView → 编辑器滚动事件 → 本组件同步跟随
</script>

<div class="preview-scroll" bind:this={scrollEl}>
  <div class="preview-col md-preview" bind:this={container}></div>
</div>

<style>
  .preview-scroll {
    height: 100%;
    overflow-y: auto;
    background: var(--bg-content);
  }

  .preview-col {
    position: relative; /* 子块 offsetTop 以列为基准，与 scrollTop 同坐标系 */
    max-width: 46rem;
    margin: 0 auto;
    padding: 32px 40px 45vh; /* 底部大留白：末段内容也能滚到舒适阅读位置 */
    user-select: text;
    cursor: auto;
  }
</style>
