<script lang="ts">
  /**
   * 侧边栏 AI 面板：对话模式 + 选区优化模式。
   * 优化模式由 ai.optimize 驱动（右键菜单/菜单栏发起），结果预览后手动应用。
   */
  import { ai, OPTIMIZE_PRESETS } from '$lib/stores/ai.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { inTauri } from '$lib/platform';

  let input = $state('');
  let instruction = $state('');
  let listEl: HTMLElement | undefined = $state();

  const desktop = $derived(inTauri());
  const configured = $derived(ai.hasConfig());

  /* 消息或流式内容变化时滚到底部 */
  $effect(() => {
    void ai.messages.map((m) => m.content.length);
    void ai.streaming;
    void ai.result.length;
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  });

  function send(): void {
    if (!input.trim() || ai.streaming) return;
    const text = input;
    input = '';
    void ai.send(text);
  }

  function onInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function runPreset(instr: string): void {
    void ai.runOptimize(instr);
  }

  function runCustom(): void {
    if (!instruction.trim()) return;
    void ai.runOptimize(instruction);
  }
</script>

<div class="ai-panel">
  {#if !desktop}
    <p class="hint">AI 功能仅桌面版可用</p>
  {:else if ai.optimize}
    <!-- ============ 选区优化模式 ============ -->
    <div class="opt-head">
      <span class="opt-title">优化选中文本</span>
      <button class="ghost" onclick={() => ai.closeOptimize()}>返回对话</button>
    </div>

    <div class="opt-body">
      <div class="orig" title={ai.optimize.text}>{ai.optimize.text}</div>

      <div class="chips">
        {#each OPTIMIZE_PRESETS as p (p.id)}
          <button
            class="chip"
            class:busy={ai.optimizing}
            disabled={ai.optimizing}
            onclick={() => runPreset(p.instruction)}
          >
            {p.label}
          </button>
        {/each}
      </div>

      <div class="custom-row">
        <input
          type="text"
          placeholder="自定义指令，如：改成正式语气"
          bind:value={instruction}
          disabled={ai.optimizing}
          onkeydown={(e) => {
            if (e.key === 'Enter' && !e.isComposing) runCustom();
          }}
        />
        <button class="go" disabled={ai.optimizing || !instruction.trim()} onclick={runCustom}>
          生成
        </button>
      </div>

      {#if ai.optimizing || ai.result || ai.resultError}
        <div class="result">
          {#if ai.optimizing && !ai.result}
            <span class="thinking"><span class="dots" aria-label="正在生成"><i></i><i></i><i></i></span>正在生成…</span>
          {:else if ai.resultError}
            <span class="err">{ai.resultError}</span>
          {:else}
            <span class="stream">{ai.result}{#if ai.optimizing}<i class="caret"></i>{/if}</span>
          {/if}
        </div>
      {/if}
    </div>

    {#if ai.result}
      <div class="opt-actions">
        <button class="primary" onclick={() => ai.applyReplace()}>替换选区</button>
        <button onclick={() => ai.applyInsert()}>插入光标处</button>
        <button onclick={() => void ai.copyResult()}>复制</button>
        <button class="danger" onclick={() => ai.closeOptimize()}>放弃</button>
      </div>
    {:else if ai.optimizing}
      <div class="opt-actions">
        <button class="stop" onclick={() => ai.stop()}>停止</button>
      </div>
    {/if}
  {:else}
    <!-- ============ 对话模式 ============ -->
    <div class="chat-head">
      <span class="chat-title">AI 助手</span>
      {#if ai.messages.length > 0}
        <button class="ghost" onclick={() => ai.clearChat()}>清空</button>
      {/if}
    </div>

    <div class="list" bind:this={listEl}>
      {#if ai.messages.length === 0}
        {#if !configured}
          <p class="hint">
            尚未配置 AI 服务
            <span>在设置中填写 OpenAI 兼容的服务地址、Key 与模型名后即可使用</span>
            <button class="config-btn" onclick={() => ai.requestSettings()}>去配置</button>
          </p>
        {:else}
          <p class="hint">
            有什么可以帮你？
            <span>在编辑器中选中文字右键「AI 优化」，或直接向我提问</span>
          </p>
        {/if}
      {:else}
        {#each ai.messages as m, i (i)}
          <div class="msg" class:user={m.role === 'user'}>
            <span class="role">{m.role === 'user' ? '我' : 'AI'}</span>
            {#if m.quote}
              <p class="msg-quote">{m.quote}</p>
            {/if}
            {#if ai.streaming && i === ai.messages.length - 1 && m.role === 'assistant' && !m.content}
              <!-- 首 token 未到：思考中动效，避免空白像卡死 -->
              <p class="content"><span class="dots" aria-label="AI 正在思考"><i></i><i></i><i></i></span></p>
            {:else}
              <p class="content">{m.content}{#if ai.streaming && i === ai.messages.length - 1 && m.role === 'assistant'}<i class="caret"></i>{/if}</p>
            {/if}
          </div>
        {/each}
      {/if}
      {#if ai.error}
        <p class="err">{ai.error}</p>
      {/if}
    </div>

    <div class="composer">
      {#if ai.quoted}
        <div class="quote-box">
          <div class="q-head">
            <span class="q-label">引用选中文本</span>
            <button class="q-remove" title="移除引用" onclick={() => ai.clearQuote()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <p class="q-text">{ai.quoted}</p>
        </div>
      {/if}
      <label class="doc-toggle">
        <input type="checkbox" bind:checked={ai.includeDoc} />
        引用当前文档
      </label>
      <div class="input-row">
        <textarea
          rows="2"
          placeholder="向 AI 提问…（Enter 发送，Shift+Enter 换行）"
          bind:value={input}
          onkeydown={onInputKeydown}
          disabled={!configured}
        ></textarea>
        {#if ai.streaming}
          <button class="stop" onclick={() => ai.stop()}>停止</button>
        {:else}
          <button class="send" onclick={send} disabled={!input.trim() || !configured}>发送</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .ai-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .hint {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    margin-top: 36px;
    padding: 0 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .hint span {
    font-size: 11px;
    opacity: 0.65;
  }

  .config-btn {
    margin-top: 8px;
    padding: 5px 16px;
    border-radius: var(--radius-md);
    font-size: 11.5px;
    font-weight: 600;
    color: #10141c;
    background: var(--aurora-gradient);
  }

  /* ---------- 头部 ---------- */

  .chat-head,
  .opt-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 4px;
  }

  .chat-title,
  .opt-title {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .ghost {
    padding: 2px 6px;
    font-size: 11px;
    color: var(--text-tertiary);
    border-radius: var(--radius-sm);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .ghost:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  /* ---------- 对话模式 ---------- */

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px 10px;
  }

  .msg {
    margin-bottom: 10px;
  }

  .role {
    font-size: 10px;
    color: var(--text-tertiary);
  }

  .msg.user .role {
    color: var(--accent);
  }

  .content {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .msg.user .content {
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 5px 8px;
  }

  /* 流式光标 */
  .caret {
    display: inline-block;
    width: 2px;
    height: 12px;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: var(--accent);
    animation: blink 0.9s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  /* 思考中：跳动圆点（首 token 未到时的等待反馈） */
  .dots {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-right: 6px;
  }

  .dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--text-tertiary);
    animation: dot-bounce 1.2s ease-in-out infinite;
  }

  .dots i:nth-child(2) {
    animation-delay: 0.15s;
  }

  .dots i:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes dot-bounce {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.35;
    }

    30% {
      transform: translateY(-3px);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .caret,
    .dots i {
      animation: none;
    }
  }

  .err {
    font-size: 11px;
    line-height: 1.5;
    color: #e0716a;
    word-break: break-word;
    margin: 6px 0;
  }

  .thinking {
    font-size: 11.5px;
    color: var(--text-tertiary);
  }

  .composer {
    flex-shrink: 0;
    padding: 6px 10px 10px;
    border-top: 1px solid var(--border-subtle);
  }

  /* ---------- 引用块 ---------- */

  .quote-box {
    margin-bottom: 6px;
    padding: 6px 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-left: 2px solid var(--accent);
    border-radius: var(--radius-sm);
  }

  .q-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .q-label {
    font-size: 10px;
    color: var(--accent);
    letter-spacing: 0.03em;
  }

  .q-remove {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    color: var(--text-tertiary);
    border-radius: var(--radius-sm);
  }

  .q-remove:hover {
    background: var(--bg-chrome);
    color: var(--text-primary);
  }

  .q-remove svg {
    width: 10px;
    height: 10px;
  }

  .q-text,
  .msg-quote {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-tertiary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .msg-quote {
    margin-top: 4px;
    padding: 4px 6px;
    background: var(--bg-app);
    border-radius: var(--radius-sm);
  }

  .doc-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 6px;
    font-size: 11px;
    color: var(--text-tertiary);
    cursor: pointer;
  }

  .doc-toggle input {
    width: 13px;
    height: 13px;
    accent-color: var(--accent);
  }

  .input-row {
    display: flex;
    gap: 6px;
    align-items: flex-end;
  }

  textarea {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    font-size: 12px;
    line-height: 1.5;
    background: var(--bg-app);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    resize: none;
  }

  textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  textarea:disabled {
    opacity: 0.5;
  }

  .send,
  .stop,
  .go {
    flex-shrink: 0;
    padding: 6px 12px;
    font-size: 11.5px;
    font-weight: 500;
    border-radius: var(--radius-sm);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      opacity var(--dur-fast) var(--ease-out);
  }

  .send {
    color: #10141c;
    background: var(--aurora-gradient);
  }

  .send:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  .send:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .stop {
    color: var(--text-secondary);
    border: 1px solid var(--border-strong);
  }

  .stop:hover {
    background: var(--bg-elevated);
  }

  /* ---------- 优化模式 ---------- */

  .opt-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .orig {
    max-height: 110px;
    overflow-y: auto;
    padding: 6px 8px;
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--bg-app);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    padding: 3px 10px;
    font-size: 11px;
    color: var(--text-secondary);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .chip:hover:not(:disabled) {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .chip:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .custom-row {
    display: flex;
    gap: 6px;
  }

  .custom-row input {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    font-size: 11.5px;
    background: var(--bg-app);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }

  .custom-row input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .go {
    color: #10141c;
    background: var(--aurora-gradient);
  }

  .go:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .result {
    padding: 6px 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }

  .opt-actions {
    flex-shrink: 0;
    display: flex;
    gap: 6px;
    padding: 8px 10px 10px;
    border-top: 1px solid var(--border-subtle);
  }

  .opt-actions button {
    flex: 1;
    padding: 5px 0;
    font-size: 11px;
    color: var(--text-secondary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .opt-actions button:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .opt-actions .primary {
    color: #10141c;
    background: var(--aurora-gradient);
    border-color: transparent;
    font-weight: 600;
  }

  .opt-actions .danger:hover {
    color: #e0716a;
  }
</style>
