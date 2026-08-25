<!--
  底部状态栏：字数统计 / 行列号 / 保存状态。
  真实数据自 M1 起由编辑器的派生状态单向订阅而来（§4.3 原则 2）。
-->
<footer class="statusbar">
  <div class="group">
    <span class="item">0 字</span>
    <span class="sep">·</span>
    <span class="item">Ln 1, Col 1</span>
  </div>

  <div class="group">
    <span class="item">
      <i class="dot" aria-hidden="true"></i>
      已保存
    </span>
  </div>
</footer>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    height: var(--statusbar-height);
    padding: 0 10px;
    font-size: 11px;
    color: var(--text-tertiary);
    background: var(--bg-chrome);
    border-top: 1px solid var(--border-subtle);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sep {
    opacity: 0.5;
  }

  .item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  /* 保存状态点：极光青（M1 起随 dirty 状态变色） */
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }
</style>
