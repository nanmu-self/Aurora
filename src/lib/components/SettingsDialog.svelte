<script lang="ts">
  import { onMount } from 'svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import { settings, type ThemeMode } from '$lib/stores/settings.svelte';
  import { inTauri } from '$lib/platform';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  $effect(() => {
    if (open) {
      liveFontSize = settings.editorFontSize;
    }
  });

  let appVersion = $state('');
  /** 拖动中的字号：即时显示，节流写入 store */
  let liveFontSize = $state<number | null>(null);
  let rafId = 0;

  onMount(() => {
    if (inTauri()) {
      getVersion()
        .then((v) => (appVersion = v ?? ''))
        .catch(() => {});
    }
    return () => cancelAnimationFrame(rafId);
  });

  /** 节流到每帧一次写入 store——预览跟手但不超 60fps */
  function flushFontSize(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (liveFontSize !== null) {
        settings.update({ editorFontSize: liveFontSize });
      }
    });
  }

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: '跟随系统' },
    { id: 'dark', label: '深空' },
    { id: 'light', label: '晨雾' },
  ];

  const delayOptions = [
    { ms: 800, label: '0.8 秒' },
    { ms: 1500, label: '1.5 秒' },
    { ms: 3000, label: '3 秒' },
  ];

  function onKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div class="overlay" role="presentation">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="设置">
      <header>
        <h2>设置</h2>
        <button class="x" aria-label="关闭设置" onclick={onclose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <!-- 主题 -->
      <section>
        <p class="label">主题</p>
        <div class="seg">
          {#each themeOptions as opt (opt.id)}
            <button
              class:on={settings.mode === opt.id}
              onclick={() => settings.set(opt.id)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </section>

      <!-- 编辑器字号 -->
      <section>
        <p class="label">编辑器字号 <span class="value">{liveFontSize ?? settings.editorFontSize}px</span></p>
        <input
          type="range"
          min="12"
          max="20"
          step="1"
          bind:value={liveFontSize}
          oninput={() => flushFontSize()}
        />
      </section>

      <!-- 滚动同步 -->
      <section>
        <div class="row">
          <div>
            <p class="label">滚动同步</p>
            <p class="desc">编辑器与预览互相跟随滚动</p>
          </div>
          <input
            type="checkbox"
            checked={settings.scrollSync}
            onchange={(e) => settings.update({ scrollSync: e.currentTarget.checked })}
          />
        </div>
      </section>

      <!-- 自动保存 -->
      <section>
        <div class="row">
          <div>
            <p class="label">自动保存</p>
            <p class="desc">仅对已保存过的文件生效</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autosaveEnabled}
            onchange={(e) => settings.update({ autosaveEnabled: e.currentTarget.checked })}
          />
        </div>
        {#if settings.autosaveEnabled}
          <div class="row sub">
            <p class="label">延迟</p>
            <div class="seg small">
              {#each delayOptions as opt (opt.ms)}
                <button
                  class:on={settings.autosaveDelayMs === opt.ms}
                  onclick={() => settings.update({ autosaveDelayMs: opt.ms })}
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </section>

      <footer class="about">Aurora{appVersion ? ` v${appVersion}` : ''} · 本地优先的 Markdown 编辑器</footer>
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
    width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 18px 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  h2 {
    font-size: 14px;
    font-weight: 650;
  }

  .x {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
  }

  .x:hover {
    background: var(--bg-chrome);
    color: var(--text-primary);
  }

  .x svg {
    width: 13px;
    height: 13px;
  }

  section {
    padding: 12px 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  section:last-of-type {
    border-bottom: none;
  }

  .label {
    font-size: 12.5px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .value {
    color: var(--text-tertiary);
    font-weight: 400;
    margin-left: 6px;
  }

  .desc {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: -4px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .row.sub {
    margin-top: 10px;
    padding-left: 2px;
  }

  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }

  .seg {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    background: var(--bg-app);
    border-radius: var(--radius-md);
  }

  .seg button {
    padding: 4px 12px;
    font-size: 11.5px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .seg button.on {
    background: var(--bg-elevated);
    color: var(--text-primary);
    box-shadow: inset 0 0 0 1px var(--border-subtle);
  }

  .about {
    margin-top: 10px;
    text-align: center;
    font-size: 10.5px;
    color: var(--text-tertiary);
    opacity: 0.7;
  }
</style>
