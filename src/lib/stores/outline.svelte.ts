import { getActiveText, jumpToLine, onDocChanged } from '$lib/editor/bridge';
import { countStats } from '$lib/stats';
import { status } from '$lib/stores/editorStatus.svelte';

export interface OutlineItem {
  level: number;
  /** 1-based 源码行号（滚动同步 / 跳转锚点） */
  line: number;
  title: string;
}

/**
 * 提取标题大纲。正则扫描并跳过围栏代码块内的 `#` 注释，
 * 对 1MB 文档单次扫描在毫秒级，直接在防抖后的通知点同步执行即可。
 */
export function parseOutline(text: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let inFence = false;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```+|~~~+)/.test(l)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = l.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) items.push({ level: m[1].length, line: i + 1, title: m[2] });
  }
  return items;
}

/** 大纲状态：随文档变更（已防抖）与切标签即时刷新 */
class OutlineStore {
  items = $state<OutlineItem[]>([]);

  init(): void {
    onDocChanged(() => this.refresh());
  }

  refresh(): void {
    const text = getActiveText();
    this.items = parseOutline(text);
    // 字数 / 阅读时长顺路在此计算（同为防抖后的派生数据）
    const s = countStats(text);
    status.words = s.words;
    status.minutes = s.minutes;
  }

  jump(item: OutlineItem): void {
    jumpToLine(item.line);
  }
}

export const outline = new OutlineStore();
