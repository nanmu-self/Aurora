<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorView } from '@codemirror/view';
  import { BlockRenderer } from '$lib/markdown/renderer';
  import { getActiveText, getView, onDocChanged } from '$lib/editor/bridge';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { layout } from '$lib/stores/layout.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';
  import { dirname, join } from '$lib/path';
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
    if (!settings.scrollSync || layout.viewMode !== 'split') return; // 单栏模式无需同步
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
    if (!settings.scrollSync || layout.viewMode !== 'split') return;
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

  /**
   * 预览区链接点击委托：
   * - 相对路径 / `/foo` 样式：按当前文件目录 / 工作区根解析为绝对路径，走 tabs.openPath；
   * - http(s) / mailto / data / javascript / asset：放行浏览器默认（外部链接会跳浏览器，mailto 同理）；
   * - 纯锚点 `#...`：交给编辑器的 outline / jump 能力（当前静默，未来可接大纲跳转）；
   * - 不存在或失败：在状态栏提示，绝不导航离开，避免把整个页面带到 404 而无法退出。
   */
  function handleClick(e: MouseEvent): void {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const anchor = target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;
    const hrefTrim = href.trim();

    // 1. 放行纯锚点（交给大纲 / 未来跳转）
    if (hrefTrim.startsWith('#')) return;

    // 2. 放行浏览器应该接管的外部协议
    if (/^(https?|mailto|data|javascript|tel:|geo:|asset:|blob:|#)/i.test(hrefTrim)) {
      return;
    }

    e.preventDefault();
    const activePath = tabs.active?.path;
    if (!activePath) return; // 无上下文不处理

    let abs: string;
    if (hrefTrim.startsWith('/')) {
      // `/foo/bar.md` → 以工作区根为基准
      abs = workspace.root ? join(workspace.root, hrefTrim) : hrefTrim;
    } else {
      // `other/API_sign.md` / `../foo.md` / `./bar.md` → 以当前文档所在目录为基准
      abs = join(dirname(activePath), hrefTrim);
    }
    abs = abs.replace(/\/$/, '');

    tabs.openPath(abs).catch((e: unknown) => {
      const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
      status.show(`打开失败：${abs}（${msg}）`);
    });
  }

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
  /* ⌘/Ctrl + 滚轮缩放预览（触控板双指捉放也以 ctrlKey=true 的 wheel 事件到达） */
  function onWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    layout.setPreviewZoom(layout.previewZoom - e.deltaY * 0.01);
  }
</script>

<div class="preview-scroll" bind:this={scrollEl} onwheel={onWheel}>
  <div class="preview-col md-preview" bind:this={container} onclick={handleClick}></div>
</div>

<style>
  .preview-scroll {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain; /* WKWebView 下防止滚动链接到外层 */
    background: var(--bg-content);
  }

  .preview-col {
    position: relative; /* 子块 offsetTop 以列为基准，与 scrollTop 同坐标系 */
    /* 缩放用字号驱动（prose 内部均为 em 相对单位），而不用 CSS zoom：
       zoom 会改变 offsetTop 的坐标系，打买锚点滚动同步的换算 */
    font-size: calc(15px * var(--preview-zoom, 1));
    max-width: 46em; /* em 而非 rem：版心随字号等比伸缩 */
    margin: 0 auto;
    padding: 2.1em 2.6em 45vh; /* 底部大留白：末段内容也能滚到舒适阅读位置 */
    user-select: text;
    cursor: auto;
  }
</style>
