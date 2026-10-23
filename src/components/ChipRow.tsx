/**
 * 可选标签组
 *
 * 用于「最多点击次数」这类带常用预设值的参数，一步点到目标值。
 */
import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import {colors, fontSize, MIN_TOUCH, radius, spacing} from '../theme';

export type ChipOption = {
  label: string;
  value: number;
};

type Props = {
  options: ChipOption[];
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

export function ChipRow({options, value, onChange, disabled = false}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!disabled) {
                onChange(option.value);
              }
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{selected: active, disabled}}
            accessibilityLabel={`设为${option.label}`}
            style={({pressed}) => [
              styles.chip,
              active && styles.chipActive,
              pressed && !disabled && styles.chipPressed,
              disabled && styles.chipDisabled,
            ]}>
            <Text style={[styles.text, active && styles.textActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  text: {
    color: colors.textDim,
    fontSize: fontSize.body,
  },
  textActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
