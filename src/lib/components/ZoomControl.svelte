<script lang="ts">
  /**
   * 预览缩放控件（状态栏右下角）。
   *
   * 点击百分比弹出小面板：滑杆无级调节 + 数值直接输入 + 一键复位。
   * 输入框刻意不在每次按键就钳制范围 —— 否则输入「120」时刚打完「1」
   * 就会被拉到下限 60，无法继续输入；改为输入合法即生效、失焦时再归一化。
   */
  import { layout, ZOOM_MAX, ZOOM_MIN } from '$lib/stores/layout.svelte';

  const MIN = Math.round(ZOOM_MIN * 100);
  const MAX = Math.round(ZOOM_MAX * 100);

  const percent = $derived(Math.round(layout.previewZoom * 100));

  let open = $state(false);
  let draft = $state('100'); // 输入框草稿（字符串，允许中间态）
  let wrapEl: HTMLElement | undefined = $state();

  function toggle(): void {
    open = !open;
    if (open) draft = String(percent);
  }

  function apply(p: number): void {
    layout.setPreviewZoom(p / 100);
  }

  function onSlide(e: Event): void {
    apply(Number((e.currentTarget as HTMLInputElement).value));
    draft = String(Math.round(layout.previewZoom * 100));
  }

  function onInput(e: Event): void {
    draft = (e.currentTarget as HTMLInputElement).value;
    const v = Number(draft);
    // 只有落在合法区间才实时生效，中间态（空串、"1"）先放过
    if (Number.isFinite(v) && v >= MIN && v <= MAX) apply(v);
  }

  /** 失焦/回车：钳制并归一化显示 */
  function commit(): void {
    const v = Number(draft);
    if (Number.isFinite(v) && v > 0) apply(v);
    draft = String(Math.round(layout.previewZoom * 100));
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }

  function reset(): void {
    layout.resetZoom();
    draft = '100';
  }

  /** 点击面板外关闭 */
  function onWindowClick(e: MouseEvent): void {
    if (!open || !wrapEl) return;
    if (!wrapEl.contains(e.target as Node)) open = false;
  }

  /* 面板打开期间，快捷键或 Cmd+滚轮改了缩放时同步数值框。
     不会干扰输入：中间态（如“1”“12”）不会触发 apply，percent 不变，此 effect 也不会重跑 */
  $effect(() => {
    if (open) draft = String(percent);
  });
</script>

<svelte:window onclick={onWindowClick} />

<div class="zoom-wrap" bind:this={wrapEl}>
  <button
    class="zoom"
    class:active={percent !== 100}
    onclick={toggle}
    title="预览缩放（Cmd+= / Cmd+- / Cmd+0）"
    aria-label="预览缩放"
    aria-expanded={open}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5M8 11h6" />
    </svg>
    {percent}%
  </button>

  {#if open}
    <div class="popover" role="dialog" aria-label="预览缩放">
      <input
        class="slider"
        type="range"
        min={MIN}
        max={MAX}
        step="5"
        value={percent}
        oninput={onSlide}
        aria-label="缩放滑杆"
      />
      <div class="row">
        <input
          class="num"
          type="number"
          min={MIN}
          max={MAX}
          step="5"
          value={draft}
          oninput={onInput}
          onblur={commit}
          onkeydown={onKeydown}
          aria-label="缩放百分比"
        />
        <span class="unit">%</span>
        <button class="reset" onclick={reset}>复位</button>
      </div>
      <div class="hint">{MIN}%–{MAX}% · 预览区 Cmd+滚轮 / 双指捏放</div>
    </div>
  {/if}
</div>

<style>
  .zoom-wrap {
    position: relative;
    display: inline-flex;
  }

  .zoom {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .zoom svg {
    width: 11px;
    height: 11px;
  }

  .zoom:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  /* ≠100% 时用极光点缀色提示当前非默认缩放 */
  .zoom.active {
    color: var(--accent);
  }

  .popover {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    z-index: var(--z-popover);
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 210px;
    padding: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
    animation: pop var(--dur-normal) var(--ease-out);
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .popover {
      animation: none;
    }
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* 滑杆：极光渐变拇指 + hairline 轨道 */
  .slider {
    appearance: none;
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: var(--border-strong);
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--aurora-gradient);
    border: none;
    cursor: pointer;
  }

  .num {
    width: 56px;
    padding: 3px 6px;
    background: var(--bg-content);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .num:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* 去掉数字输入的上下箭头，保持极简 */
  .num::-webkit-inner-spin-button,
  .num::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .unit {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .reset {
    margin-left: auto;
    padding: 3px 8px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: 11px;
    color: var(--text-secondary);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .reset:hover {
    background: var(--bg-chrome);
    color: var(--text-primary);
  }

  .hint {
    font-size: 10px;
    line-height: 1.5;
    color: var(--text-tertiary);
    opacity: 0.8;
  }
</style>
