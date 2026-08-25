<script lang="ts">
  import { settings } from '$lib/stores/settings.svelte';
  import { doc } from '$lib/stores/doc.svelte';

  const isDark = $derived(settings.resolved === 'dark');
</script>

<!--
  自定义标题栏（决策 D4 / Spike S5）：
  - macOS 用原生红绿灯悬浮（tauri.conf: titleBarStyle=Overlay），左侧预留控制区宽度；
  - 整条标题栏是拖拽区（data-tauri-drag-region），按钮自身不带该属性以保持可点击；
  - Windows/Linux 的自定义窗口控制按钮在后续里程碑按需补充。
-->
<header class="titlebar">
  <div class="traffic-spacer" aria-hidden="true"></div>

  <div class="title" data-tauri-drag-region title={doc.path ?? '未命名'}>
    {doc.title}{#if doc.dirty}<span class="dirty-mark">•</span>{/if}
  </div>

  <div class="actions">
    <button
      class="icon-btn"
      onclick={() => settings.toggle()}
      title={isDark ? '切换到晨雾（浅色）' : '切换到深空（深色）'}
      aria-label="切换主题"
    >
      {#if isDark}
        <!-- 太阳：点击切到浅色 -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      {:else}
        <!-- 月亮：点击切到深色 -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      {/if}
    </button>
  </div>
</header>

<style>
  .titlebar {
    position: relative;
    z-index: var(--z-titlebar);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: var(--titlebar-height);
    padding-right: 10px;
    background: var(--bg-chrome);
    border-bottom: 1px solid var(--border-subtle);
  }

  /* macOS Overlay 模式下红绿灯悬浮于此区域之上 */
  .traffic-spacer {
    width: 76px;
    flex-shrink: 0;
    align-self: stretch;
  }

  .title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--text-secondary);
    pointer-events: auto;
  }

  .dirty-mark {
    margin-left: 5px;
    color: var(--warn);
  }

  .actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .icon-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .icon-btn svg {
    width: 15px;
    height: 15px;
  }
</style>
