<script lang="ts">
  import MarkdownPreview from '$lib/components/MarkdownPreview.svelte';
</script>

<!-- 预览区：真实渲染从 M1 起，占位样式退役 -->
<section class="preview-pane">
  <MarkdownPreview />
</section>

<style>
  .preview-pane {
    height: 100%;
    min-height: 0;
    min-width: 0;
    background: var(--bg-content);
  }
</style>
