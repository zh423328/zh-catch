/**
 * 主控制页
 *
 * 负责：就绪检查（无障碍 / 悬浮窗权限）、悬浮控制条开关、开始与停止、计数展示。
 * 所有原生调用都通过桥接层 AutoClick，页面不直接接触 NativeModules。
 */
import {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {AutoClick, type AutoClickStatus} from '../native/AutoClick';
import {Card} from '../components/Card';
import {CheckRow} from '../components/CheckRow';
import {AppButton} from '../components/AppButton';
import {InlineAlert} from '../components/InlineAlert';
import {StatusBadge, describeBadge} from '../components/StatusBadge';
import {useAsyncAction} from '../hooks/useAsyncAction';
import {colors, fontSize, radius, spacing} from '../theme';
import {formatCount, formatMs} from '../utils/num';

type Props = {
  status: AutoClickStatus;
  ready: boolean;
  supported: boolean;
  refresh: () => Promise<void>;
  /** 跳转到标记点管理页 */
  onGotoMarkers: () => void;
  /** 跳转到参数页 */
  onGotoConfig: () => void;
};

export function HomeScreen({
  status,
  ready,
  supported,
  refresh,
  onGotoMarkers,
  onGotoConfig,
}: Props) {
  const {busyKey, run, error, setError} = useAsyncAction();
  // 开始失败的业务提示，与通用 error 分开管理
  const [startHint, setStartHint] = useState<string | null>(null);

  const badge = describeBadge(status.running, ready, status.tapCount);

  /** 打开系统无障碍设置 */
  const openAccessibility = useCallback(() => {
    run('accessibility', async () => {
      AutoClick.openAccessibilitySettings();
      // 用户可能很快返回，稍后再补拉一次状态
      setTimeout(refresh, 600);
    });
  }, [refresh, run]);

  /** 申请悬浮窗权限 */
  const requestOverlay = useCallback(() => {
    run('overlay', async () => {
      AutoClick.requestOverlayPermission();
      setTimeout(refresh, 600);
    });
  }, [refresh, run]);

  /** 显示悬浮控制条 */
  const showFloating = useCallback(() => {
    run('show', async () => {
      const ok = await AutoClick.showFloatingUI();
      if (!ok) {
        setStartHint('悬浮层显示失败，请检查系统是否禁止了后台弹出界面');
      }
      await refresh();
    });
  }, [refresh, run]);

  /** 隐藏悬浮控制条 */
  const hideFloating = useCallback(() => {
    run('hide', async () => {
      await AutoClick.hideFloatingUI();
      await refresh();
    });
  }, [refresh, run]);

  /** 开始连点 */
  const start = useCallback(() => {
    setStartHint(null);
    run('start', async () => {
      const ok = await AutoClick.start();
      if (!ok) {
        // 原生返回 false 的两种原因：无障碍未开 / 没有标记点
        setStartHint('请先开启无障碍服务并至少添加 1 个标记点');
      }
      await refresh();
    });
  }, [refresh, run]);

  /** 停止连点 */
  const stop = useCallback(() => {
    run('stop', async () => {
      await AutoClick.stop();
      await refresh();
    });
  }, [refresh, run]);

  /** 计数归零 */
  const resetCount = useCallback(() => {
    run('reset', async () => {
      await AutoClick.resetCount();
      await refresh();
    });
  }, [refresh, run]);

  const canStart = status.accessibility && status.markerCount > 0;
  const alertMessage = startHint ?? error;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}>
      {/* 顶部标题与状态徽标 */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>抢购连点器</Text>
          <Text style={styles.subtitle}>
            把标记点拖到抢购按钮上，按开始即可自动连点
          </Text>
        </View>
        <StatusBadge tone={badge.tone} label={badge.label} />
      </View>

      {!supported ? (
        <InlineAlert
          tone="warning"
          title="当前环境没有原生连点模块"
          detail="仅 Android 真机安装后可执行点击；模拟器或 iOS 上只能预览界面。"
        />
      ) : null}

      {/* 就绪检查 */}
      <Card title="就绪检查">
        <CheckRow
          title="无障碍服务"
          description={status.accessibility ? '已开启' : '未开启，无法执行点击'}
          ok={status.accessibility}
          actionLabel={status.accessibility ? undefined : '去开启'}
          onAction={openAccessibility}
          loading={busyKey === 'accessibility'}
        />
        <CheckRow
          title="悬浮窗权限"
          description={
            status.overlayPermitted ? '已授权' : '未授权，无法显示控制条'
          }
          ok={status.overlayPermitted}
          actionLabel={status.overlayPermitted ? undefined : '去授权'}
          onAction={requestOverlay}
          loading={busyKey === 'overlay'}
          last
        />
      </Card>

      {/* 悬浮控制条 */}
      <Card title="悬浮控制条">
        <View style={styles.row2}>
          <AppButton
            label="显示悬浮控制条"
            onPress={showFloating}
            variant="secondary"
            loading={busyKey === 'show'}
            disabled={!status.overlayPermitted}
            style={styles.flex1}
            hint={status.overlayPermitted ? undefined : '请先授权悬浮窗'}
          />
          <AppButton
            label="隐藏悬浮控制条"
            onPress={hideFloating}
            variant="outline"
            loading={busyKey === 'hide'}
            disabled={!status.floatingVisible}
            style={styles.flex1}
          />
        </View>
        <Text style={styles.captionLine}>
          当前状态：{status.floatingVisible ? '已显示' : '未显示'} · 标记点{' '}
          {status.markerCount} 个
        </Text>
      </Card>

      {/* 开始 / 停止 */}
      <Card>
        {alertMessage ? (
          <InlineAlert
            tone="danger"
            title={alertMessage}
            detail={
              startHint
                ? '无障碍未开启或还没有标记点，都会导致启动失败。'
                : undefined
            }
            onDismiss={() => {
              setStartHint(null);
              setError(null);
            }}
            style={styles.alert}
          />
        ) : null}

        <AppButton
          label="开始连点"
          onPress={start}
          variant="primary"
          size="lg"
          loading={busyKey === 'start'}
          disabled={status.running}
          accessibilityLabel="开始连点"
        />

        {!canStart && !status.running ? (
          <Text style={styles.warnLine}>
            {status.accessibility
              ? '还没有标记点，去「标记点」页添加'
              : '请先开启无障碍服务'}
          </Text>
        ) : null}

        <AppButton
          label="停止"
          onPress={stop}
          variant="ghostDanger"
          size="lg"
          loading={busyKey === 'stop'}
          disabled={!status.running}
          style={styles.stopBtn}
          accessibilityLabel="停止连点"
        />

        <View style={styles.counterRow}>
          <View style={styles.counterCell}>
            <Text style={styles.counterValue}>
              {formatCount(status.tapCount)}
            </Text>
            <Text style={styles.counterLabel}>已点击次数</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <Text style={styles.counterValue}>{status.markerCount}</Text>
            <Text style={styles.counterLabel}>标记点数量</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <Text style={styles.counterValue}>
              {status.config.maxTaps === 0
                ? '∞'
                : formatCount(status.config.maxTaps)}
            </Text>
            <Text style={styles.counterLabel}>点击上限</Text>
          </View>
        </View>

        <AppButton
          label="计数归零"
          onPress={resetCount}
          variant="outline"
          loading={busyKey === 'reset'}
          disabled={status.running || status.tapCount === 0}
          style={styles.resetBtn}
        />
      </Card>

      {/* 快捷入口 */}
      <View style={styles.row2}>
        <AppButton
          label="管理标记点"
          onPress={onGotoMarkers}
          variant="secondary"
          style={styles.flex1}
        />
        <AppButton
          label="调整参数"
          onPress={onGotoConfig}
          variant="secondary"
          style={styles.flex1}
        />
      </View>

      <Text style={styles.footer}>
        当前间隔 {status.config.intervalMs} ms · 抖动 ±{status.config.jitterMs}{' '}
        ms · 倒计时 {formatMs(status.config.countdownMs)}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.display,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.body,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  alert: {
    marginBottom: spacing.md,
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  captionLine: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: spacing.md,
  },
  warnLine: {
    color: colors.warning,
    fontSize: fontSize.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stopBtn: {
    marginTop: spacing.md,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  counterCell: {
    flex: 1,
    alignItems: 'center',
  },
  counterDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.border,
  },
  counterValue: {
    color: colors.text,
    fontSize: fontSize.heading,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  counterLabel: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: 2,
  },
  resetBtn: {
    marginTop: spacing.md,
  },
  footer: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
