<script lang="ts">
  interface Props {
    open: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let {
    open,
    title = '未保存的更改',
    message = '',
    confirmText = '不保存并继续',
    cancelText = '取消',
    onconfirm,
    oncancel,
  }: Props = $props();

  function onKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      oncancel();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <!-- 未保存保护等破坏性操作的确认层（M1 不引入第三方弹窗库） -->
  <div class="overlay" role="presentation">
    <div class="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2>
      <p>{message}</p>
      <div class="actions">
        <button class="ghost" onclick={oncancel}>{cancelText}</button>
        <button class="primary" onclick={onconfirm}>{confirmText}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-popover);
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 42%);
    backdrop-filter: blur(3px);
  }

  .dialog {
    width: 340px;
    padding: 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
  }

  h2 {
    font-size: 13.5px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  p {
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-secondary);
    user-select: text;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 18px;
  }

  button {
    padding: 5px 14px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      filter var(--dur-fast) var(--ease-out);
  }

  .ghost {
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle);
  }

  .ghost:hover {
    background: var(--bg-app);
    color: var(--text-primary);
  }

  /* 确认按钮用极光渐变 —— 品牌色的第三个落点 */
  .primary {
    font-weight: 600;
    color: #10141c;
    background: var(--aurora-gradient);
  }

  .primary:hover {
    filter: brightness(1.06);
  }
</style>
