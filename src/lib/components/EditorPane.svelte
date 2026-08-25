<!--
  编辑区占位（M0）：CodeMirror 6 将在此挂载（M1）。
  届时本组件负责创建 EditorView 并持有各标签页的 EditorState，
  正文唯一事实源是 EditorState（执行计划 §4.3 原则 2）。
-->
<section class="editor-pane">
  <div class="placeholder">
<pre class="sample"># Aurora

&gt; 深空有极光，写作有此处。

CodeMirror 6 将挂载于此：
语法高亮 · 快捷键体系 · history 撤销栈</pre>
    <span class="milestone">M1 · 编辑闭环</span>
  </div>
</section>

<style>
  .editor-pane {
    display: grid;
    place-items: center;
    min-width: 0;
    background: var(--bg-content);
    border-right: 1px solid var(--border-subtle);
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
  }

  .sample {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.75;
    color: var(--text-tertiary);
    white-space: pre-wrap;
    user-select: text;
    cursor: text;
  }

  .milestone {
    font-size: 11px;
    color: var(--text-tertiary);
    opacity: 0.65;
  }
</style>
