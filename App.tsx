/**
 * ZhCatch 应用入口布局
 *
 * 结构：SafeAreaProvider → 状态栏 → 顶部标题栏 → 当前页面 → 底部标签栏。
 * 三个页面共用同一份原生状态（通过 useAutoClickStatus 订阅），
 * 切换标签不会重新订阅，避免重复注册监听。
 */
import {useCallback, useState} from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {useAutoClickStatus} from './src/hooks/useAutoClickStatus';
import {HomeScreen} from './src/screens/HomeScreen';
import {MarkersScreen} from './src/screens/MarkersScreen';
import {ConfigScreen} from './src/screens/ConfigScreen';
import {TabBar, type TabKey} from './src/components/TabBar';
import {colors, fontSize, spacing} from './src/theme';

function App() {
  return (
    <SafeAreaProvider>
      {/* RN 0.88 起为 edge-to-edge，状态栏只保留配色，不能设 backgroundColor */}
      <StatusBar barStyle="light-content" />
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const {status, refresh, supported, ready} = useAutoClickStatus();
  const [tab, setTab] = useState<TabKey>('home');

  const gotoMarkers = useCallback(() => setTab('markers'), []);
  const gotoConfig = useCallback(() => setTab('config'), []);
  const gotoHome = useCallback(() => setTab('home'), []);

  return (
    <View
      style={[
        styles.root,
        {
          // 顶部安全区由内容自己留白，底部交给标签栏
          paddingTop: insets.top,
        },
      ]}>
      {/* 顶部品牌栏 */}
      <View style={styles.topBar}>
        <View style={styles.brandDot} />
        <Text style={styles.brand}>ZhCatch</Text>
        <Text style={styles.brandSub}>安卓抢购连点器</Text>
      </View>

      {/* 页面容器 */}
      <View style={styles.content}>
        {tab === 'home' ? (
          <HomeScreen
            status={status}
            ready={ready}
            supported={supported}
            refresh={refresh}
            onGotoMarkers={gotoMarkers}
            onGotoConfig={gotoConfig}
          />
        ) : null}

        {tab === 'markers' ? (
          <MarkersScreen
            status={status}
            refresh={refresh}
            onGotoHome={gotoHome}
          />
        ) : null}

        {tab === 'config' ? (
          <ConfigScreen status={status} refresh={refresh} />
        ) : null}
      </View>

      {/* 底部标签栏，底部安全区留白交给它自己 */}
      <View style={{paddingBottom: insets.bottom}}>
        <TabBar active={tab} onChange={setTab} markerCount={status.markerCount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  brand: {
    color: colors.text,
    fontSize: fontSize.bodyLg,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandSub: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginLeft: spacing.sm,
  },
  content: {
    flex: 1,
  },
});

export default App;
