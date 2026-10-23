/**
 * 参数面板
 *
 * 数据流：本地 draft 立即响应操作 → 防抖后 configure(patch) 提交 → refresh 校验。
 * 原生回推配置时会同步回 draft，但「自己刚发出、尚未回环」的那段时间不覆盖，
 * 避免滑块被旧状态拽回去。
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  AutoClick,
  DEFAULT_CONFIG,
  type AutoClickStatus,
  type ClickConfig,
} from '../native/AutoClick';
import {Card} from '../components/Card';
import {AppButton} from '../components/AppButton';
import {SliderRow} from '../components/SliderRow';
import {SwitchRow} from '../components/SwitchRow';
import {ChipRow} from '../components/ChipRow';
import {InlineAlert} from '../components/InlineAlert';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {useAsyncAction} from '../hooks/useAsyncAction';
import {useDebouncedCallback} from '../hooks/useDebouncedCallback';
import {colors, fontSize, spacing} from '../theme';
import {
  FIELD_LIMITS,
  configKey,
  normalizeConfig,
  type NumField,
} from '../utils/config';
import {formatMs} from '../utils/num';

type Props = {
  status: AutoClickStatus;
  refresh: () => Promise<void>;
};

/** 「最多点击次数」的常用预设 */
const MAX_TAP_PRESETS = [0, 100, 300, 1000, 3000, 10000];

/** 提交防抖间隔，够快又能合并连续滑动产生的变更 */
const COMMIT_DEBOUNCE_MS = 180;

export function ConfigScreen({status, refresh}: Props) {
  const {run, error, setError} = useAsyncAction();
  const [draft, setDraft] = useState<ClickConfig>(() =>
    normalizeConfig(status.config),
  );
  const [confirmReset, setConfirmReset] = useState(false);

  // 是否存在尚未完成的提交（防抖排队中或请求进行中）
  const pendingRef = useRef(false);
  // 当前草稿的镜像，供 commit 在回调里读到最新值，避免闭包过期
  const draftRef = useRef<ClickConfig>(draft);
  const mountedRef = useRef(true);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 真正调用原生 configure */
  const sendConfig = useCallback(
    (next: ClickConfig) => {
      pendingRef.current = true;
      run('configure', async () => {
        try {
          await AutoClick.configure(next);
          await refresh();
        } finally {
          if (mountedRef.current) {
            pendingRef.current = false;
          }
        }
      });
    },
    [refresh, run],
  );

  const debouncedSend = useDebouncedCallback(sendConfig, COMMIT_DEBOUNCE_MS);

  /**
   * 采纳原生回推的配置
   *
   * 只在「没有本地提交在途」且「回推值确实不同于本地草稿」时采纳，
   * 这样既不会用自己的回环打断拖动，又能接住悬浮层改的参数。
   */
  useEffect(() => {
    if (pendingRef.current) {
      return;
    }
    const incoming = normalizeConfig(status.config);
    const incomingKey = configKey(incoming);
    if (incomingKey === configKey(draftRef.current)) {
      return;
    }
    draftRef.current = incoming;
    setDraft(incoming);
  }, [status.config]);

  /** 统一提交：本地先归一，界面立即响应，再防抖提交给原生 */
  const commit = useCallback(
    (patch: Partial<ClickConfig>) => {
      const merged = normalizeConfig({...draftRef.current, ...patch});
      draftRef.current = merged;
      pendingRef.current = true;
      setDraft(merged);
      debouncedSend.call(merged);
    },
    [debouncedSend],
  );

  /** 数值字段变更 */
  const setNumber = useCallback(
    (field: NumField, value: number) => {
      commit({[field]: value} as Partial<ClickConfig>);
    },
    [commit],
  );

  /** 恢复默认：立即提交，不等防抖 */
  const restoreDefault = useCallback(() => {
    setConfirmReset(false);
    const next = normalizeConfig(DEFAULT_CONFIG);
    pendingRef.current = true;
    draftRef.current = next;
    setDraft(next);
    sendConfig(next);
  }, [sendConfig]);

  // 组件卸载时把挂起的提交丢掉，不用 flush，避免对已卸载组件刷新状态
  useEffect(() => {
    const handle = debouncedSend;
    return () => handle.cancel();
  }, [debouncedSend]);

  const isDefault = useMemo(
    () => configKey(draft) === configKey(DEFAULT_CONFIG),
    [draft],
  );

  // 每秒估算点击次数，让用户直观理解间隔参数
  const tapsPerSecond = useMemo(() => {
    const base = Math.max(draft.intervalMs, 1);
    return (1000 / base).toFixed(1);
  }, [draft.intervalMs]);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>连点参数</Text>
        <Text style={styles.subtitle}>
          所有改动自动保存。运行中也可以调整，下一次点击生效。
        </Text>

        {error ? (
          <InlineAlert
            tone="danger"
            title={error}
            onDismiss={() => setError(null)}
          />
        ) : null}

        {/* 点击节奏 */}
        <Card title="点击节奏">
          <SliderRow
            label="点击间隔"
            value={draft.intervalMs}
            min={FIELD_LIMITS.intervalMs.min}
            max={FIELD_LIMITS.intervalMs.max}
            step={FIELD_LIMITS.intervalMs.step}
            unit="ms"
            onChange={v => setNumber('intervalMs', v)}
            hint={`约合每秒 ${tapsPerSecond} 次。数值越小越快。`}
          />
          <SliderRow
            label="间隔抖动"
            value={draft.jitterMs}
            min={FIELD_LIMITS.jitterMs.min}
            max={FIELD_LIMITS.jitterMs.max}
            step={FIELD_LIMITS.jitterMs.step}
            unit="ms"
            onChange={v => setNumber('jitterMs', v)}
            hint="每次间隔在上限内随机浮动，让节奏更接近手动点击。"
            zeroLabel="关闭"
          />
          <SliderRow
            label="按压时长"
            value={draft.pressMs}
            min={FIELD_LIMITS.pressMs.min}
            max={FIELD_LIMITS.pressMs.max}
            step={FIELD_LIMITS.pressMs.step}
            unit="ms"
            onChange={v => setNumber('pressMs', v)}
            hint="每一次按下保持的时间，调大可模拟长按。"
          />
        </Card>

        {/* 点击位置 */}
        <Card title="点击位置">
          <SliderRow
            label="随机偏移半径"
            value={draft.randomRadius}
            min={FIELD_LIMITS.randomRadius.min}
            max={FIELD_LIMITS.randomRadius.max}
            step={FIELD_LIMITS.randomRadius.step}
            unit="px"
            onChange={v => setNumber('randomRadius', v)}
            hint="在标记点周围这个半径内随机取点，0 表示每次都点同一处。"
            zeroLabel="精确"
          />
          <SwitchRow
            label="多点随机取点"
            description={
              draft.shuffle
                ? '多个标记点之间随机挑选'
                : '多个标记点按顺序依次点击'
            }
            value={draft.shuffle}
            onValueChange={v => commit({shuffle: v})}
          />
        </Card>

        {/* 启动与上限 */}
        <Card title="启动与上限">
          <SliderRow
            label="开始倒计时"
            value={draft.countdownMs}
            min={FIELD_LIMITS.countdownMs.min}
            max={FIELD_LIMITS.countdownMs.max}
            step={FIELD_LIMITS.countdownMs.step}
            unit="ms"
            onChange={v => setNumber('countdownMs', v)}
            hint="留给切到抢购 App 的时间，倒计时结束前请完成切换。"
            zeroLabel="立即开始"
          />
          <Text style={styles.currentHint}>
            当前：{formatMs(draft.countdownMs)}
          </Text>

          <SliderRow
            label="最多点击次数"
            value={draft.maxTaps}
            min={FIELD_LIMITS.maxTaps.min}
            max={FIELD_LIMITS.maxTaps.max}
            step={FIELD_LIMITS.maxTaps.step}
            unit="次"
            onChange={v => setNumber('maxTaps', v)}
            hint="达到上限后自动停止，适合无人值守时控制次数。0 表示不限。"
            zeroLabel="不限"
          />
          <ChipRow
            options={MAX_TAP_PRESETS.map(v => ({
              label: v === 0 ? '不限' : String(v),
              value: v,
            }))}
            value={draft.maxTaps}
            onChange={v => setNumber('maxTaps', v)}
          />
        </Card>

        {/* 配置摘要 */}
        <Card title="当前配置">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>实际间隔范围</Text>
            <Text style={styles.summaryValue}>
              {Math.max(draft.intervalMs - draft.jitterMs, 1)} –{' '}
              {draft.intervalMs + draft.jitterMs} ms
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>点击上限</Text>
            <Text style={styles.summaryValue}>
              {draft.maxTaps === 0 ? '不限，手动停止' : `${draft.maxTaps} 次`}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>取点方式</Text>
            <Text style={styles.summaryValue}>
              {draft.shuffle ? '随机' : '顺序'}
            </Text>
          </View>
        </Card>

        <AppButton
          label="恢复默认"
          onPress={() => setConfirmReset(true)}
          variant="outline"
          disabled={isDefault}
          hint={isDefault ? '当前已是默认配置' : undefined}
        />
      </ScrollView>

      <ConfirmDialog
        visible={confirmReset}
        title="恢复默认参数？"
        message={`点击间隔 ${DEFAULT_CONFIG.intervalMs} ms、抖动 ±${DEFAULT_CONFIG.jitterMs} ms、按压 ${DEFAULT_CONFIG.pressMs} ms、倒计时 ${DEFAULT_CONFIG.countdownMs} ms、点击上限不限。`}
        confirmLabel="恢复"
        onConfirm={restoreDefault}
        onCancel={() => setConfirmReset(false)}
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
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  currentHint: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: fontSize.body,
  },
  summaryValue: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
