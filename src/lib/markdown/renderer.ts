import { convertFileSrc } from '@tauri-apps/api/core';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import type { Root } from 'mdast';
import { join, normalizeSlashes } from '$lib/path';

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

/** 图片解析上下文：由调用方按活动标签页提供 */
export interface RenderCtx {
  /** 当前文件的所在目录；未保存的缓冲区退化为工作区根或 null */
  baseDir: string | null;
  /** 工作区根（`/` 开头的绝对引用以它为基准） */
  workspaceRoot: string | null;
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

/**
 * 相对图片路径 → asset 协议 URL（§4.6-A / S2 Spike）。
 * 规则：http(s)/data/asset/blob/锚点不动；`/x` 以工作区根为基准；其余相对当前文件目录。
 * 注：rehype 插件在 unified 构建时注册，无法携带每次调用的参数，
 * 因此用模块级可变变量传递当前渲染上下文（单预览实例场景下安全）。
 */
let currentCtx: RenderCtx = { baseDir: null, workspaceRoot: null };
function resolveImageSrc(src: string, ctx: RenderCtx): string | null {
  if (/^(https?:|data:|asset:|blob:|mailto:|#)/i.test(src)) return null;
  const norm = normalizeSlashes(src);
  let abs: string | null = null;
  if (norm.startsWith('/')) {
    if (ctx.workspaceRoot) abs = join(ctx.workspaceRoot, norm);
  } else if (!norm.startsWith('~') && ctx.baseDir) {
    abs = join(ctx.baseDir, norm);
  }
  return abs ? convertFileSrc(abs) : null;
}

/**
 * 最小 slug 生成器（近似 GitHub 算法，支持中文）：
 * 1. 去掉内联 Markdown 标记（`*__^~#`）
 * 2. 空格 / 全角空格 → 连字符
 * 3. 去掉剩余标点，仅保留字母 / 数字 / 中文 / 连字符
 * 4. 合并多余连字符并去首尾
 */
function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[`*_~^#]/g, '')  // 去掉行内 Markdown 标记字符
    .replace(/[\s\u3000]+/g, '-')     // 空格 → 连字符
    .replace(/[^\w\u4e00-\u9fff\-]/g, '') // 保留字母/数字/中文/连字符
    .replace(/-+/g, '-')               // 合并连字符
    .replace(/^-|-$/g, '');            // 去首尾连字符
}

/**
 * rehype 插件：为标题节点生成 slug 并写入 id 属性。
 * 重复标题追加 `-1` / `-2` 后缀，行为对齐 GitHub。
 */
const rehypeAuroraSlugs = () => (tree: unknown): void => {
  const seen = new Map<string, number>();
  const collectText = (node: unknown): string => {
    const n = node as { type?: string; value?: string; children?: unknown[] };
    if (n.type === 'text') return n.value ?? '';
    return (n.children ?? []).map(collectText).join('');
  };
  const visit = (node: unknown): void => {
    const n = node as {
      type?: string;
      tagName?: string;
      properties?: Record<string, unknown>;
      children?: unknown[];
    };
    if (n.type === 'element' && typeof n.tagName === 'string' && /^(h[1-6])$/.test(n.tagName)) {
      const text = collectText(n);
      let slug = slugify(text) || n.tagName;  // 兜底用标签名
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      const id = count === 0 ? slug : `${slug}-${count}`;
      (n.properties ??= {}).id = id;
    }
    n.children?.forEach(visit);
  };
  visit(tree);
};

/** rehype 插件：遍历 hast，重写 img.src */
const rehypeAuroraImages = () => (tree: unknown): void => {
  const visit = (node: unknown): void => {
    const n = node as {
      type?: string;
      tagName?: string;
      properties?: Record<string, unknown>;
      children?: unknown[];
    };
    if (n.type === 'element' && n.tagName === 'img' && typeof n.properties?.src === 'string') {
      const resolved = resolveImageSrc(n.properties.src, currentCtx);
      if (resolved) n.properties.src = resolved;
    }
    n.children?.forEach(visit);
  };
  visit(tree);
};

// 不标注返回类型：unified 的 Processor 泛型随插件链变化，交给推断
function createProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeAuroraSlugs)
    .use(rehypeAuroraImages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 该包的 Options 类型在部分版本与 unified 链不兼容，运行时行为正确
    .use(rehypeHighlight, { ignoreMissing: true } as any)
    .use(rehypeStringify);
}

export class BlockRenderer {
  private readonly processor = createProcessor();
  /** hash → 渲染结果缓存 */
  private cache = new Map<string, string>();

  render(text: string, root: HTMLElement, ctx: RenderCtx): void {
    currentCtx = ctx;
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
