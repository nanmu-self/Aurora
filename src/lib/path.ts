/**
 * 同步的 POSIX 风格路径工具。
 * macOS/Linux 下 Tauri 返回的路径就是 `/` 分隔；Windows 路径先做分隔符归一。
 * 不引入 node:path（浏览器侧无该模块），实现保持极简。
 */

export function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

export function basename(p: string): string {
  const n = normalizeSlashes(p);
  const i = n.lastIndexOf('/');
  return i === -1 ? n : n.slice(i + 1);
}

export function dirname(p: string): string {
  const n = normalizeSlashes(p);
  const i = n.lastIndexOf('/');
  if (i <= 0) return i === 0 ? '/' : '';
  return n.slice(0, i);
}

/** 拼接并规范化（解析 . / ..）；保留绝对路径的前导 `/` */
export function join(...parts: string[]): string {
  const merged = normalizeSlashes(parts.filter((s) => s !== '').join('/'));
  const absolute = merged.startsWith('/');
  const stack: string[] = [];
  for (const seg of merged.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') stack.pop();
      else if (!absolute) stack.push('..');
      // 绝对路径下越出根的 .. 直接丢弃（调用方保证不发生）
      continue;
    }
    stack.push(seg);
  }
  return (absolute ? '/' : '') + stack.join('/');
}
