<script lang="ts">
  import { tabs } from '$lib/stores/tabs.svelte';

  interface Props {
    /** 关闭需经页面级未保存保护 */
    onRequestClose: (id: string) => void;
  }

  let { onRequestClose }: Props = $props();
</script>

<!--
  标签条（§7.3）：位于标题栏下方。
  容器带拖拽区属性 —— 空白处可拖动窗口；标签自身与按钮不受影响。
-->
<div class="tabbar" data-tauri-drag-region>
  <div class="strip">
    {#each tabs.tabs as t (t.id)}
      <div
        class="tab"
        class:active={t.id === tabs.activeId}
        role="tab"
        aria-selected={t.id === tabs.activeId}
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            tabs.activate(t.id);
          }
        }}
        onclick={() => tabs.activate(t.id)}
        onauxclick={(e) => {
          if (e.button === 1) onRequestClose(t.id); // 中键关闭
        }}
      >
        <span class="t-title">{t.title}</span>
        {#if t.dirty}<i class="t-dot" aria-hidden="true"></i>{/if}
        <button
          class="t-close"
          aria-label="关闭 {t.title}"
          tabindex="-1"
          onclick={(e) => {
            e.stopPropagation();
            onRequestClose(t.id);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .tabbar {
    flex-shrink: 0;
    background: var(--bg-chrome);
    border-bottom: 1px solid var(--border-subtle);
  }

  .strip {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 36px;
    padding: 4px 8px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    max-width: 176px;
    height: 32px;
    padding: 0 6px 0 10px;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    font-size: 12px;
    color: var(--text-tertiary);
    cursor: default;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .tab:hover {
    background: rgb(255 255 255 / 3%);
    color: var(--text-secondary);
  }

  :global([data-theme='light']) .tab:hover {
    background: rgb(28 30 38 / 4%);
  }

  /* 活动标签：内容面底色 + 极光顶线，与下方编辑区连成一体 */
  .tab.active {
    background: var(--bg-content);
    color: var(--text-primary);
    box-shadow: inset 0 2px 0 0 var(--accent-from);
  }

  .t-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .t-dot {
    flex-shrink: 0;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--warn);
  }

  .t-close {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    color: var(--text-tertiary);
    opacity: 0;
    transition:
      opacity var(--dur-fast) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
  }

  .tab:hover .t-close,
  .tab.active .t-close {
    opacity: 1;
  }

  .t-close:hover {
    background: rgb(255 255 255 / 8%);
    color: var(--text-primary);
  }

  :global([data-theme='light']) .t-close:hover {
    background: rgb(28 30 38 / 8%);
  }

  .t-close svg {
    width: 11px;
    height: 11px;
  }
</style>
