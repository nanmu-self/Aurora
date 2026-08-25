<script lang="ts">
  import { onMount } from 'svelte';
  import TitleBar from '$lib/components/TitleBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import EditorPane from '$lib/components/EditorPane.svelte';
  import PreviewPane from '$lib/components/PreviewPane.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import { greet } from '$lib/commands';

  onMount(async () => {
    // M0 冒烟：确认前端 ↔ Rust IPC 链路可用
    try {
      console.info('[aurora] ipc ok:', await greet('aurora'));
    } catch (e) {
      console.warn('[aurora] ipc failed:', e);
    }
  });
</script>

<div class="app-shell">
  <TitleBar />

  <div class="app-body">
    <Sidebar />
    <main class="split">
      <EditorPane />
      <PreviewPane />
    </main>
  </div>

  <StatusBar />
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--bg-app);
    color: var(--text-primary);
  }

  .app-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* 编辑器 | 预览 分栏；可拖拽分割条在 M1/M3 打磨 */
  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    flex: 1;
    min-width: 0;
  }
</style>
