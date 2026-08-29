<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { layout } from '$lib/stores/layout.svelte';

  interface Props {
    onMenu: (id: string) => void;
  }

  let { onMenu }: Props = $props();

  /** 仅在非 macOS 上渲染自定义菜单栏 */
  let isMac = $state(true);

  onMount(() => {
    const p = navigator.platform.toLowerCase();
    isMac = p.includes('mac') || p.includes('darwin');
  });

  /* ---------------- 下拉菜单状态 ---------------- */

  let openMenu: string | null = $state(null);
  let dropdownRef: HTMLDivElement | null = $state(null);

  function toggleMenu(id: string): void {
    openMenu = openMenu === id ? null : id;
  }

  function closeMenu(): void {
    openMenu = null;
  }

  function select(id: string): void {
    closeMenu();
    onMenu(id);
  }

  // 点击菜单外部关闭
  function onDocClick(e: MouseEvent): void {
    if (!openMenu) return;
    const target = e.target as Node;
    if (dropdownRef && dropdownRef.contains(target)) return;
    closeMenu();
  }

  /* ---------------- 菜单数据 ---------------- */

  const isDark = $derived(settings.resolved === 'dark');

  interface MenuItem {
    id?: string;
    label: string;
    separator?: boolean;
    shortcut?: string;
    danger?: boolean;
    checked?: boolean;
    disabled?: boolean;
  }

  interface MenuGroup {
    id: string;
    label: string;
    items: MenuItem[];
  }

  const menus = $derived.by<MenuGroup[]>(() => [
    {
      id: 'app',
      label: 'Aurora',
      items: [
        { id: 'app.settings', label: '设置…', shortcut: '⌘,' },
        { label: '', separator: true },
        { id: 'app.quit', label: '退出 Aurora', shortcut: '⌘Q' },
      ],
    },
    {
      id: 'file',
      label: '文件',
      items: [
        { id: 'file.new', label: '新建', shortcut: '⌘N' },
        { id: 'file.open', label: '打开…', shortcut: '⌘O' },
        { id: 'file.workspace', label: '打开工作区…', shortcut: '⇧⌘O' },
        { label: '', separator: true },
        { id: 'file.save', label: '保存', shortcut: '⌘S' },
        { id: 'file.save_as', label: '另存为…', shortcut: '⇧⌘S' },
        { id: 'file.export', label: '导出 HTML…', shortcut: '⇧⌘E' },
        { label: '', separator: true },
        { id: 'file.close_tab', label: '关闭标签页', shortcut: '⌘W' },
      ],
    },
    {
      id: 'edit',
      label: '编辑',
      items: [
        { id: 'edit.undo', label: '撤销', shortcut: '⌘Z' },
        { id: 'edit.redo', label: '重做', shortcut: '⇧⌘Z' },
        { label: '', separator: true },
        { id: 'edit.cut', label: '剪切', shortcut: '⌘X' },
        { id: 'edit.copy', label: '拷贝', shortcut: '⌘C' },
        { id: 'edit.paste', label: '粘贴', shortcut: '⌘V' },
        { id: 'edit.select_all', label: '全选', shortcut: '⌘A' },
        { label: '', separator: true },
        { id: 'edit.find', label: '查找…', shortcut: '⌘F' },
        { id: 'edit.search_workspace', label: '在工作区中搜索…', shortcut: '⇧⌘F' },
      ],
    },
    {
      id: 'fmt',
      label: '格式',
      items: [
        { id: 'fmt.bold', label: '加粗', shortcut: '⌘B' },
        { id: 'fmt.italic', label: '斜体', shortcut: '⌘I' },
        { id: 'fmt.code', label: '行内代码', shortcut: '⌘E' },
        { id: 'fmt.link', label: '插入链接', shortcut: '⌘K' },
      ],
    },
    {
      id: 'ai',
      label: 'AI',
      items: [
        { id: 'ai.optimize', label: '优化选中文本…', shortcut: '⇧⌘A' },
        { id: 'ai.settings', label: 'AI 设置…', shortcut: '⌘,' },
      ],
    },
    {
      id: 'view',
      label: '视图',
      items: [
        { id: 'view.sidebar', label: '显示侧栏', shortcut: '⌘\\', checked: !layout.sidebarCollapsed },
        { label: '', separator: true },
        { id: 'view.mode.editor', label: '仅编辑区', shortcut: '⌘1', checked: layout.viewMode === 'editor' },
        { id: 'view.mode.split', label: '分栏', shortcut: '⌘2', checked: layout.viewMode === 'split' },
        { id: 'view.mode.preview', label: '仅预览区', shortcut: '⌘3', checked: layout.viewMode === 'preview' },
        { label: '', separator: true },
        { id: 'view.zoom.in', label: '预览放大', shortcut: '⌘=' },
        { id: 'view.zoom.out', label: '预览缩小', shortcut: '⌘-' },
        { id: 'view.zoom.reset', label: '预览实际大小', shortcut: '⌘0' },
        { label: '', separator: true },
        { id: 'view.theme', label: isDark ? '切换到晨雾（浅色）' : '切换到深空（深色）' },
        { label: '', separator: true },
        { id: 'view.fullscreen', label: '进入全屏' },
      ],
    },
    {
      id: 'window',
      label: '窗口',
      items: [
        { id: 'window.minimize', label: '最小化', shortcut: '⌘M' },
        { label: '', separator: true },
        { id: 'window.close', label: '关闭窗口', shortcut: '⌘W' },
      ],
    },
  ]);
</script>

<svelte:window onclick={onDocClick} />

{#if !isMac}
  <div class="menubar" bind:this={dropdownRef}>
    {#each menus as group (group.id)}
      <div class="menu-item">
        <button
          class="menu-label"
          class:open={openMenu === group.id}
          onclick={() => toggleMenu(group.id)}
          onmouseenter={() => {
            if (openMenu && openMenu !== group.id) toggleMenu(group.id);
          }}
        >
          {group.label}
        </button>

        {#if openMenu === group.id}
          <div class="dropdown" role="menu">
            {#each group.items as item, idx (idx)}
              {#if item.separator}
                <div class="sep"></div>
              {:else}
                <button
                  class="dropdown-item"
                  class:disabled={item.disabled}
                  role="menuitem"
                  onclick={() => item.id && select(item.id)}
                >
                  <span class="item-label">
                    {#if item.checked !== undefined}
                      <svg class="check" class:on={item.checked} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        {#if item.checked}
                          <path d="M5 13l4 4L19 7" />
                        {/if}
                      </svg>
                    {/if}
                    {item.label}
                  </span>
                  {#if item.shortcut}
                    <span class="shortcut">{item.shortcut}</span>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .menubar {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: 100%;
    gap: 0;
  }

  .menu-item {
    position: relative;
    height: 100%;
  }

  .menu-label {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 8px;
    font-size: 12px;
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
    white-space: nowrap;
  }

  .menu-label:hover,
  .menu-label.open {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: calc(var(--z-titlebar) + 50);
    min-width: 200px;
    padding: 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
    user-select: none;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--text-primary);
    transition: background var(--dur-fast) var(--ease-out);
  }

  .dropdown-item:hover {
    background: var(--bg-chrome);
  }

  .dropdown-item.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .item-label {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .check {
    width: 14px;
    height: 14px;
    color: transparent;
  }

  .check.on {
    color: var(--accent);
  }

  .shortcut {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-left: 16px;
  }

  .sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--border-subtle);
  }
</style>
