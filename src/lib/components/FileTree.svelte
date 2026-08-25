<script lang="ts">
  import { workspace, type TreeRow } from '$lib/stores/workspace.svelte';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';
  import { revealInOS } from '$lib/commands/fs';
  import { dirname } from '$lib/path';
  import ContextMenu from './ContextMenu.svelte';
  import type { MenuItem } from './ContextMenu.svelte';

  /* ---------------- 可见行推导（扁平化树 + 输入行占位） ---------------- */

  type Row =
    | ({ kind: 'entry' } & TreeRow)
    | { kind: 'input'; depth: number; initial: string; renameOf: string | null }
    | { kind: 'loading'; depth: number };

  let renaming = $state<{ oldPath: string; parent: string } | null>(null);
  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const rows = $derived.by<Row[]>(() => {
    const out: Row[] = [];
    const root = workspace.root;
    if (!root) return out;

    const walk = (dir: string, depth: number): void => {
      const list = workspace.children[dir] ?? [];

      // 新建输入行：插在该层最前
      const pc = workspace.pendingCreate;
      if (pc && pc.parent === dir) {
        out.push({ kind: 'input', depth, initial: '', renameOf: null });
      }

      for (const e of list) {
        if (renaming && renaming.oldPath === e.path) {
          out.push({ kind: 'input', depth, initial: e.name, renameOf: e.path });
        } else {
          out.push({ kind: 'entry', ...e, depth });
        }
        if (e.isDir && workspace.expanded[e.path]) walk(e.path, depth + 1);
      }

      if (workspace.loadingDirs[dir] && list.length === 0) {
        out.push({ kind: 'loading', depth });
      }
    };

    walk(root, 0);
    return out;
  });

  /* ---------------- 行为 ---------------- */

  function focusSelect(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  let inputEl = $state<HTMLInputElement | null>(null);

  async function commitInput(raw: string): Promise<void> {
    const pc = workspace.pendingCreate;
    const r = renaming;
    const value = raw.trim();
    cancelInput();
    if (!value) return;

    if (pc) {
      const path = await workspace.create(pc.parent, value, pc.kind);
      if (path && pc.kind === 'file') {
        await tabs.openPath(path).catch((e) => status.show(String(e)));
      }
    } else if (r) {
      const newPath = await workspace.rename(r.oldPath, value);
      if (newPath) tabs.retargetPath(r.oldPath, newPath); // 已打开的标签页跟随改名
    }
  }

  function cancelInput(): void {
    workspace.pendingCreate = null;
    renaming = null;
  }

  function onInputKeydown(e: KeyboardEvent): void {
    e.stopPropagation(); // 防止触发全局快捷键（如输入中按 s）
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitInput((e.currentTarget as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      cancelInput();
    }
  }

  function openRow(r: TreeRow): void {
    if (r.isDir) {
      workspace.toggle(r.path);
    } else {
      tabs.openPath(r.path).catch((e) => status.show(`打开失败：${String(e)}`));
    }
  }

  /* ---------------- 右键菜单 ---------------- */

  function menuFor(r?: TreeRow): MenuItem[] {
    if (!r) {
      return [
        { label: '新建文件', action: () => workspace.startCreate(workspace.root!, 'file') },
        { label: '新建文件夹', action: () => workspace.startCreate(workspace.root!, 'dir') },
        { separator: true, label: '' },
        { label: '刷新工作区', action: () => void workspace.refreshAll() },
      ];
    }
    const parent = dirname(r.path);
    const common: MenuItem[] = [
      {
        label: '重命名',
        action: () => (renaming = { oldPath: r.path, parent }),
      },
      {
        label: '删除',
        danger: true,
        action: () => void workspace.remove(r.path, parent), // 进废纸篓，可恢复，不加二次确认
      },
      { separator: true, label: '' },
      { label: '在访达中显示', action: () => revealInOS(r.path).catch(() => {}) },
    ];
    if (r.isDir) {
      return [
        { label: '新建文件', action: () => workspace.startCreate(r.path, 'file') },
        { label: '新建文件夹', action: () => workspace.startCreate(r.path, 'dir') },
        { separator: true, label: '' },
        ...common,
      ];
    }
    return [
      { label: '打开', action: () => openRow(r) },
      { separator: true, label: '' },
      ...common,
    ];
  }

  function openMenu(e: MouseEvent, r?: TreeRow): void {
    e.preventDefault();
    menu = { x: e.clientX, y: e.clientY, items: menuFor(r) };
  }
</script>

<!-- 目录树：懒加载、行内新建/重命名、右键菜单；空白处右键出根级操作 -->
<div class="tree" role="tree" aria-label="工作区文件" tabindex="-1" oncontextmenu={(e) => openMenu(e)}>
  {#each rows as row (row.kind === 'entry' ? row.path : row.kind === 'input' ? `input:${renaming?.oldPath ?? workspace.pendingCreate?.parent}:${workspace.pendingCreate?.kind ?? ''}` : `loading:${row.depth}`)}
    {#if row.kind === 'entry'}
      <div
        class="row"
        style:padding-left="{10 + row.depth * 14}px"
        onclick={() => openRow(row)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openRow(row);
          }
        }}
        oncontextmenu={(e) => openMenu(e, row)}
        role="treeitem"
        aria-selected="false"
        tabindex="-1"
      >
        {#if row.isDir}
          <span class="chev" class:open={workspace.expanded[row.path]}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
          <span class="icon dir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 7a2 2 0 0 1 2-2h3.2l1.8 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
            </svg>
          </span>
        {:else}
          <span class="chev spacer"></span>
          <span class="icon file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
              <path d="M14 3v5h5" />
            </svg>
          </span>
        {/if}
        <span class="name" title={row.path}>{row.name}</span>
      </div>
    {:else if row.kind === 'loading'}
      <div class="row ghost" style:padding-left="{10 + row.depth * 14}px">读取中…</div>
    {:else}
      <!-- 新建 / 重命名的行内输入 -->
      <div class="row inputing" style:padding-left="{10 + row.depth * 14}px">
        <input
          bind:this={inputEl}
          value={row.initial}
          use:focusSelect
          onkeydown={onInputKeydown}
          onblur={() => void commitInput(inputEl?.value ?? '')}
          placeholder={workspace.pendingCreate ? '名称' : '新名称'}
        />
      </div>
    {/if}
  {/each}

  {#if menu}
    <ContextMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
  {/if}
</div>

<style>
  .tree {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 16px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    margin: 0 6px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--text-secondary);
    cursor: default;
    user-select: none;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .row:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .row.ghost {
    color: var(--text-tertiary);
    font-size: 11px;
  }

  .chev {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--text-tertiary);
  }

  .chev.spacer {
    visibility: hidden;
  }

  .chev svg {
    width: 10px;
    height: 10px;
    transition: transform var(--dur-fast) var(--ease-out);
  }

  .chev.open svg {
    transform: rotate(90deg);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }

  .icon svg {
    width: 13px;
    height: 13px;
  }

  .icon.dir {
    color: var(--accent-from);
  }

  .icon.file {
    color: var(--text-tertiary);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row.inputing input {
    width: 100%;
    height: 22px;
    padding: 0 6px;
    font-size: 12px;
    color: var(--text-primary);
    background: var(--bg-app);
    border: 1px solid var(--accent-from);
    border-radius: var(--radius-sm);
    outline: none;
  }
</style>
