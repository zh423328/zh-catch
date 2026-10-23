/**
 * 底部标签栏
 *
 * 只有三个页面，不引入路由库，用本地 state 切换即可。
 * 每个标签高度 56dp，保证拇指可达。
 */
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, fontSize, radius, spacing} from '../theme';

export type TabKey = 'home' | 'markers' | 'config';

export type TabItem = {
  key: TabKey;
  label: string;
  /** 用文字符号代替图标，避免引入图标库 */
  glyph: string;
};

export const TABS: TabItem[] = [
  {key: 'home', label: '控制', glyph: '▶'},
  {key: 'markers', label: '标记点', glyph: '◎'},
  {key: 'config', label: '参数', glyph: '≡'},
];

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** 标记点数量，显示在标签上的小角标 */
  markerCount: number;
};

export function TabBar({active, onChange, markerCount}: Props) {
  return (
    <View style={styles.bar}>
      {TABS.map(tab => {
        const isActive = tab.key === active;
        const showCount = tab.key === 'markers' && markerCount > 0;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{selected: isActive}}
            accessibilityLabel={tab.label}
            style={({pressed}) => [
              styles.item,
              pressed && styles.itemPressed,
            ]}>
            <View style={styles.glyphWrap}>
              <Text style={[styles.glyph, isActive && styles.glyphActive]}>
                {tab.glyph}
              </Text>
              {showCount ? (
                <View style={styles.count}>
                  <Text style={styles.countText}>{markerCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xs,
  },
  itemPressed: {
    opacity: 0.7,
  },
  glyphWrap: {
    height: 24,
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 17,
    color: colors.textMuted,
  },
  glyphActive: {
    color: colors.primary,
  },
  label: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  count: {
    position: 'absolute',
    top: -4,
    right: -16,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
