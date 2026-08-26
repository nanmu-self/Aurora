<script lang="ts">
  import { onMount } from 'svelte';
  import { CLOSE_MENUS_EVENT } from './menuBus';

  export interface MenuItem {
    label: string;
    danger?: boolean;
    /** 分隔线（忽略 label） */
    separator?: boolean;
    action?: () => void;
  }

  interface Props {
    x: number;
    y: number;
    items: MenuItem[];
    onclose: () => void;
  }

/**
 * 轻量右键菜单：定位时做视口翻转，点击任意处 / Esc / 再次右键关闭。
 * 打开新菜单前请先 preventDefault，让本组件的 window 级 contextmenu 监听放行。
 */
let { x, y, items, onclose }: Props = $props();

const MENU_WIDTH = 168;

const styleLeft = $derived(`${Math.min(x, window.innerWidth - MENU_WIDTH - 8)}px`);
const styleTop = $derived(`${Math.min(y, window.innerHeight - items.length * 30 - 16)}px`);

function close(): void {
  onclose();
}

function onItem(item: MenuItem): void {
  close();
  item.action?.();
}

function onWindowClick(): void {
  close();
}

function onWindowContextmenu(e: MouseEvent): void {
  if (e.defaultPrevented) return; // 已有新菜单接手
  close();
}

/** 其他位置打开新菜单时，通知本实例关闭（避免两个菜单同时浮着） */
onMount(() => {
  const onCloseAll = (): void => close();
  window.addEventListener(CLOSE_MENUS_EVENT, onCloseAll);
  return () => window.removeEventListener(CLOSE_MENUS_EVENT, onCloseAll);
});

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}
</script>

<svelte:window onclick={onWindowClick} oncontextmenu={onWindowContextmenu} onkeydown={onKeydown} />

<div class="menu" role="menu" style:left={styleLeft} style:top={styleTop}>
  {#each items as item, i (i)}
    {#if item.separator}
      <div class="sep"></div>
    {:else}
      <button class="item" class:danger={item.danger} role="menuitem" onclick={() => onItem(item)}>
        {item.label}
      </button>
    {/if}
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: calc(var(--z-popover) + 10);
    min-width: 168px;
    padding: 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
    user-select: none;
  }

  .item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--text-primary);
    transition: background var(--dur-fast) var(--ease-out);
  }

  .item:hover {
    background: var(--bg-chrome);
  }

  .item.danger {
    color: #f87171;
  }

  .sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--border-subtle);
  }
</style>
