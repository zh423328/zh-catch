/**
 * 状态徽标
 *
 * 三种语义：未就绪（红）、就绪（绿）、运行中（红底高亮 + 计数）。
 */
import {StyleSheet, Text, View} from 'react-native';
import {colors, fontSize, radius, spacing} from '../theme';
import {formatCount} from '../utils/num';

export type BadgeTone = 'danger' | 'success' | 'active' | 'neutral';

type Props = {
  tone: BadgeTone;
  label: string;
};

export function StatusBadge({tone, label}: Props) {
  return (
    <View style={[styles.badge, toneBg[tone]]}>
      {/* 运行中时用一个小圆点强调「正在进行」 */}
      <View style={[styles.dot, toneDot[tone]]} />
      <Text style={[styles.text, toneText[tone]]}>{label}</Text>
    </View>
  );
}

/** 根据运行状态生成徽标文案 */
export function describeBadge(
  running: boolean,
  ready: boolean,
  tapCount: number,
): {tone: BadgeTone; label: string} {
  if (running) {
    return {tone: 'active', label: `运行中 ${formatCount(tapCount)} 次`};
  }
  if (ready) {
    return {tone: 'success', label: '就绪'};
  }
  return {tone: 'danger', label: '未就绪'};
}

const toneBg: Record<BadgeTone, {backgroundColor: string}> = {
  danger: {backgroundColor: colors.dangerSoft},
  success: {backgroundColor: colors.successSoft},
  active: {backgroundColor: colors.primarySoft},
  neutral: {backgroundColor: colors.surfaceAlt},
};

const toneDot: Record<BadgeTone, {backgroundColor: string}> = {
  danger: {backgroundColor: colors.danger},
  success: {backgroundColor: colors.success},
  active: {backgroundColor: colors.primary},
  neutral: {backgroundColor: colors.textMuted},
};

const toneText: Record<BadgeTone, {color: string}> = {
  danger: {color: colors.danger},
  success: {color: colors.success},
  active: {color: colors.primary},
  neutral: {color: colors.textDim},
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    marginRight: 6,
  },
  text: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
});
