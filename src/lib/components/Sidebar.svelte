<script lang="ts">
  import { ui } from '$lib/stores/ui.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { outline } from '$lib/stores/outline.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';
  import { basename } from '$lib/path';
  import FileTree from './FileTree.svelte';

  /** 当前光标所在章节：最后一个起始行 ≤ 光标行的大纲项 */
  const activeIndex = $derived.by(() => {
    let idx = -1;
    for (let i = 0; i < outline.items.length; i++) {
      if (outline.items[i].line <= status.ln) idx = i;
      else break;
    }
    return idx;
  });

  const tabs = [
    { id: 'files', label: '文件' },
    { id: 'outline', label: '大纲' },
  ] as const;
</script>

<!-- 左侧栏：文件树（工作区）/ 大纲（M3）；活动页签指示线使用极光渐变 -->
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
      {#if workspace.root}
        <!-- 工作区头部：名称 + 快捷操作 -->
        <div class="ws-head">
          <span class="ws-name" title={workspace.root}>{workspace.name}</span>
          <div class="ws-actions">
            <button
              class="ws-btn"
              title="新建文件（根目录）"
              onclick={() => workspace.startCreate(workspace.root!, 'file')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></svg>
            </button>
            <button
              class="ws-btn"
              title="新建文件夹（根目录）"
              onclick={() => workspace.startCreate(workspace.root!, 'dir')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7a2 2 0 0 1 2-2h3.2l1.8 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M12 12v4m-2-2h4" stroke-linecap="round" /></svg>
            </button>
            <button
              class="ws-btn"
              title="刷新"
              onclick={() => void workspace.refreshAll()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
            </button>
            <button
              class="ws-btn"
              title="收起全部"
              onclick={() => workspace.collapseAll()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            </button>
          </div>
        </div>
        <FileTree />
      {:else}
        <!-- 未打开工作区：引导 + 最近列表 -->
        <div class="ws-empty">
          <p class="hint">打开一个文件夹<br />作为你的笔记库</p>
          <button class="open-btn" onclick={() => void workspace.pickAndOpen()}>
            打开文件夹
          </button>

          {#if workspace.recents.length > 0}
            <div class="recents">
              <p class="recents-title">最近</p>
              {#each workspace.recents as p (p)}
                <button class="recent" title={p} onclick={() => void workspace.openRecent(p)}>
                  <span class="r-name">{basename(p)}</span>
                  <span class="r-path">{p}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      {#if outline.items.length === 0}
        <p class="empty-hint">
          暂无标题
          <span>用 # 开头写标题即可生成大纲</span>
        </p>
      {:else}
        <div class="outline" role="list">
          {#each outline.items as item, i (item.line)}
            <button
              class="o-item"
              class:on={i === activeIndex}
              style:padding-left="{10 + (item.level - 1) * 12}px"
              onclick={() => outline.jump(item)}
            >
              <span class="o-level">H{item.level}</span>
              <span class="o-title" title={item.title}>{item.title}</span>
            </button>
          {/each}
        </div>
      {/if}
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
    overflow: hidden;
    transition: width var(--dur-med) var(--ease-out);
  }

  :global(.sidebar-collapsed) .sidebar {
    width: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar {
      transition: none;
    }
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ---------- 工作区头部 ---------- */
  .ws-head {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px 6px;
  }

  .ws-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .ws-actions {
    display: flex;
    gap: 2px;
  }

  .ws-btn {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    opacity: 0.85;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .ws-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .ws-btn svg {
    width: 13px;
    height: 13px;
  }

  /* ---------- 空状态 / 最近 ---------- */
  .ws-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 20px 20px;
    text-align: center;
  }

  .hint {
    font-size: 12px;
    line-height: 1.8;
    color: var(--text-tertiary);
    margin-bottom: 16px;
  }

  .open-btn {
    padding: 6px 18px;
    border-radius: var(--radius-md);
    font-size: 12px;
    font-weight: 600;
    color: #10141c;
    background: var(--aurora-gradient);
    transition: filter var(--dur-fast) var(--ease-out);
  }

  .open-btn:hover {
    filter: brightness(1.06);
  }

  .recents {
    width: 100%;
    margin-top: 28px;
  }

  .recents-title {
    margin-bottom: 6px;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
    text-transform: uppercase;
    text-align: left;
  }

  .recent {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 5px 8px;
    margin-bottom: 2px;
    border-radius: var(--radius-sm);
    text-align: left;
    transition: background var(--dur-fast) var(--ease-out);
  }

  .recent:hover {
    background: var(--bg-elevated);
  }

  .r-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .r-path {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl; /* 长路径优先展示尾部 */
    font-size: 10px;
    color: var(--text-tertiary);
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

  /* ---------- 大纲 ---------- */
  .outline {
    flex: 1;
    overflow-y: auto;
    padding: 6px 6px 16px;
  }

  .o-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    text-align: left;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .o-item:hover {
    background: var(--bg-elevated);
  }

  .o-item.on {
    background: var(--bg-elevated);
  }

  .o-item.on .o-title {
    color: var(--text-primary);
    font-weight: 500;
  }

  /* 当前章节左侧的极光指示线 */
  .o-item.on::before {
    content: '';
    position: absolute;
    left: 0;
    width: 2px;
    height: 14px;
    border-radius: 1px;
    background: var(--aurora-gradient);
  }

  .o-item {
    position: relative;
  }

  .o-level {
    flex-shrink: 0;
    font-size: 9.5px;
    color: var(--text-tertiary);
    opacity: 0.75;
  }

  .o-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>
