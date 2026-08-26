<script lang="ts">
  /**
   * 竖向分割条（可拖动）。
   *
   * - 1px 视觉宽度 + 左右各 4px 透明命中区，加宽手感但不占布局；
   * - 指针捕获（setPointerCapture）保证拖出元素外仍持续跟手，
   *   同时不会把 pointermove 泄漏给编辑器；
   * - rAF 节流，避免一帧内多次触发重排；
   * - 双击复位默认值，方向键 ±12px（Shift ±48px）可键盘微调。
   */
  import { layout } from '$lib/stores/layout.svelte';
  interface Props {
    /** 拖动/键盘调整时的目标位置（视口 clientX），由父组件换算成尺寸 */
    onmove: (clientX: number) => void;
    /** 键盘微调：相对像素增量 */
    onnudge: (deltaPx: number) => void;
    /** 双击复位 */
    onreset: () => void;
    label: string;
    /** 无障碍：当前值与范围（侧栏用 px，分栏用百分比） */
    valueNow: number;
    valueMin: number;
    valueMax: number;
  }

  let { onmove, onnudge, onreset, label, valueNow, valueMin, valueMax }: Props = $props();

  let dragging = $state(false);
  let frame = 0;
  let pendingX = 0;

  function flush(): void {
    frame = 0;
    onmove(pendingX);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    dragging = true;
    layout.dragging = true;
    document.body.classList.add('is-resizing'); // 全局 col-resize 光标
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault(); // 不要让分割条起选区/抢焦点
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    pendingX = e.clientX;
    if (frame) return;
    frame = requestAnimationFrame(flush);
  }

  function endDrag(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    layout.dragging = false;
    document.body.classList.remove('is-resizing');
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* 已释放 */
    }
    if (frame) {
      cancelAnimationFrame(frame);
      flush();
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 48 : 12;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onnudge(-step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onnudge(step);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onreset();
    }
  }
</script>

<!-- ARIA 的 separator 在可聚焦时即 window splitter（合法交互控件），
     svelte-check 的 a11y 规则不识别这一情形，故按语义显式抑制 -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="resizer"
  class:dragging
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={valueNow}
  aria-valuemin={valueMin}
  aria-valuemax={valueMax}
  tabindex="0"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={endDrag}
  onpointercancel={endDrag}
  ondblclick={onreset}
  onkeydown={onKeydown}
></div>

<style>
  .resizer {
    position: relative;
    width: 1px;
    flex-shrink: 0;
    background: var(--border-subtle);
    cursor: col-resize;
    transition: background var(--dur-fast) var(--ease-out);
    touch-action: none; /* 指针事件独占，避免手势滚动干扰 */
  }

  /* 透明命中区：总宽 9px，不影响布局 */
  .resizer::after {
    content: '';
    position: absolute;
    inset: 0 -4px;
  }

  .resizer:hover,
  .resizer.dragging {
    background: var(--aurora-gradient);
  }

  .resizer:focus-visible {
    outline: none;
    background: var(--accent-from);
  }
</style>
