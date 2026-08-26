<script lang="ts">
  import { onMount } from 'svelte';
  import { searchWorkspace, type SearchHit } from '$lib/commands/fs';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';
  import { jumpToLine } from '$lib/editor/bridge';
  import { basename, dirname } from '$lib/path';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let inputEl = $state<HTMLInputElement | null>(null);
  let query = $state('');
  let results = $state<SearchHit[]>([]);
  let searching = $state(false);
  let searched = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let runId = 0;

  function focusInput(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  async function run(q: string): Promise<void> {
    const id = ++runId;
    if (!workspace.root || !q.trim()) {
      results = [];
      searched = false;
      return;
    }
    searching = true;
    try {
      const hits = await searchWorkspace(workspace.root, q);
      if (id === runId) {
        results = hits;
        searched = true;
      }
    } catch (e) {
      status.show(`搜索失败：${String(e)}`);
    } finally {
      if (id === runId) searching = false;
    }
  }

  function onInput(): void {
    clearTimeout(timer);
    timer = setTimeout(() => void run(query), 250);
  }

  async function openHit(hit: SearchHit): Promise<void> {
    onclose();
    try {
      await tabs.openPath(hit.path);
      jumpToLine(hit.line); // 打开后跳到命中行，预览经滚动同步跟随
    } catch (e) {
      status.show(`打开失败：${String(e)}`);
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose();
    }
  }

  onMount(() => {
    return () => clearTimeout(timer);
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div class="overlay" role="presentation">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="全局搜索">
      <div class="search-row">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4-4" />
        </svg>
        <input
          bind:this={inputEl}
          bind:value={query}
          use:focusInput
          placeholder={workspace.root ? '在工作区中搜索…' : '先打开工作区（Cmd+Shift+O）'}
          disabled={!workspace.root}
          oninput={onInput}
        />
        <button class="x" aria-label="关闭搜索" onclick={onclose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="results">
        {#if !workspace.root}
          <p class="hint">打开工作区后即可全文搜索 md / txt 文件</p>
        {:else if searching}
          <p class="hint">搜索中…</p>
        {:else if searched && results.length === 0}
          <p class="hint">没有匹配结果</p>
        {:else if results.length > 0}
          {#each results as hit (hit.path + ':' + hit.line)}
            <button class="hit" onclick={() => void openHit(hit)}>
              <span class="h-file">{basename(hit.path)}</span>
              <span class="h-dir">{dirname(hit.path)}</span>
              <span class="h-line">第 {hit.line} 行</span>
              <span class="h-text">{hit.text}</span>
            </button>
          {/each}
        {:else}
          <p class="hint">输入关键词开始搜索</p>
        {/if}
      </div>

      {#if searched && results.length > 0}
        <footer class="meta">{results.length} 条结果</footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    background: rgb(0 0 0 / 42%);
    backdrop-filter: blur(3px);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    width: min(560px, calc(100vw - 48px));
    max-height: 70vh;
    margin: 12vh auto 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgb(0 0 0 / 28%);
    overflow: hidden;
  }

  .search-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .icon {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    color: var(--text-tertiary);
  }

  input {
    flex: 1;
    border: none;
    outline: none;
    background: none;
    font-size: 13px;
    color: var(--text-primary);
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  .x {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
  }

  .x:hover {
    background: var(--bg-chrome);
    color: var(--text-primary);
  }

  .x svg {
    width: 12px;
    height: 12px;
  }

  .results {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }

  .hint {
    padding: 28px 0;
    text-align: center;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .hit {
    display: grid;
    grid-template-columns: auto auto auto 1fr;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    text-align: left;
    transition: background var(--dur-fast) var(--ease-out);
  }

  .hit:hover {
    background: var(--bg-chrome);
  }

  .h-file {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .h-dir {
    overflow: hidden;
    max-width: 180px;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    font-size: 10.5px;
    color: var(--text-tertiary);
  }

  .h-line {
    font-size: 10.5px;
    color: var(--accent);
  }

  .h-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .meta {
    padding: 8px 14px;
    border-top: 1px solid var(--border-subtle);
    font-size: 10.5px;
    color: var(--text-tertiary);
  }
</style>
