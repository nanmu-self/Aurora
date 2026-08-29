/**
 * AI 状态（对话 + 选区优化），会话仅存内存不持久化。
 *
 * - 对话与优化共用同一个 Rust 流式命令，区别在消息编排；
 * - 优化结果先预览、由用户手动应用；「替换选区」前校验原文未变，
 *   已变化时降级为插入光标处，防止 AI 请求期间文档被编辑导致错位覆盖。
 */
import { aiChat, aiCancel, AI_CANCELLED, type AiChatMessage } from '$lib/commands/ai';
import { selectionRange, replaceRange } from '$lib/editor/actions';
import { getActiveText, getView, insertAtCursor } from '$lib/editor/bridge';
import { settings } from './settings.svelte';
import { ui } from './ui.svelte';
import { layout } from './layout.svelte';
import { status } from './editorStatus.svelte';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/** 待优化的选区快照 */
export interface OptimizeTask {
  from: number;
  to: number;
  text: string;
}

export const OPTIMIZE_PRESETS = [
  { id: 'polish', label: '润色', instruction: '优化文字表达，使其更流畅、更有文采，保持原意与格式' },
  { id: 'fix', label: '纠错', instruction: '修正错别字、语病和标点问题，保持原意与格式' },
  { id: 'en', label: '译为英文', instruction: '将文本翻译成地道的英文，保持 Markdown 格式' },
  { id: 'zh', label: '译为中文', instruction: '将文本翻译成自然流畅的简体中文，保持 Markdown 格式' },
  { id: 'summary', label: '总结', instruction: '提炼要点，生成简洁的总结' },
] as const;

class AiStore {
  /** 对话消息（成对追加，最后一条 assistant 流式填充） */
  messages = $state<ChatMsg[]>([]);
  streaming = $state(false);
  error = $state('');
  /** 是否把当前文档全文作为上下文附带 */
  includeDoc = $state(false);

  /** 优化模式：非 null 时面板进入选区优化视图 */
  optimize = $state<OptimizeTask | null>(null);
  optimizing = $state(false);
  result = $state('');
  resultError = $state('');

  /** 由 +page.svelte 注入，未配置时引导打开设置 */
  requestSettings: () => void = () => {};
  setSettingsOpener(fn: () => void): void {
    this.requestSettings = fn;
  }

  hasConfig(): boolean {
    return !!(settings.aiBaseUrl.trim() && settings.aiModel.trim());
  }

  #config() {
    return {
      baseUrl: settings.aiBaseUrl.trim(),
      apiKey: settings.aiApiKey.trim(),
      model: settings.aiModel.trim(),
    };
  }

  /** 从编辑器当前选区发起优化；无选区时提示 */
  optimizeFromSelection(): boolean {
    const sel = selectionRange();
    if (!sel) {
      status.show('请先在编辑器中选中要处理的文字');
      return false;
    }
    this.optimize = sel;
    this.result = '';
    this.resultError = '';
    ui.sidebarTab = 'ai';
    layout.sidebarCollapsed = false;
    return true;
  }

  /** 执行优化（instruction 为预设指令或用户自定义指令） */
  async runOptimize(instruction: string): Promise<void> {
    const task = this.optimize;
    if (!task || this.optimizing || !instruction.trim()) return;
    if (!this.hasConfig()) {
      this.requestSettings();
      return;
    }
    this.optimizing = true;
    this.result = '';
    this.resultError = '';
    const msgs: AiChatMessage[] = [
      {
        role: 'system',
        content:
          '你是 Markdown 文本处理助手。只返回处理后的正文文本本身，不要任何解释，不要用代码块包裹。',
      },
      { role: 'user', content: `请对下面的文本执行：「${instruction.trim()}」：\n\n${task.text}` },
    ];
    try {
      const full = await aiChat(this.#config(), msgs, (d) => {
        this.result += d;
      });
      this.result = full || this.result;
    } catch (e) {
      if (!(typeof e === 'string' && e === AI_CANCELLED)) {
        this.resultError = typeof e === 'string' ? e : String(e);
      }
    } finally {
      this.optimizing = false;
    }
  }

  /** 停止进行中的优化/对话请求（保留已生成的部分） */
  stop(): void {
    void aiCancel().catch(() => {});
  }

  /**
   * 应用优化结果。replace 校验原文未变，否则降级插入光标处。
   * 返回提示语（已通过状态栏展示），调用方负责关闭优化视图。
   */
  #apply(mode: 'replace' | 'insert'): void {
    const task = this.optimize;
    if (!task || !this.result.trim()) return;
    if (mode === 'replace') {
      const view = getView();
      if (view && view.state.sliceDoc(task.from, task.to) === task.text) {
        replaceRange(task.from, task.to, this.result);
      } else {
        insertAtCursor(this.result);
        status.show('原文已变化，结果已插入到光标处');
      }
    } else {
      insertAtCursor(this.result);
    }
    this.closeOptimize();
  }

  applyReplace(): void {
    this.#apply('replace');
  }

  applyInsert(): void {
    this.#apply('insert');
  }

  /** 放弃优化视图（进行中则一并取消请求） */
  closeOptimize(): void {
    if (this.optimizing) this.stop();
    this.optimize = null;
    this.result = '';
    this.resultError = '';
  }

  async copyResult(): Promise<void> {
    if (!this.result) return;
    try {
      const { writeClipboardText } = await import('$lib/commands/clipboard');
      await writeClipboardText(this.result);
      status.show('已复制到剪贴板');
    } catch {
      await navigator.clipboard.writeText(this.result).catch(() => {});
    }
  }

  /** 发送一条对话消息 */
  async send(text: string): Promise<void> {
    const t = text.trim();
    if (!t || this.streaming) return;
    if (!this.hasConfig()) {
      this.requestSettings();
      return;
    }
    this.error = '';
    const msgs: AiChatMessage[] = [];
    if (this.includeDoc) {
      const doc = getActiveText();
      if (doc.trim()) {
        msgs.push({
          role: 'system',
          content: `以下是用户当前正在编辑的 Markdown 文档全文，回答时可参考：\n\n${doc}`,
        });
      }
    }
    for (const m of this.messages) msgs.push({ role: m.role, content: m.content });
    msgs.push({ role: 'user', content: t });

    this.messages.push({ role: 'user', content: t }, { role: 'assistant', content: '' });
    this.streaming = true;
    try {
      const full = await aiChat(this.#config(), msgs, (d) => {
        const last = this.messages[this.messages.length - 1];
        if (last) last.content += d;
      });
      const last = this.messages[this.messages.length - 1];
      if (last) last.content = full || last.content;
    } catch (e) {
      if (!(typeof e === 'string' && e === AI_CANCELLED)) {
        this.error = typeof e === 'string' ? e : String(e);
      }
    } finally {
      this.streaming = false;
    }
  }

  /** 清空对话 */
  clearChat(): void {
    if (this.streaming) this.stop();
    this.messages = [];
    this.error = '';
  }
}

export const ai = new AiStore();
