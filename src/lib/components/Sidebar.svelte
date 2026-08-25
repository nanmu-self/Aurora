<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';

  const tabs = [
    { id: 'files', label: '文件' },
    { id: 'outline', label: '大纲' },
  ] as const;
</script>

<!-- 左侧栏：文件树（M2）/ 大纲（M3）；活动页签指示线使用极光渐变 -->
<aside class="sidebar">
  <nav class="tabs">
    {#each tabs as tab (tab.id)}
      <button
        class="tab"
        class:active={ui.sidebarTab === tab.id}
        onclick={() => (ui.sidebarTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  <div class="panel">
    {#if ui.sidebarTab === 'files'}
      <p class="empty-hint">
        打开工作区后显示文件树
        <span>M2 · 工作区</span>
      </p>
    {:else}
      <p class="empty-hint">
        文档大纲将显示在这里
        <span>M3 · 写作体验</span>
      </p>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: var(--sidebar-width);
    background: var(--bg-chrome);
    border-right: 1px solid var(--border-subtle);
  }

  .tabs {
    display: flex;
    gap: 2px;
    padding: 6px 10px 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .tab {
    position: relative;
    padding: 5px 10px 8px;
    font-size: 12px;
    color: var(--text-tertiary);
    transition: color var(--dur-fast) var(--ease-out);
  }

  .tab:hover {
    color: var(--text-secondary);
  }

  .tab.active {
    color: var(--text-primary);
    font-weight: 500;
  }

  /* 极光渐变指示线 —— 品牌色的第一个落点 */
  .tab.active::after {
    content: '';
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: -1px;
    height: 2px;
    border-radius: 1px;
    background: var(--aurora-gradient);
  }

  .panel {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }

  .empty-hint {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 36px;
    text-align: center;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .empty-hint span {
    font-size: 11px;
    opacity: 0.65;
  }
</style>
