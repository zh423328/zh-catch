/**
 * 卡片容器
 *
 * 统一深色卡片外观：标题 + 右侧附加区 + 内容。
 */
import type {ReactNode} from 'react';
import {StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {colors, fontSize, radius, spacing} from '../theme';

type Props = {
  title?: string;
  /** 标题右侧的内容，例如状态徽标或计数 */
  extra?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 去掉内边距，适合放自带 padding 的列表 */
  flush?: boolean;
};

export function Card({title, extra, children, style, flush}: Props) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {extra ? <View style={styles.extra}>{extra}</View> : null}
        </View>
      ) : null}
      <View style={flush ? undefined : styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.bodyLg,
    fontWeight: '600',
  },
  extra: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
