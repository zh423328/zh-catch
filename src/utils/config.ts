/**
 * 参数边界定义与归一化
 *
 * 页面上的每个数值控件都按这里的 min/max/step 渲染，
 * 传给原生之前再走一次 normalize，保证不会出现 NaN 或越界值。
 */
import {DEFAULT_CONFIG, type ClickConfig} from '../native/AutoClick';
import {clampInt} from './num';

/** 可调数值字段 */
export type NumField =
  | 'intervalMs'
  | 'jitterMs'
  | 'pressMs'
  | 'randomRadius'
  | 'maxTaps'
  | 'countdownMs';

type FieldLimit = {
  min: number;
  max: number;
  step: number;
  /** 单位后缀，用于展示 */
  unit: string;
};

/** 各字段的界面取值范围（与 CONTRACT.md 的语义一致，略收紧以适配手机操作） */
export const FIELD_LIMITS: Record<NumField, FieldLimit> = {
  intervalMs: {min: 20, max: 2000, step: 10, unit: 'ms'},
  jitterMs: {min: 0, max: 500, step: 10, unit: 'ms'},
  pressMs: {min: 10, max: 500, step: 5, unit: 'ms'},
  randomRadius: {min: 0, max: 80, step: 5, unit: 'px'},
  maxTaps: {min: 0, max: 100000, step: 100, unit: '次'},
  countdownMs: {min: 0, max: 10000, step: 500, unit: 'ms'},
};

/** 把单个数值字段归一到合法区间 */
export function normalizeField(field: NumField, value: unknown): number {
  const {min, max} = FIELD_LIMITS[field];
  // 非有限值或完全解析失败时退回默认值，再夹一次区间
  const fallback = DEFAULT_CONFIG[field];
  return clampInt(value, min, max, fallback);
}

/**
 * 完整配置归一化
 *
 * 原生可能回推任意脏数据（例如旧版本字段缺失），这里逐字段兜底，
 * 保证界面拿到的一定是合法完整对象。
 */
export function normalizeConfig(
  input: Partial<ClickConfig> | null | undefined,
): ClickConfig {
  const source = input ?? {};
  return {
    intervalMs: normalizeField('intervalMs', source.intervalMs),
    jitterMs: normalizeField('jitterMs', source.jitterMs),
    pressMs: normalizeField('pressMs', source.pressMs),
    randomRadius: normalizeField('randomRadius', source.randomRadius),
    maxTaps: normalizeField('maxTaps', source.maxTaps),
    shuffle: source.shuffle === true,
    countdownMs: normalizeField('countdownMs', source.countdownMs),
  };
}

/** 生成用于比较配置是否变化的稳定字符串 */
export function configKey(config: ClickConfig): string {
  return [
    config.intervalMs,
    config.jitterMs,
    config.pressMs,
    config.randomRadius,
    config.maxTaps,
    config.shuffle ? 1 : 0,
    config.countdownMs,
  ].join('|');
}
