<script lang="ts">
  import { settings } from '$lib/stores/settings.svelte';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { layout, type ViewMode } from '$lib/stores/layout.svelte';

  interface Props {
    onOpenSettings: () => void;
    onExport: () => void;
  }

  let { onOpenSettings, onExport }: Props = $props();

  const isDark = $derived(settings.resolved === 'dark');

  const MODES: { mode: ViewMode; label: string; hint: string }[] = [
    { mode: 'editor', label: '仅编辑区', hint: '仅编辑区（Cmd+1）' },
    { mode: 'split', label: '分栏', hint: '分栏（Cmd+2）' },
    { mode: 'preview', label: '仅预览区', hint: '仅预览区（Cmd+3）' },
  ];
</script>

<!--
  自定义标题栏（决策 D4 / Spike S5）：
  - macOS 用原生红绿灯悬浮（tauri.conf: titleBarStyle=Overlay），左侧预留控制区宽度；
  - 整条标题栏是拖拽区（data-tauri-drag-region），按钮自身不带该属性以保持可点击；
  - Windows/Linux 的自定义窗口控制按钮在后续里程碑按需补充。
-->
<header class="titlebar">
  <div class="traffic-spacer" aria-hidden="true"></div>

  <button
    class="icon-btn"
    class:off={layout.sidebarCollapsed}
    onclick={() => layout.toggleSidebar()}
    title={layout.sidebarCollapsed ? '显示侧栏（Cmd+\\）' : '隐藏侧栏（Cmd+\\）'}
    aria-label="切换侧栏"
    aria-pressed={!layout.sidebarCollapsed}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {#if !layout.sidebarCollapsed}
        <path d="M3.8 4.8h4.4v14.4H3.8z" fill="currentColor" stroke="none" opacity="0.35" />
      {/if}
    </svg>
  </button>

  <div
    class="title"
    data-tauri-drag-region
    title={tabs.active?.path ?? tabs.active?.title ?? 'Aurora'}
  >
    {tabs.active?.title ?? 'Aurora'}{#if tabs.active?.dirty}<span class="dirty-mark">•</span>{/if}
  </div>

  <div class="actions">
    <div class="segmented" role="group" aria-label="视图模式">
      {#each MODES as m (m.mode)}
        <button
          class="seg-btn"
          class:active={layout.viewMode === m.mode}
          onclick={() => layout.setViewMode(m.mode)}
          title={m.hint}
          aria-label={m.label}
          aria-pressed={layout.viewMode === m.mode}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            {#if m.mode === 'split'}
              <path d="M12 5v14" />
            {:else if m.mode === 'editor'}
              <!-- 源码：尖括号 -->
              <path d="m9 10-2 2 2 2m6-4 2 2-2 2" stroke-linecap="round" />
            {:else}
              <!-- 预览：已排版的段落 -->
              <path d="M7 9.5h10M7 13h7M7 16h4" stroke-linecap="round" />
            {/if}
          </svg>
        </button>
      {/each}
    </div>

    <div class="bar-divider" aria-hidden="true"></div>

    <button class="icon-btn" title="导出 HTML（Cmd+Shift+E）" aria-label="导出 HTML" onclick={onExport}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
    </button>
    <button class="icon-btn" title="设置（全局搜索 Cmd+Shift+F）" aria-label="设置" onclick={onOpenSettings}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    </button>
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
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  /* 侧栏已折叠时图标减弱 */
  .icon-btn.off {
    opacity: 0.55;
  }

  /* 三态视图模式切换 */
  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .seg-btn {
    display: grid;
    place-items: center;
    width: 24px;
    height: 20px;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .seg-btn svg {
    width: 14px;
    height: 14px;
  }

  .seg-btn:hover {
    color: var(--text-primary);
  }

  .seg-btn.active {
    background: var(--bg-chrome);
    color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--border-strong);
  }

  .bar-divider {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--border-subtle);
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
