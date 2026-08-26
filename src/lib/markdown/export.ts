import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

/**
 * 导出 HTML（M4）：单文件、自包含样式，可直接分享或打印为 PDF。
 *
 * 与预览渲染器的差异：
 * - 不做 asset 协议改写 —— 保留源文件里的相对图片路径，
 *   把导出的 HTML 放在 md 同目录即可正常显示图片；
 * - KaTeX 样式走 CDN link：离线查看时公式退化为可读的标记文本（v1 取舍）。
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

/** 极光导出模板：克制的浅色纸面，打印友好 */
function template(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<!-- 数学公式样式（离线时公式显示为标记文本） -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 24px 96px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    font-size: 15px; line-height: 1.85; letter-spacing: 0.012em;
    color: #26282e; background: #faf9f6;
    text-autospace: normal;
  }
  main { max-width: 720px; margin: 0 auto; }
  h1, h2, h3, h4, h5, h6 { font-weight: 650; line-height: 1.4; margin: 1.6em 0 0.6em; letter-spacing: 0.01em; }
  h1 { font-size: 1.9em; border-bottom: 1px solid rgba(28,30,38,.08); padding-bottom: 8px; margin-top: 0; }
  h2 { font-size: 1.5em; border-bottom: 1px solid rgba(28,30,38,.08); padding-bottom: 6px; }
  h3 { font-size: 1.25em; } h4, h5, h6 { font-size: 1.05em; }
  p { margin: 0 0 14px; }
  a { color: #0d9488; text-decoration: underline; text-underline-offset: 3px; }
  strong { font-weight: 700; }
  ul, ol { padding-left: 1.6em; margin: 0 0 14px; }
  li { margin: 4px 0; }
  li > p { margin: 0 0 4px; }
  li.task-list-item { list-style: none; margin-left: -1.5em; }
  input[type=checkbox] { accent-color: #0d9488; vertical-align: -2px; margin-right: 7px; }
  blockquote {
    margin: 0 0 16px; padding: 4px 0 4px 18px;
    border-left: 2px solid #5eead4; color: #565b64;
  }
  hr { border: none; border-top: 1px solid rgba(28,30,38,.1); margin: 32px 0; }
  code {
    font-family: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.86em; background: #f0efeb; border-radius: 4px; padding: 1px 5px;
  }
  pre {
    background: #f0efeb; border: 1px solid rgba(28,30,38,.08); border-radius: 8px;
    padding: 14px 16px; overflow-x: auto; line-height: 1.7;
  }
  pre code { background: none; padding: 0; font-size: 13px; }
  table { border-collapse: collapse; margin: 0 0 16px; font-size: 0.95em; }
  th, td { border: 1px solid rgba(28,30,38,.12); padding: 7px 14px; }
  th { background: #f2f1ec; font-weight: 600; text-align: left; }
  img { max-width: 100%; border-radius: 6px; }
  /* highlight.js token 配色 */
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag { color: #3b5bdb; }
  .hljs-string, .hljs-regexp, .hljs-addition { color: #0f766e; }
  .hljs-number, .hljs-symbol, .hljs-bullet, .hljs-attr, .hljs-variable { color: #b45309; }
  .hljs-title, .hljs-title.class_, .hljs-title.function_, .hljs-section, .hljs-name { color: #4f46e5; }
  .hljs-comment, .hljs-quote { color: #a0a4ad; font-style: italic; }
  .katex-display { overflow-x: auto; overflow-y: hidden; padding: 4px 0; }
  footer { max-width: 720px; margin: 64px auto 0; color: #a0a4ad; font-size: 12px; }
  @media print {
    body { padding: 0; background: #fff; }
    main, footer { max-width: none; }
    pre, blockquote, img, table { break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
<footer>由 Aurora 导出 · ${new Date().toLocaleDateString('zh-CN')}</footer>
</body>
</html>`;
}

export function markdownToStandaloneHtml(markdown: string, title: string): string {
  let body = '';
  if (markdown.trim()) {
    try {
      body = String(processor.processSync(markdown));
    } catch (e) {
      body = `<pre>渲染失败：${escapeHtml(String(e))}</pre>`;
    }
  }
  return template(title, body);
}
