/**
 * 通用按钮
 *
 * 所有按钮高度不低于 48dp，主操作用 64dp 的 lg 尺寸，方便抢购时单手盲按。
 * 仅基于 Pressable 实现，不依赖任何第三方手势库。
 */
import {useCallback} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BIG_TOUCH,
  MIN_TOUCH,
  colors,
  fontSize,
  radius,
  spacing,
} from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghostDanger';
export type ButtonSize = 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** 按钮下方的补充说明，例如「需先授权悬浮窗」 */
  hint?: string;
  style?: StyleProp<ViewStyle>;
  /** 无障碍朗读标签，默认取 label */
  accessibilityLabel?: string;
};

export function AppButton({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  loading = false,
  hint,
  style,
  accessibilityLabel,
}: Props) {
  const inactive = disabled || loading;

  const handlePress = useCallback(() => {
    if (inactive) {
      return;
    }
    onPress();
  }, [inactive, onPress]);

  return (
    <View style={style}>
      <Pressable
        onPress={handlePress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{disabled: inactive, busy: loading}}
        android_ripple={{color: 'rgba(255,255,255,0.12)'}}
        style={({pressed}) => [
          styles.base,
          size === 'lg' ? styles.sizeLg : styles.sizeMd,
          variantStyle[variant],
          pressed && !inactive && styles.pressed,
          inactive && styles.disabled,
        ]}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? '#FFFFFF' : colors.text}
          />
        ) : (
          <Text
            style={[
              styles.label,
              size === 'lg' && styles.labelLg,
              variant === 'primary' && styles.labelOnPrimary,
              variant === 'ghostDanger' && styles.labelDanger,
            ]}
            numberOfLines={1}>
            {label}
          </Text>
        )}
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const variantStyle: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghostDanger: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.35)',
  },
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },
  sizeMd: {
    minHeight: MIN_TOUCH,
  },
  sizeLg: {
    minHeight: BIG_TOUCH,
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.bodyLg,
    fontWeight: '600',
  },
  labelLg: {
    fontSize: fontSize.title,
    letterSpacing: 1,
  },
  labelOnPrimary: {
    color: '#FFFFFF',
  },
  labelDanger: {
    color: colors.danger,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
