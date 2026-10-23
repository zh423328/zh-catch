/**
 * 开关行
 *
 * 复用 RN 自带 Switch，右侧可带说明文字。
 */
import {StyleSheet, Switch, Text, View} from 'react-native';
import {colors, fontSize, spacing} from '../theme';

type Props = {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  description?: string;
  disabled?: boolean;
};

export function SwitchRow({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.content}>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{false: colors.surfaceAlt, true: 'rgba(255,77,79,0.55)'}}
        thumbColor={value ? colors.primary : colors.textMuted}
        ios_backgroundColor={colors.surfaceAlt}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  content: {
    flex: 1,
    paddingRight: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.bodyLg,
  },
  labelDisabled: {
    color: colors.textDisabled,
  },
  desc: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
});
