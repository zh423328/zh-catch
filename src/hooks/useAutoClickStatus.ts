/**
 * 原生状态订阅 Hook
 *
 * 职责：
 * 1. 订阅原生 `ZhCatchState` 推送事件，拿到完整状态快照；
 * 2. 每 1.5 秒补拉一次 `getStatus()`，防止事件丢失导致界面停在旧值；
 * 3. 当页面从系统设置页返回（AppState 变为 active）时立即刷新，
 *    这样用户开完无障碍权限回到 App，状态马上就是新的。
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {
  AutoClick,
  DEFAULT_CONFIG,
  isSupported as nativeSupported,
  subscribeStatus,
  type AutoClickStatus,
} from '../native/AutoClick';

/** 轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 1500;

/** 原生模块不可用时的兜底状态，保证页面结构始终可用 */
export const EMPTY_STATUS: AutoClickStatus = {
  running: false,
  tapCount: 0,
  markerCount: 0,
  markers: [],
  accessibility: false,
  overlayPermitted: false,
  floatingVisible: false,
  markersVisible: true,
  config: DEFAULT_CONFIG,
};

export type AutoClickState = {
  /** 最新的状态快照 */
  status: AutoClickStatus;
  /** 主动刷新一次 */
  refresh: () => Promise<void>;
  /** 读取状态时的错误信息 */
  loadError: string | null;
  /** 当前平台/构建是否提供原生模块 */
  supported: boolean;
  /** 两项前置权限是否都满足 */
  ready: boolean;
};

export function useAutoClickStatus(): AutoClickState {
  const [status, setStatus] = useState<AutoClickStatus>(EMPTY_STATUS);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 组件是否仍挂载，避免卸载后 setState
  const mountedRef = useRef(true);
  // 是否处于前台；后台时不轮询，回到前台立刻补一次
  const activeRef = useRef(true);

  const apply = useCallback((next: AutoClickStatus) => {
    if (mountedRef.current) {
      setStatus(next);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!nativeSupported) {
      return;
    }
    try {
      const next = await AutoClick.getStatus();
      if (mountedRef.current) {
        setStatus(next);
        setLoadError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(err instanceof Error ? err.message : '读取原生状态失败');
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // 订阅原生推送
    const unsubscribe = subscribeStatus(apply);
    // 首帧拉一次，避免等 1.5 秒才显示真实状态
    refresh();
    // 定时兜底刷新：后台跳过，节省电量
    const timer = setInterval(() => {
      if (activeRef.current) {
        refresh();
      }
    }, POLL_INTERVAL_MS);
    // 前后台切换：回到前台立即刷新
    const appStateSub = AppState.addEventListener('change', next => {
      activeRef.current = next === 'active';
      if (next === 'active') {
        refresh();
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      clearInterval(timer);
      appStateSub.remove();
    };
  }, [apply, refresh]);

  return {
    status,
    refresh,
    loadError,
    supported: nativeSupported,
    ready: status.accessibility && status.overlayPermitted,
  };
}
