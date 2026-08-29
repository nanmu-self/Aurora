import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

/**
 * AI 消息的 Markdown → HTML（同步，供 {@html} 使用）。
 *
 * 与预览/导出同一条 unified 管线；remarkRehype 默认不透传原始 HTML 标签，
 * AI 输出里的 <script> 等会被当作纯文本 —— 天然规避 XSS 注入面。
 * 不做 asset 协议改写：AI 输出中的相对图片路径无解析意义。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 同 renderer.ts 的版本兼容性取舍
const rehypeHighlightOptions: any = { ignoreMissing: true };

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeHighlight, rehypeHighlightOptions)
  .use(rehypeStringify);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] as string);
}

/** 渲染失败时退化为转义后的纯文本，绝不抛出（流式期间部分输入很常见） */
export function renderMarkdownHtml(markdown: string): string {
  if (!markdown.trim()) return '';
  try {
    return String(processor.processSync(markdown));
  } catch {
    return `<p>${escapeHtml(markdown)}</p>`;
  }
}
