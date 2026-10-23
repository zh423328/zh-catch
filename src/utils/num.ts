/**
 * 数值处理工具
 *
 * 所有交给原生层的数值都必须先经过这里，保证不会出现 NaN / Infinity，
 * 也不会超出 CONTRACT.md 约定的取值范围。
 */

/**
 * 把任意输入钳制为闭区间内的整数
 *
 * @param value 原始输入，允许是 NaN / Infinity / 字符串
 * @param min 下界（含）
 * @param max 上界（含）
 * @param fallback 输入完全无法解析时使用的兜底值
 */
export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;

  if (!Number.isFinite(parsed)) {
    // 兜底值本身也要在区间内，避免调用方传错
    return Math.min(Math.max(Math.round(fallback), min), max);
  }

  const rounded = Math.round(parsed);
  return Math.min(Math.max(rounded, min), max);
}

/** 把数值钳制到闭区间；非有限数返回 null，交给调用方决定怎么处理 */
export function toFiniteNumber(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** 毫秒数字转友好文本，例如 3000 -> "3.0 秒" */
export function formatMs(ms: number): string {
  if (ms <= 0) {
    return '无';
  }
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(1)} 秒`;
}

/** 大数字加千分位，例如 12345 -> "12,345" */
export function formatCount(count: number): string {
  if (!Number.isFinite(count)) {
    return '0';
  }
  return Math.trunc(count).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
