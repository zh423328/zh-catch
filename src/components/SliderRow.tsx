/**
 * 数值滑块行
 *
 * 由两部分组成：「−/ 数值 / +」步进条 + 轨道式滑块。
 * 不用第三方 Slider：轨道宽度通过 onLayout 测量，点击位置换算成比例，
 * 再按 step 对齐并夹到合法区间，保证交给原生的永远是整数。
 */
import {useCallback, useMemo, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import {colors, fontSize, MIN_TOUCH, radius, spacing} from '../theme';
import {clampInt} from '../utils/num';

type Props = {
  label: string;
  /** 当前值 */
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  /** 数值单位，例如 ms */
  unit?: string;
  /** 行下方的说明文字 */
  hint?: string;
  /** 数值为 0 时展示的替代文案，例如「不限」 */
  zeroLabel?: string;
  disabled?: boolean;
};

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
  hint,
  zeroLabel,
  disabled = false,
}: Props) {
  // 轨道实际像素宽度，首次布局前为 0
  const [trackWidth, setTrackWidth] = useState(0);

  const range = Math.max(max - min, 1);
  const ratio = Math.min(Math.max((value - min) / range, 0), 1);

  /** 把点击的横向位置换算成合法数值 */
  const commitByX = useCallback(
    (x: number, width: number) => {
      if (width <= 0 || disabled) {
        return;
      }
      const clampedX = Math.min(Math.max(x, 0), width);
      const raw = min + (clampedX / width) * range;
      // 先按 step 对齐，再夹区间，保证结果一定合法
      const snapped = Math.round(raw / step) * step;
      onChange(clampInt(snapped, min, max, min));
    },
    [disabled, max, min, onChange, range, step],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      commitByX(e.nativeEvent.locationX, trackWidth);
    },
    [commitByX, trackWidth],
  );

  const stepBy = useCallback(
    (dir: 1 | -1) => {
      if (disabled) {
        return;
      }
      onChange(clampInt(value + dir * step, min, max, min));
    },
    [disabled, max, min, onChange, step, value],
  );

  const displayValue = useMemo(() => {
    if (value === 0 && zeroLabel) {
      return zeroLabel;
    }
    return unit ? `${value} ${unit}` : String(value);
  }, [unit, value, zeroLabel]);

  const decDisabled = disabled || value <= min;
  const incDisabled = disabled || value >= max;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => stepBy(-1)}
            disabled={decDisabled}
            accessibilityRole="button"
            accessibilityLabel={`${label}减少`}
            hitSlop={6}
            style={({pressed}) => [
              styles.stepBtn,
              pressed && !decDisabled && styles.stepBtnPressed,
              decDisabled && styles.stepBtnDisabled,
            ]}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.value} numberOfLines={1}>
            {displayValue}
          </Text>
          <Pressable
            onPress={() => stepBy(1)}
            disabled={incDisabled}
            accessibilityRole="button"
            accessibilityLabel={`${label}增加`}
            hitSlop={6}
            style={({pressed}) => [
              styles.stepBtn,
              pressed && !incDisabled && styles.stepBtnPressed,
              incDisabled && styles.stepBtnDisabled,
            ]}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onLayout={handleLayout}
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{min, max, now: value}}
        style={styles.trackHit}>
        <View style={styles.track}>
          <View style={[styles.trackFill, {width: `${ratio * 100}%`}]} />
        </View>
        <View style={[styles.knob, {left: `${ratio * 100}%`}]} />
      </Pressable>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textDim,
    fontSize: fontSize.body,
    // 窄屏上允许换行，避免被步进条挤压成省略号
    flexShrink: 1,
    flexWrap: 'wrap',
    paddingRight: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepBtn: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  stepText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  value: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  trackHit: {
    marginTop: spacing.md,
    height: 32,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  knob: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    marginLeft: -9,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: spacing.xs,
  },
});
