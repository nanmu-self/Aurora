import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import type { Root } from 'mdast';

/**
 * 分栏实时预览的渲染器 —— §4.6-C「块级增量渲染」的实现。
 *
 * 流程：
 * 1. 全文 parse 一次拿到顶层块的行号边界（mdast position 信息，即 §4.6-D 锚点来源）；
 * 2. 对每个块按源码切片求哈希，命中缓存直接复用 HTML，未命中的才跑完整渲染管道；
 * 3. 以哈希为 key 对 DOM 做最小化 patch（复用/移动/新建/删除），避免全量 innerHTML。
 *
 * 已知取舍（v1 可接受）：
 * - 跨块引用的链接定义 / 脚注定义在切片渲染时会失效（Typora 同样如此处理分块）；
 * - remarkRehype 默认不透传原始 HTML 标签 —— 天然规避 XSS 注入面。
 */

interface RenderBlock {
  /** 内容哈希（FNV-1a），同时作为 DOM 复用的 key */
  key: string;
  startLine: number;
  endLine: number;
  html: string;
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] as string);
}

// 不标注返回类型：unified 的 Processor 泛型随插件链变化，交给推断
function createProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 该包的 Options 类型在部分版本与 unified 链不兼容，运行时行为正确
    .use(rehypeHighlight, { ignoreMissing: true } as any)
    .use(rehypeStringify);
}

export class BlockRenderer {
  private readonly processor = createProcessor();
  /** hash → 渲染结果缓存 */
  private cache = new Map<string, string>();

  render(text: string, root: HTMLElement): void {
    if (!text.trim()) {
      this.cache.clear();
      root.replaceChildren();
      return;
    }

    const tree = this.processor.parse(text) as Root;
    const lines = text.split('\n');
    const blocks: RenderBlock[] = [];

    for (const node of tree.children) {
      const pos = node.position;
      if (!pos) continue;
      const slice = lines.slice(pos.start.line - 1, pos.end.line).join('\n');
      const key = String(hashString(slice));

      let html = this.cache.get(key);
      if (html === undefined) {
        try {
          html = String(this.processor.processSync(slice));
        } catch (e) {
          html = `<pre data-render-error>渲染失败：${escapeHtml(String(e))}</pre>`;
        }
        // 缓存上限：超出后整体清空（粗暴但有效的防膨胀策略）
        if (this.cache.size > 800) this.cache.clear();
        this.cache.set(key, html);
      }

      blocks.push({ key, startLine: pos.start.line, endLine: pos.end.line, html });
    }

    this.patch(root, blocks);
  }

  /** 以哈希为 key 的最小化 DOM reconcile：保序、复用节点、只动必须动的部分 */
  private patch(root: HTMLElement, blocks: RenderBlock[]): void {
    const pool = new Map<string, HTMLElement[]>();
    for (const el of Array.from(root.children) as HTMLElement[]) {
      const k = el.dataset.hash ?? '';
      const list = pool.get(k);
      if (list) list.push(el);
      else pool.set(k, [el]);
    }

    const finals: HTMLElement[] = [];
    for (const b of blocks) {
      let el = pool.get(b.key)?.pop();
      if (!el) {
        el = document.createElement('div');
        el.className = 'md-block';
        el.innerHTML = b.html;
      }
      el.dataset.hash = b.key;
      el.dataset.startLine = String(b.startLine); // M3 滚动同步锚点
      el.dataset.endLine = String(b.endLine);
      finals.push(el);
    }

    let cursor = root.firstChild;
    for (const el of finals) {
      if (el === cursor) {
        cursor = cursor.nextSibling;
        continue;
      }
      root.insertBefore(el, cursor); // 复用节点被移动到位
    }
    while (cursor) {
      const next = cursor.nextSibling;
      root.removeChild(cursor);
      cursor = next;
    }
  }
}
