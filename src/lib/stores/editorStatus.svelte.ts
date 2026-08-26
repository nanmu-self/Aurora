/** 编辑器派生状态（字数 / 行列号 / 瞬时通知），由编辑器单向写入。 */
class StatusStore {
  chars = $state(0);
  ln = $state(1);
  col = $state(1);
  /** 词数（CJK 按字 + 拉丁按词），随文档防抖刷新 */
  words = $state(0);
  /** 预计阅读时长（分钟） */
  minutes = $state(1);

  /** 瞬时通知（保存成功 / 失败等），3 秒后自动消失 */
  notice = $state<string | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  show(msg: string): void {
    this.notice = msg.length > 90 ? `${msg.slice(0, 87)}…` : msg;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.notice = null), 3000);
  }
}

export const status = new StatusStore();
