/**
 * 内联提示条
 *
 * 用于展示「无障碍服务未开启」「操作失败」这类需要用户立刻看到的反馈。
 * 相比 Toast，内联红字不会遮挡操作区，抢购过程中更容易被注意到。
 */
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {colors, fontSize, radius, spacing} from '../theme';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success';

type Props = {
  tone?: AlertTone;
  title: string;
  /** 补充说明 */
  detail?: string;
  /** 右侧关闭按钮，不传则不显示 */
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function InlineAlert({
  tone = 'danger',
  title,
  detail,
  onDismiss,
  style,
}: Props) {
  return (
    <View style={[styles.wrap, toneWrap[tone], style]}>
      <View style={styles.body}>
        <Text style={[styles.title, toneTitle[tone]]}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="关闭提示"
          hitSlop={10}
          style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const toneWrap: Record<AlertTone, {backgroundColor: string; borderColor: string}> =
  {
    danger: {
      backgroundColor: colors.dangerSoft,
      borderColor: 'rgba(255,77,79,0.4)',
    },
    warning: {
      backgroundColor: colors.warningSoft,
      borderColor: 'rgba(255,176,32,0.4)',
    },
    info: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
    },
    success: {
      backgroundColor: colors.successSoft,
      borderColor: 'rgba(46,213,115,0.4)',
    },
  };

const toneTitle: Record<AlertTone, {color: string}> = {
  danger: {color: colors.danger},
  warning: {color: colors.warning},
  info: {color: colors.text},
  success: {color: colors.success},
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  detail: {
    color: colors.textDim,
    fontSize: fontSize.caption,
    marginTop: 4,
    lineHeight: 18,
  },
  close: {
    paddingLeft: spacing.md,
    paddingTop: 2,
  },
  closeText: {
    color: colors.textMuted,
    fontSize: fontSize.body,
  },
});
