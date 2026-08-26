<script lang="ts">
  import { tabs } from '$lib/stores/tabs.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';
  import { layout } from '$lib/stores/layout.svelte';

  const zoomPercent = $derived(Math.round(layout.previewZoom * 100));
</script>

<!--
  底部状态栏：字数 / 行列号来自编辑器派生状态（单向同步），
  右侧为保存状态指示，瞬时通知出现时临时接管。
-->
<footer class="statusbar">
  <div class="group">
    <span class="item">{status.chars} 字</span>
    <span class="sep">·</span>
    <span class="item">{status.words} 词</span>
    <span class="sep">·</span>
    <span class="item">第 {status.ln} 行，第 {status.col} 列</span>
  </div>

  <div class="group">
    {#if status.notice}
      <span class="item notice">{status.notice}</span>
    {:else}
      {#if zoomPercent !== 100 && layout.previewVisible}
        <button class="item zoom" onclick={() => layout.resetZoom()} title="点击恢复 100%（Cmd+0）">
          预览 {zoomPercent}%
        </button>
        <span class="sep">·</span>
      {/if}
      <span class="item muted">约 {status.minutes} 分钟</span>
      <span class="sep">·</span>
      <span class="item">
        <i class="dot" class:dirty={(tabs.active?.dirty) ?? false} aria-hidden="true"></i>
        {tabs.active?.dirty ? '未保存' : '已保存'}
      </span>
    {/if}
  </div>
</footer>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    height: var(--statusbar-height);
    padding: 0 10px;
    font-size: 11px;
    color: var(--text-tertiary);
    background: var(--bg-chrome);
    border-top: 1px solid var(--border-subtle);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sep {
    opacity: 0.5;
  }

  .item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  /* 保存状态点：干净=极光青，脏=琥珀 */
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    transition: background var(--dur-fast) var(--ease-out);
  }

  .dot.dirty {
    background: var(--warn);
  }

  .notice {
    color: var(--warn);
  }

  .muted {
    opacity: 0.85;
  }

  /* 预览缩放指示（仅 ≠100% 时出现，点击即复位） */
  .zoom {
    color: var(--accent);
    font-size: 11px;
    border-radius: var(--radius-sm);
    padding: 1px 4px;
    transition: background var(--dur-fast) var(--ease-out);
  }

  .zoom:hover {
    background: var(--bg-elevated);
  }
</style>
