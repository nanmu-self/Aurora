import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { ensureDir, writeBinaryFile } from '$lib/commands/fs';
import { dirname, join } from '$lib/path';
import { tabs } from '$lib/stores/tabs.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { status } from '$lib/stores/editorStatus.svelte';
import { insertAtCursor } from './bridge';

/**
 * 图片粘贴/拖入落盘链路（M3，§4.6-A 写入侧）：
 * 剪贴板/拖入的图片 → 工作区 assets/ → 光标处插入相对路径引用。
 * 保存基准目录：当前文件所在目录；未保存缓冲区退化为工作区根。
 */

const EXT_WHITELIST = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']);

function timestampName(ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6);
  return `image-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}-${rand}.${ext}`;
}

export async function saveImageAndInsert(file: File): Promise<void> {
  const t = tabs.active;
  const baseDir = t?.path ? dirname(t.path) : workspace.root;
  if (!baseDir) {
    status.show('请先保存文件（或打开工作区）再插入图片');
    return;
  }
  try {
    const assetsDir = join(baseDir, 'assets');
    await ensureDir(assetsDir);

    const rawExt = (file.name.split('.').pop() ?? '').toLowerCase();
    const ext = EXT_WHITELIST.has(rawExt) ? rawExt : 'png';
    const name = timestampName(ext);
    const fullPath = join(assetsDir, name);

    const buf = await file.arrayBuffer();
    await writeBinaryFile(fullPath, new Uint8Array(buf));

    insertAtCursor(`![](assets/${name})`);
  } catch (e) {
    status.show(`图片保存失败：${String(e)}`);
  }
}

function firstImage(files: FileList | null | undefined): File | null {
  if (!files) return null;
  for (const f of files) {
    if (f.type.startsWith('image/')) return f;
  }
  return null;
}

/** 编辑器的粘贴/拖入图片拦截扩展 */
export function imageDropPasteExtension(): Extension {
  return EditorView.domEventHandlers({
    paste(event: ClipboardEvent): boolean {
      const img = firstImage(event.clipboardData?.files);
      if (!img) return false;
      event.preventDefault();
      void saveImageAndInsert(img);
      return true;
    },
    drop(event: DragEvent): boolean {
      const img = firstImage(event.dataTransfer?.files);
      if (!img) return false;
      event.preventDefault();
      void saveImageAndInsert(img);
      return true;
    },
    dragover(event: DragEvent): boolean {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault(); // 允许放置
      }
      return false;
    },
  });
}
