import { getActiveText, notifyDocChanged, replaceActiveDoc } from '$lib/editor/bridge';
import { pickOpenPath, pickSavePath, readTextFile, writeTextFile } from '$lib/commands/fs';
import { status } from '$lib/stores/editorStatus.svelte';

function fmtErr(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * 当前文档状态：路径 / dirty / 保存动作。
 *
 * 注意：正文本身存在 CM6 State 里（§4.3 原则 2），这里只持有元信息；
 * 需要正文时通过 bridge.getActiveText() 在离散时机取用。
 */
class DocStore {
  /** 当前文件绝对路径；null 表示未命名缓冲区 */
  path = $state<string | null>(null);
  /** 最近一次保存时的全文快照 */
  savedText = $state('');
  /** 是否有未保存修改 */
  dirty = $state(false);

  get title(): string {
    if (!this.path) return '未命名';
    return this.path.split('/').pop() ?? this.path;
  }

  markClean(): void {
    this.savedText = getActiveText();
    this.dirty = false;
  }

  /** 保存到当前路径；无路径时转入另存为。返回是否保存成功 */
  async save(): Promise<boolean> {
    if (!this.path) return this.saveAs();
    try {
      await writeTextFile(this.path, getActiveText());
      this.markClean();
      return true;
    } catch (e) {
      status.show(`保存失败：${fmtErr(e)}`);
      return false;
    }
  }

  /** 另存为：弹系统对话框选路径。取消返回 false */
  async saveAs(): Promise<boolean> {
    const defaultName = this.path ? this.title : '未命名.md';
    const path = await pickSavePath(defaultName);
    if (!path) return false;
    try {
      await writeTextFile(path, getActiveText());
      this.path = path;
      this.markClean();
      return true;
    } catch (e) {
      status.show(`保存失败：${fmtErr(e)}`);
      return false;
    }
  }

  /** 打开文件并载入编辑器；读取失败向上抛出由调用方呈现 */
  async open(path: string): Promise<void> {
    const text = await readTextFile(path);
    replaceActiveDoc(text);
    this.path = path;
    this.savedText = text;
    this.dirty = false;
    notifyDocChanged(); // 立即刷新预览，不等防抖
  }

  /** 新建空白缓冲区 */
  newBuffer(): void {
    replaceActiveDoc('');
    this.path = null;
    this.savedText = '';
    this.dirty = false;
    notifyDocChanged();
  }
}

export const doc = new DocStore();
