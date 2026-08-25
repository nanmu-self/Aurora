import { HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  crosshairCursor,
  rectangularSelection,
  keymap,
  placeholder,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { tags as t } from '@lezer/highlight';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

/**
 * CodeMirror 6 的 Aurora 配置。
 *
 * 注意事项：
 * - 颜色全部引用 tokens.css 的 CSS 变量 → 明暗主题零成本跟随；
 * - Mod+S/O/N 等应用级快捷键由页面层统一接管（见 +page.svelte），不在此绑定；
 * - 不启用 closeBrackets：写作场景下自动配对标点弊大于利（§4.6-E 后续做成开关）；
 * - 不显示行号槽：沉浸写作，行列号放状态栏。
 */

const auroraTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    overflow: 'auto',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
    lineHeight: '1.85',
    padding: '28px 32px',
    /* 舒适行宽：内容居中限宽，滚动条仍贴边 */
    maxWidth: 'calc(46rem + 64px)',
    margin: '0 auto',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--selection-bg) !important',
  },
  '.cm-placeholder': {
    color: 'var(--text-tertiary)',
  },
});

const auroraHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.45em', fontWeight: '650' },
  { tag: t.heading2, fontSize: '1.28em', fontWeight: '650' },
  { tag: t.heading3, fontSize: '1.14em', fontWeight: '600' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '600' },
  { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], marginTop: '0.6em', marginBottom: '0.25em', display: 'inline-block' },
  { tag: t.strong, fontWeight: '700', color: 'var(--text-primary)' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-tertiary)' },
  { tag: t.link, color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' },
  { tag: t.url, color: 'var(--text-tertiary)' },
  {
    tag: t.monospace,
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: '3px',
    padding: '1px 4px',
  },
  { tag: t.quote, color: 'var(--text-secondary)' },
  { tag: t.meta, color: 'var(--text-tertiary)' },
  { tag: t.list, color: 'var(--accent)' },
  /* 内嵌代码块的通用 token */
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.atom], color: 'var(--code-number)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: 'var(--code-function)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--code-function)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--text-secondary)' },
  { tag: t.invalid, color: '#f87171' },
]);

/**
 * history 放进 Compartment：打开新文件 / 新建时重配为空，丢弃旧文档的撤销栈，
 * 避免「打开 B 后 Cmd+Z 穿越回 A 的内容」。
 */
export const historyCompartment = new Compartment();

export function createExtensions(): Extension[] {
  return [
    historyCompartment.of(history()),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    rectangularSelection(),
    crosshairCursor(),
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    syntaxHighlighting(auroraHighlight),
    auroraTheme,
    EditorView.lineWrapping,
    placeholder('开始写作…'),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...markdownKeymap]),
  ];
}
