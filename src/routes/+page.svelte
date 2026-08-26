<script lang="ts">
  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import TitleBar from '$lib/components/TitleBar.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import EditorPane from '$lib/components/EditorPane.svelte';
  import PreviewPane from '$lib/components/PreviewPane.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import SearchDialog from '$lib/components/SearchDialog.svelte';
  import GlobalContextMenu from '$lib/components/GlobalContextMenu.svelte';
  import Resizer from '$lib/components/Resizer.svelte';
  import { getActiveText } from '$lib/editor/bridge';
  import { runEditorAction } from '$lib/editor/actions';
  import { markdownToStandaloneHtml } from '$lib/markdown/export';
  import { exitApp, greet, startupFiles, syncViewMenu } from '$lib/commands';
  import { pickOpenPath, pickSaveHtmlPath, writeTextFile, allowWorkspaceAssets } from '$lib/commands/fs';
  import { initAutosave, cancelAutosave } from '$lib/editor/autosave';
  import { outline } from '$lib/stores/outline.svelte';
  import { tabs } from '$lib/stores/tabs.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { status } from '$lib/stores/editorStatus.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { layout } from '$lib/stores/layout.svelte';
  import { RATIO_MAX, RATIO_MIN, SIDEBAR_MAX, SIDEBAR_MIN } from '$lib/stores/layout.svelte';
  import { dirname } from '$lib/path';

  /* ---------------- IPC 冒烟（M0） + M3 派生服务 ---------------- */

  onMount(() => {
    void (async () => {
      try {
        console.info('[aurora] ipc ok:', await greet('aurora'));
      } catch (e) {
        console.warn('[aurora] ipc failed:', e);
      }
    })();

    outline.init(); // 大纲 + 字数统计随文档防抖刷新
    initAutosave();

    let unFs: (() => void) | undefined;
    listen<{ path: string }>('fs-changed', (ev) => void handleFsChange(ev.payload.path)).then(
      (u) => {
        unFs = u;
      },
    );
    return () => unFs?.();
  });

  /** 外部变更：树联动刷新；已打开且未脏的标签自动重载，脏标签仅提示（S3 第三层在前端） */
  async function handleFsChange(path: string): Promise<void> {
    if (workspace.root && path.startsWith(workspace.root)) {
      void workspace.refreshDir(dirname(path));
    }
    const t = tabs.tabs.find((x) => x.path === path);
    if (!t) return;
    if (t.dirty) {
      cancelAutosave(); // 数据安全：不自动用旧内容覆盖外部修改
      status.show(`「${t.title}」已被外部修改，请注意保存冲突`);
      return;
    }
    await tabs.reloadTab(t.id);
  }

  /* ---------------- 应用级动作（含未保存保护） ---------------- */

  let confirmOpen = $state(false);
  let confirmMessage = $state('');
  let pendingAction: (() => void) | null = null;
  let settingsOpen = $state(false);
  let searchOpen = $state(false);

  /** 有未保存修改时先弹确认，确认后执行目标动作 */
  function guard(action: () => void, what: string, tabTitle?: string): void {
    if (!tabTitle) {
      action();
      return;
    }
    confirmMessage = `「${tabTitle}」有未保存的更改，${what}将丢失这些修改。`;
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
    tabs.newUntitled();
  }

  /* ---------------- 系统打开请求（Finder 双击 / Dock 拖拽 / 带参启动） ---------------- */

  const DOC_EXT_RE = /\.(md|markdown|mdown|mkd)$/i;

  /** 打开外部传入的路径；支持多选，带未保存保护（确认后继续处理剩余的） */
  async function openExternalPaths(paths: string[]): Promise<void> {
    const files = [...new Set(paths)].filter((p) => DOC_EXT_RE.test(p));
    if (files.length === 0) return;

    // 单文件模式下放行所在目录：预览里的相对路径图片经 asset 协议加载
    await Promise.allSettled(files.map((f) => allowWorkspaceAssets(dirname(f))));

    for (const p of files) {
      const existing = tabs.tabs.find((t) => t.path === p);
      if (!existing && tabs.active?.dirty) {
        // 队列式保护：确认后从当前文件重新开始，避免覆盖 pendingAction
        guard(() => void openExternalPaths([p]), '打开外部文件', tabs.active!.title);
        return;
      }
      await tabs.openPath(p).catch((e) => {
        status.show(`打开失败：${fmtErr(e)}`);
      });
    }
  }

  async function actionOpen(): Promise<void> {
    // 先选文件再 guard：取消选择不应触发未保存确认
    const path = await pickOpenPath();
    if (!path) return;
    const existing = tabs.tabs.find((t) => t.path === path);
    if (!existing && tabs.active?.dirty) {
      guard(
        () =>
          void tabs.openPath(path).catch((e) => {
            status.show(`打开失败：${fmtErr(e)}`);
          }),
        '打开新文件',
        tabs.active!.title,
      );
      return;
    }
    await tabs.openPath(path).catch((e) => {
      status.show(`打开失败：${fmtErr(e)}`);
    });
  }

  function actionSave(): Promise<boolean> {
    return tabs.saveActive();
  }

  function actionSaveAs(): Promise<boolean> {
    return tabs.saveActiveAs();
  }

  /** 导出当前文档为自包含 HTML（M4） */
  async function actionExportHtml(): Promise<void> {
    const t = tabs.active;
    if (!t) return;
    const baseName = t.title.replace(/\.(md|markdown)$/i, '') || '未命名';
    const html = markdownToStandaloneHtml(getActiveText(), baseName);
    const path = await pickSaveHtmlPath(`${baseName}.html`);
    if (!path) return;
    try {
      await writeTextFile(path, html);
      status.show(`已导出：${path.split('/').pop()}`);
    } catch (e) {
      status.show(`导出失败：${String(e)}`);
    }
  }

  /** 关闭标签页（经未保存保护） */
  function requestCloseTab(id: string): void {
    const t = tabs.tabs.find((x) => x.id === id);
    if (!t) return;
    if (!t.dirty) {
      tabs.close(id);
      return;
    }
    guard(() => tabs.close(id), '关闭标签页', t.title);
  }

  function closeActiveTab(): void {
    if (tabs.activeId) requestCloseTab(tabs.activeId);
  }

  /* ---------------- 分栏拖动 ---------------- */

  let bodyEl: HTMLElement | undefined = $state();
  let splitEl: HTMLElement | undefined = $state();

  /** 侧栏：指针 x 减去容器左边界即宽度 */
  function onSidebarDrag(clientX: number): void {
    if (!bodyEl) return;
    layout.setSidebarWidth(clientX - bodyEl.getBoundingClientRect().left);
  }

  /** 分栏：换算成编辑区占比 */
  function onSplitDrag(clientX: number): void {
    if (!splitEl) return;
    const rect = splitEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    layout.setSplitRatio((clientX - rect.left) / rect.width);
  }

  function nudgeSplit(deltaPx: number): void {
    if (!splitEl) return;
    const w = splitEl.getBoundingClientRect().width;
    if (w <= 0) return;
    layout.setSplitRatio(layout.splitRatio + deltaPx / w);
  }

  /* 分栏时三列（含 1px 分割条）；单栏时只需一列
     —— 隐藏的编辑区是 display:none，不参与 grid 布局 */
  const splitCols = $derived(
    layout.viewMode === 'split'
      ? `minmax(0, ${layout.splitRatio}fr) 1px minmax(0, ${1 - layout.splitRatio}fr)`
      : 'minmax(0, 1fr)',
  );

  /* 菜单勾选态跟随界面状态（浏览器调试环境下无 Tauri，失败忽略） */
  $effect(() => {
    void syncViewMenu(layout.viewMode, !layout.sidebarCollapsed).catch(() => {});
  });

  /* ---------------- 菜单栏（macOS 中文菜单）事件 ---------------- */

  /** 退出：先过未保存保护，确认后再确定性退出进程 */
  function requestQuit(): void {
    const dirty = tabs.tabs.filter((t) => t.dirty);
    if (dirty.length === 0) {
      void exitApp();
      return;
    }
    confirmMessage =
      dirty.length === 1
        ? `「${dirty[0].title}」有未保存的更改，退出将丢失这些修改。`
        : `${dirty.length} 个标签页有未保存的更改，退出将丢失这些修改。`;
    pendingAction = () => void exitApp();
    confirmOpen = true;
  }

  function handleMenu(id: string): void {
    // 模态框（设置/全局搜索/确认框）打开时，格式与查找类动作不应落到背后的编辑器上
    const modalOpen = settingsOpen || searchOpen || confirmOpen;
    if (modalOpen && (id.startsWith('fmt.') || id === 'edit.find')) return;

    switch (id) {
      case 'app.settings':
        settingsOpen = true;
        break;
      case 'app.quit':
        requestQuit();
        break;
      case 'file.new':
        actionNew();
        break;
      case 'file.open':
        void actionOpen();
        break;
      case 'file.workspace':
        void workspace.pickAndOpen();
        break;
      case 'file.save':
        void actionSave();
        break;
      case 'file.save_as':
        void actionSaveAs().catch((err) => console.warn('[aurora]', err));
        break;
      case 'file.export':
        void actionExportHtml();
        break;
      case 'file.close_tab':
        closeActiveTab();
        break;
      case 'edit.find':
        runEditorAction('find');
        break;
      case 'edit.search_workspace':
        searchOpen = true;
        break;
      case 'fmt.bold':
        runEditorAction('bold');
        break;
      case 'fmt.italic':
        runEditorAction('italic');
        break;
      case 'fmt.code':
        runEditorAction('code');
        break;
      case 'fmt.link':
        runEditorAction('link');
        break;
      case 'view.theme':
        settings.toggle();
        break;
      case 'view.sidebar':
        layout.toggleSidebar();
        break;
      case 'view.mode.editor':
        layout.setViewMode('editor');
        break;
      case 'view.mode.split':
        layout.setViewMode('split');
        break;
      case 'view.mode.preview':
        layout.setViewMode('preview');
        break;
      case 'view.zoom.in':
        layout.zoomIn();
        break;
      case 'view.zoom.out':
        layout.zoomOut();
        break;
      case 'view.zoom.reset':
        layout.resetZoom();
        break;
    }
  }

  onMount(() => {
    let unlistenMenu: (() => void) | undefined;
    let unlistenFiles: (() => void) | undefined;
    listen<string>('menu', (e) => handleMenu(e.payload)).then((u) => {
      unlistenMenu = u;
    });
    // 运行中：Finder 双击文档 / 拖到 Dock 图标
    listen<string[]>('opened-files', (e) => void openExternalPaths(e.payload)).then((u) => {
      unlistenFiles = u;
    });
    // 冷启动：先拉取启动前累积的打开请求（可能早于监听器就绪）
    startupFiles()
      .then((files) => void openExternalPaths(files))
      .catch(() => {});
    return () => {
      unlistenMenu?.();
      unlistenFiles?.();
    };
  });

  /* ---------------- 全局快捷键 ---------------- */

  function onKeydown(e: KeyboardEvent): void {
    if (e.isComposing) return; // 组字期间不触发快捷键（S1 IME 关注点）
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if (e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void workspace.pickAndOpen(); // 打开文件夹工作区
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      void actionExportHtml();
      return;
    }
    if (e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchOpen = true;
      return;
    }

    switch (e.key.toLowerCase()) {
      case '\\':
        e.preventDefault();
        layout.toggleSidebar();
        break;
      case '1':
        e.preventDefault();
        layout.setViewMode('editor');
        break;
      case '2':
        e.preventDefault();
        layout.setViewMode('split');
        break;
      case '3':
        e.preventDefault();
        layout.setViewMode('preview');
        break;
      case '=':
      case '+':
        e.preventDefault();
        layout.zoomIn();
        break;
      case '-':
        e.preventDefault();
        layout.zoomOut();
        break;
      case '0':
        e.preventDefault();
        layout.resetZoom();
        break;
      case 'n':
        e.preventDefault();
        actionNew();
        break;
      case 'o':
        e.preventDefault();
        void actionOpen();
        break;
      case 'w':
        e.preventDefault();
        closeActiveTab();
        break;
      case 's':
        e.preventDefault();
        if (e.shiftKey) {
          void actionSaveAs().catch((err) => console.warn('[aurora]', err));
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
        const dirtyCount = tabs.tabs.filter((t) => t.dirty).length;
        if (dirtyCount > 0) {
          event.preventDefault();
          confirmMessage =
            dirtyCount === 1
              ? `「${tabs.tabs.find((t) => t.dirty)?.title}」有未保存的更改，关闭窗口将丢失这些修改。`
              : `${dirtyCount} 个标签页有未保存的更改，关闭窗口将丢失这些修改。`;
          pendingAction = () => void getCurrentWindow().destroy();
          confirmOpen = true;
        }
      })
      .then((u) => {
        unlisten = u;
      });
    return () => unlisten?.();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-shell" style:--sidebar-width={`${layout.sidebarWidth}px`} style:--preview-zoom={layout.previewZoom}>
  <TitleBar onOpenSettings={() => (settingsOpen = true)} onExport={() => void actionExportHtml()} />
  <TabBar onRequestClose={requestCloseTab} />

  <div class="app-body" bind:this={bodyEl}>
    {#if !layout.sidebarCollapsed}
      <Sidebar />
      <Resizer
        label="调整侧栏宽度"
        onmove={onSidebarDrag}
        onnudge={(d) => layout.setSidebarWidth(layout.sidebarWidth + d)}
        onreset={() => layout.resetSidebar()}
        valueNow={layout.sidebarWidth}
        valueMin={SIDEBAR_MIN}
        valueMax={SIDEBAR_MAX}
      />
    {/if}
    <main class="split" bind:this={splitEl} style:grid-template-columns={splitCols}>
      <!-- 编辑区常驼：卸载会销毁 CM6 视图并清空所有标签的 EditorState -->
      <EditorPane visible={layout.editorVisible} />
      {#if layout.viewMode === 'split'}
        <Resizer
          label="调整编辑区与预览区比例"
          onmove={onSplitDrag}
          onnudge={nudgeSplit}
          onreset={() => layout.resetSplit()}
          valueNow={Math.round(layout.splitRatio * 100)}
          valueMin={Math.round(RATIO_MIN * 100)}
          valueMax={Math.round(RATIO_MAX * 100)}
        />
      {/if}
      {#if layout.previewVisible}
        <PreviewPane />
      {/if}
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

<SettingsDialog open={settingsOpen} onclose={() => (settingsOpen = false)} />
<SearchDialog open={searchOpen} onclose={() => (searchOpen = false)} />
<GlobalContextMenu />

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

  /* 编辑器 | 预览 分栏。
   * 列宽由 layout.splitRatio 逐帧写入 style（中间 1px 是分割条）。
   * 关键：行必须钉死为容器高（minmax(0,1fr)）。
   * 若用隐式 auto 行，行高会被内容撑开，子项的 height:100% 循环解析
   * 退化为内容高 → 内部滚动容器永不溢出 → 文档无法滚动（v0.1 实测踩坑）。 */
  .split {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
</style>
