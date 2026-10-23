/**
 * 就绪检查项
 *
 * 一行展示：✔/✘ 图标 + 名称 + 说明 + 可选的操作按钮。
 * 状态未满足时按钮强调为主色，满足时按钮弱化为次要样式。
 */
import {StyleSheet, Text, View} from 'react-native';
import {colors, fontSize, radius, spacing} from '../theme';
import {AppButton} from './AppButton';

type Props = {
  /** 检查项名称，例如「无障碍服务」 */
  title: string;
  /** 状态说明，例如「已开启」「未开启」 */
  description: string;
  /** 是否通过 */
  ok: boolean;
  /** 按钮文案，不传则不显示按钮 */
  actionLabel?: string;
  onAction?: () => void;
  /** 正在跳转设置页 */
  loading?: boolean;
  /** 是否为最后一行，最后一行不画分隔线 */
  last?: boolean;
};

export function CheckRow({
  title,
  description,
  ok,
  actionLabel,
  onAction,
  loading,
  last,
}: Props) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={[styles.iconWrap, ok ? styles.iconOk : styles.iconBad]}>
        <Text style={[styles.icon, ok ? styles.iconTextOk : styles.iconTextBad]}>
          {ok ? '✔' : '✘'}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.desc, ok ? styles.descOk : styles.descBad]}>
          {description}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          onPress={onAction}
          variant={ok ? 'outline' : 'primary'}
          loading={loading}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconOk: {
    backgroundColor: colors.successSoft,
  },
  iconBad: {
    backgroundColor: colors.dangerSoft,
  },
  icon: {
    fontSize: 15,
    fontWeight: '700',
  },
  iconTextOk: {
    color: colors.success,
  },
  iconTextBad: {
    color: colors.danger,
  },
  content: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.bodyLg,
    fontWeight: '600',
  },
  desc: {
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  descOk: {
    color: colors.textMuted,
  },
  descBad: {
    color: colors.warning,
  },
  action: {
    minWidth: 88,
  },
});
