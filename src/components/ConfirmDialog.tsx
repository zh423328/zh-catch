/**
 * 二次确认弹窗
 *
 * 用 RN 自带 Modal 实现，保持与深色主题一致（系统 Alert 在暗色下观感割裂）。
 */
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, fontSize, radius, spacing} from '../theme';
import {AppButton} from './AppButton';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 确认按钮是否使用危险样式 */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* 阻止点击卡片区域时冒泡关闭 */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <AppButton
              label={cancelLabel}
              onPress={onCancel}
              variant="outline"
              style={styles.action}
              accessibilityLabel={`取消：${title}`}
            />
            <AppButton
              label={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'primary' : 'secondary'}
              style={styles.action}
              // 与列表行里的同名按钮区分，方便读屏和自动化定位
              accessibilityLabel={`确认${confirmLabel}：${title}`}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
  },
  message: {
    color: colors.textDim,
    fontSize: fontSize.body,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
