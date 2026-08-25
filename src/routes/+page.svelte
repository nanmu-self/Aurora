<script lang="ts">
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import TitleBar from '$lib/components/TitleBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import EditorPane from '$lib/components/EditorPane.svelte';
  import PreviewPane from '$lib/components/PreviewPane.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { greet } from '$lib/commands';
  import { pickOpenPath } from '$lib/commands/fs';
  import { doc } from '$lib/stores/doc.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';

  /* ---------------- IPC 冒烟（M0） ---------------- */

  onMount(() => {
    void (async () => {
      try {
        console.info('[aurora] ipc ok:', await greet('aurora'));
      } catch (e) {
        console.warn('[aurora] ipc failed:', e);
      }
    })();
  });

  /* ---------------- 应用级动作（含未保存保护） ---------------- */

  let confirmOpen = $state(false);
  let confirmMessage = $state('');
  let pendingAction: (() => void) | null = null;

  /** 有未保存修改时先弹确认，确认后执行目标动作 */
  function guard(action: () => void, what: string): void {
    if (!doc.dirty) {
      action();
      return;
    }
    confirmMessage = `「${doc.title}」有未保存的更改，${what}将丢失这些修改。`;
    pendingAction = action;
    confirmOpen = true;
  }

  function confirmProceed(): void {
    confirmOpen = false;
    const act = pendingAction;
    pendingAction = null;
    act?.();
  }

  function confirmCancel(): void {
    confirmOpen = false;
    pendingAction = null;
  }

  function fmtErr(e: unknown): string {
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }

  function actionNew(): void {
    guard(() => doc.newBuffer(), '新建');
  }

  async function actionOpen(): Promise<void> {
    // 先选文件再 guard：取消选择不应触发未保存确认
    const path = await pickOpenPath();
    if (!path) return;
    guard(
      () =>
        void doc.open(path).catch((e) => {
          status.show(`打开失败：${fmtErr(e)}`);
        }),
      '打开新文件',
    );
  }

  function actionSave(): Promise<boolean> {
    return doc.save();
  }

  function actionSaveAs(): Promise<boolean> {
    return doc.saveAs();
  }

  /* ---------------- 全局快捷键 ---------------- */

  function onKeydown(e: KeyboardEvent): void {
    if (e.isComposing) return; // 组字期间不触发快捷键（S1 IME 关注点）
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        actionNew();
        break;
      case 'o':
        e.preventDefault();
        void actionOpen();
        break;
      case 's':
        e.preventDefault();
        if (e.shiftKey) {
          void actionSaveAs().catch((e) => console.warn('[aurora]', e));
        } else {
          void actionSave();
        }
        break;
    }
  }

  /* ---------------- 关闭窗口未保存保护 ---------------- */

  onMount(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested((event) => {
        if (doc.dirty) {
          event.preventDefault();
          guard(
            () => void getCurrentWindow().destroy(),
            '关闭窗口',
          );
        }
      })
      .then((u) => {
        unlisten = u;
      });
    return () => unlisten?.();
  });
</script>

<svelte:window onkeydown={onKeydown} />

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

<ConfirmDialog
  open={confirmOpen}
  message={confirmMessage}
  onconfirm={confirmProceed}
  oncancel={confirmCancel}
/>

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

  /* 编辑器 | 预览 分栏；可拖拽分割条在 M3 打磨 */
  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    flex: 1;
    min-width: 0;
  }
</style>
