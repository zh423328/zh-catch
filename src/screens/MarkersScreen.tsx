/**
 * 标记点管理页
 *
 * 注意：标记点的**位置**由悬浮层负责拖拽，本页只做列表级管理
 * （查看坐标、删除单个、清空全部、整体显示/隐藏）。
 */
import {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  AutoClick,
  type AutoClickStatus,
  type Marker,
} from '../native/AutoClick';
import {Card} from '../components/Card';
import {AppButton} from '../components/AppButton';
import {InlineAlert} from '../components/InlineAlert';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {SwitchRow} from '../components/SwitchRow';
import {useAsyncAction} from '../hooks/useAsyncAction';
import {colors, fontSize, radius, spacing} from '../theme';

type Props = {
  status: AutoClickStatus;
  refresh: () => Promise<void>;
  /** 跳回控制页，方便用户去开悬浮条 */
  onGotoHome: () => void;
};

export function MarkersScreen({status, refresh, onGotoHome}: Props) {
  const {busyKey, run, error, setError} = useAsyncAction();
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Marker | null>(null);
  const [localHint, setLocalHint] = useState<string | null>(null);

  /** 删除单个标记点 */
  const removeOne = useCallback(
    (id: string) => {
      run(`remove:${id}`, async () => {
        await AutoClick.removeMarker(id);
        await refresh();
      });
    },
    [refresh, run],
  );

  /** 清空全部标记点 */
  const clearAll = useCallback(() => {
    setConfirmClear(false);
    run('clear', async () => {
      await AutoClick.clearMarkers();
      await refresh();
    });
  }, [refresh, run]);

  /** 切换标记点可见性；原生会回推新状态 */
  const toggleVisible = useCallback(
    (visible: boolean) => {
      run('visible', async () => {
        await AutoClick.setMarkersVisible(visible);
        await refresh();
      });
    },
    [refresh, run],
  );

  /** 直接打开悬浮条，用户就能在屏幕上拖点 */
  const openFloating = useCallback(() => {
    if (!status.overlayPermitted) {
      setLocalHint('请先在控制页授权悬浮窗权限');
      return;
    }
    setLocalHint(null);
    run('floating', async () => {
      await AutoClick.showFloatingUI();
      await refresh();
    });
  }, [refresh, run, status.overlayPermitted]);

  const markers = status.markers;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>标记点管理</Text>

        {/* 关键说明：这里只做管理，摆放要去悬浮层 */}
        <InlineAlert
          tone="info"
          title="标记点位置需要在悬浮层里拖拽摆放"
          detail={
            '本页只负责列表管理。点「显示悬浮控制条」后，每个标记点是屏幕上独立的小圆窗，' +
            '把这几个小窗分别拖到抢购按钮上即可；拖动时其余触摸会穿透到下层 App，不影响正常滑动。'
          }
        />

        {localHint || error ? (
          <InlineAlert
            tone="warning"
            title={localHint ?? error ?? ''}
            onDismiss={() => {
              setLocalHint(null);
              setError(null);
            }}
          />
        ) : null}

        {/* 悬浮层入口与可见性 */}
        <Card title="悬浮层">
          <View style={styles.row2}>
            <AppButton
              label="显示悬浮控制条"
              onPress={openFloating}
              variant="secondary"
              loading={busyKey === 'floating'}
              style={styles.flex1}
            />
            <AppButton
              label="回控制页"
              onPress={onGotoHome}
              variant="outline"
              style={styles.flex1}
            />
          </View>
          <SwitchRow
            label="显示标记点"
            description={
              status.markersVisible
                ? '标记点当前可见，可拖动调整位置'
                : '标记点已隐藏，控制条仍保留'
            }
            value={status.markersVisible}
            onValueChange={toggleVisible}
            disabled={busyKey === 'visible' || status.markerCount === 0}
          />
        </Card>

        {/* 列表 */}
        <Card
          title={`标记点列表（${markers.length}）`}
          extra={
            markers.length > 0 ? (
              <AppButton
                label="清空全部"
                onPress={() => setConfirmClear(true)}
                variant="ghostDanger"
                loading={busyKey === 'clear'}
              />
            ) : undefined
          }>
          {markers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>◎</Text>
              <Text style={styles.emptyTitle}>还没有标记点</Text>
              <Text style={styles.emptyDesc}>
                先显示悬浮控制条，再在悬浮层上新增标记点，然后拖到目标按钮位置。
              </Text>
            </View>
          ) : (
            markers.map((marker, index) => (
              <View
                key={marker.id}
                style={[
                  styles.markerRow,
                  index === markers.length - 1 && styles.markerRowLast,
                ]}>
                <View style={styles.markerIndex}>
                  <Text style={styles.markerIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.markerInfo}>
                  <Text style={styles.markerTitle}>#{index + 1}</Text>
                  <Text style={styles.markerCoord}>
                    x {Math.round(marker.x)}, y {Math.round(marker.y)}
                  </Text>
                </View>
                <AppButton
                  label="删除"
                  onPress={() => setPendingRemove(marker)}
                  variant="ghostDanger"
                  loading={busyKey === `remove:${marker.id}`}
                />
              </View>
            ))
          )}
        </Card>

        {markers.length > 0 ? (
          <Text style={styles.footer}>
            坐标单位为屏幕物理像素，左上角为原点。多点模式下会依次（或随机）点击这些位置。
          </Text>
        ) : null}
      </ScrollView>

      {/* 清空全部二次确认 */}
      <ConfirmDialog
        visible={confirmClear}
        title="清空全部标记点？"
        message={`将删除 ${markers.length} 个标记点，此操作不可撤销。`}
        confirmLabel="清空"
        destructive
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />

      {/* 删除单个二次确认 */}
      <ConfirmDialog
        visible={pendingRemove !== null}
        title="删除这个标记点？"
        message={
          pendingRemove
            ? `坐标 x ${Math.round(pendingRemove.x)}, y ${Math.round(
                pendingRemove.y,
              )}`
            : undefined
        }
        confirmLabel="删除"
        destructive
        onConfirm={() => {
          if (pendingRemove) {
            const id = pendingRemove.id;
            setPendingRemove(null);
            removeOne(id);
          }
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.heading,
    fontWeight: '800',
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  markerRowLast: {
    borderBottomWidth: 0,
  },
  markerIndex: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  markerIndexText: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  markerInfo: {
    flex: 1,
  },
  markerTitle: {
    color: colors.text,
    fontSize: fontSize.bodyLg,
    fontWeight: '600',
  },
  markerCoord: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 34,
    color: colors.textDisabled,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: colors.textDim,
    fontSize: fontSize.bodyLg,
    fontWeight: '600',
  },
  emptyDesc: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  footer: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    lineHeight: 18,
    textAlign: 'center',
  },
});
