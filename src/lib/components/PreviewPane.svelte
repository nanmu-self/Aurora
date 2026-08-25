<!--
  预览区占位（M0）：unified 渲染管道输出将在这里呈现（M1），
  滚动同步基于 data-src-line 行号锚点 + 线性插值（§4.6-D，M3 打磨）。
-->
<section class="preview-pane">
  <div class="placeholder">
    <h2 class="demo-heading">深空有极光，写作有此处。</h2>
    <p class="demo-body">
      unified 渲染管道的输出将在这里呈现，
      标题将携带行号锚点用于双向滚动同步。
    </p>
    <span class="milestone">M1 渲染 · M3 滚动同步</span>
  </div>
</section>

<style>
  .preview-pane {
    display: grid;
    place-items: center;
    min-width: 0;
    background: var(--bg-content);
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    max-width: 320px;
    text-align: center;
  }

  /* 极光渐变文字 —— 品牌色的第二个落点 */
  .demo-heading {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.01em;
    background: var(--aurora-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .demo-body {
    font-size: 12px;
    line-height: 1.75;
    color: var(--text-tertiary);
    user-select: text;
  }

  .milestone {
    font-size: 11px;
    color: var(--text-tertiary);
    opacity: 0.65;
  }
</style>
