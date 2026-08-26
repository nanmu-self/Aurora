<script lang="ts">
  import '$lib/styles/tokens.css';
  import '$lib/styles/base.css';
  import type { Snippet } from 'svelte';
  import { settings } from '$lib/stores/settings.svelte';

  let { children }: { children: Snippet } = $props();

  // 把解析后的主题与用户偏好同步到根元素
  $effect(() => {
    document.documentElement.dataset.theme = settings.resolved;
  });

  $effect(() => {
    document.documentElement.style.setProperty(
      '--editor-font-size',
      `${settings.editorFontSize}px`,
    );
  });
</script>

{@render children()}
