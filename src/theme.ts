/**
 * 深色主题令牌
 *
 * 抢购场景多在夜间使用，整体采用低亮度背景 + 高饱和红色主色，
 * 保证在暗环境下不刺眼，同时让「开始/停止」这类关键动作足够醒目。
 */

export const colors = {
  /** 页面底色 */
  background: '#0E0F12',
  /** 卡片底色 */
  surface: '#171A1F',
  /** 卡片内的次级块（输入框、分段控件） */
  surfaceAlt: '#20252D',
  /** 分隔线与描边 */
  border: '#2A313A',
  /** 主色：抢购红 */
  primary: '#FF4D4F',
  /** 主色按下态 */
  primaryPressed: '#C93A3C',
  /** 主色浅背景（用于徽标、提示条） */
  primarySoft: 'rgba(255, 77, 79, 0.14)',
  /** 通过态 */
  success: '#2ED573',
  successSoft: 'rgba(46, 213, 115, 0.14)',
  /** 危险/未通过态 */
  danger: '#FF4D4F',
  dangerSoft: 'rgba(255, 77, 79, 0.14)',
  /** 警示态 */
  warning: '#FFB020',
  warningSoft: 'rgba(255, 176, 32, 0.14)',
  /** 主文字 */
  text: '#F2F4F7',
  /** 次要文字 */
  textDim: '#9AA4B2',
  /** 弱化文字 */
  textMuted: '#6B7684',
  /** 禁用态文字 */
  textDisabled: '#4A525E',
  /** 遮罩 */
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const fontSize = {
  caption: 12,
  body: 14,
  bodyLg: 16,
  title: 18,
  heading: 22,
  display: 30,
} as const;

/** 最小可点击高度，满足 48dp 无障碍触控规范 */
export const MIN_TOUCH = 48;

/** 大按钮高度，便于单手盲操作 */
export const BIG_TOUCH = 64;
