<script lang="ts">
  import { onMount } from 'svelte';
  import { BlockRenderer } from '$lib/markdown/renderer';
  import { getActiveText, onDocChanged } from '$lib/editor/bridge';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { dirname } from '$lib/path';
  import 'katex/dist/katex.min.css';
  import '$lib/styles/prose.css';

  /**
   * 实时预览（§4.6-C）：
   * - 编辑器每次变更后走 180ms 防抖再渲染，组字期间绝不同步重绘；
   * - 渲染发生在独立 DOM 子树（本组件容器），物理上不会打断编辑器组字；
   * - 块级增量 patch 见 renderer.ts；图片路径按 §4.6-A 解析为 asset 协议 URL。
   */
  const PREVIEW_DEBOUNCE_MS = 180;

  let container: HTMLElement;
  const renderer = new BlockRenderer();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function renderNow(): void {
    const t = tabs.active;
    // 相对路径基准：当前文件所在目录；未保存缓冲区退化为工作区根
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

  onMount(() => {
    renderNow();
    const off = onDocChanged(schedule);
    return () => {
      off();
      clearTimeout(timer);
    };
  });

  // M3：滚动同步在此组件实现，锚点即 .md-block[data-start-line]
</script>

<div class="preview-scroll">
  <div class="preview-col md-preview" bind:this={container}></div>
</div>

<style>
  .preview-scroll {
    height: 100%;
    overflow-y: auto;
    background: var(--bg-content);
  }

  .preview-col {
    max-width: 46rem;
    margin: 0 auto;
    padding: 32px 40px 45vh; /* 底部大留白：末段内容也能滚到舒适阅读位置 */
    user-select: text;
    cursor: auto;
  }
</style>
