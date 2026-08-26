/** 字数统计（中文优先口径）：CJK 按字计、拉丁按词计；阅读时长按 400 字/分估算。 */

const CJK_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/g;

export interface TextStats {
  chars: number;
  cjkChars: number;
  latinWords: number;
  words: number;
  minutes: number;
}

export function countStats(text: string): TextStats {
  const cjkChars = (text.match(CJK_RE) ?? []).length;
  const latinWords = (text.replace(CJK_RE, ' ').match(/[A-Za-z0-9_'’-]+/g) ?? []).length;
  const words = cjkChars + latinWords;
  const minutes = Math.max(1, Math.round(words / 400));
  return { chars: text.length, cjkChars, latinWords, words, minutes };
}
