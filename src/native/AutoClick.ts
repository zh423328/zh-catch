/**
 * ZhCatch 原生桥接层
 *
 * 与 Android 原生模块 com.zhcatch.auto.AutoClickModule 一一对应。
 * JS 侧只依赖本文件，页面层不要直接使用 NativeModules。
 */
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

/** 一个悬浮标记点（屏幕物理像素坐标，左上角原点） */
export type Marker = {
  id: string;
  x: number;
  y: number;
};

/** 连点参数 */
export type ClickConfig = {
  /** 两次点击之间的间隔（毫秒），点击起点到下一次点击起点 */
  intervalMs: number;
  /** 间隔随机抖动范围（毫秒，正负），防风控更自然 */
  jitterMs: number;
  /** 每次按压的持续时长（毫秒），调大可模拟长按 */
  pressMs: number;
  /** 每次点击在标记点附近的随机偏移半径（像素），0 表示精确点同一处 */
  randomRadius: number;
  /** 最大点击次数，0 表示不限，直到手动停止 */
  maxTaps: number;
  /** 多点模式下是否随机取点（关闭则按顺序轮询） */
  shuffle: boolean;
  /** 从 JS 点击「开始」后的倒计时（毫秒），留给用户切换到目标 App */
  countdownMs: number;
};

/** 运行状态快照 */
export type AutoClickStatus = {
  running: boolean;
  tapCount: number;
  markerCount: number;
  markers: Marker[];
  /** 无障碍服务是否已开启 */
  accessibility: boolean;
  /** 悬浮窗权限是否已授予 */
  overlayPermitted: boolean;
  /** 悬浮控制条是否显示 */
  floatingVisible: boolean;
  /** 标记点是否可见（与悬浮层里的「隐藏标记」按钮联动） */
  markersVisible: boolean;
  config: ClickConfig;
};

export const DEFAULT_CONFIG: ClickConfig = {
  intervalMs: 120,
  jitterMs: 40,
  pressMs: 45,
  randomRadius: 0,
  maxTaps: 0,
  shuffle: false,
  countdownMs: 3000,
};

type NativeApi = {
  isAccessibilityEnabled(): Promise<boolean>;
  openAccessibilitySettings(): void;
  canDrawOverlays(): Promise<boolean>;
  requestOverlayPermission(): void;
  showFloatingUI(): Promise<boolean>;
  hideFloatingUI(): Promise<boolean>;
  setMarkersVisible(visible: boolean): Promise<boolean>;
  addMarker(x: number, y: number): Promise<string>;
  removeMarker(id: string): Promise<void>;
  clearMarkers(): Promise<void>;
  getMarkers(): Promise<Marker[]>;
  configure(patch: Partial<ClickConfig>): Promise<ClickConfig>;
  getConfig(): Promise<ClickConfig>;
  start(): Promise<boolean>;
  stop(): Promise<void>;
  resetCount(): Promise<void>;
  getStatus(): Promise<AutoClickStatus>;
};

const native = (NativeModules as Record<string, unknown>).ZhCatch as
  | NativeApi
  | undefined;

/** 原生模块是否可用（iOS / 未编译原生时为 false） */
export const isSupported = Platform.OS === 'android' && !!native;

function api(): NativeApi {
  if (!native) {
    throw new Error('当前平台没有 ZhCatch 原生模块');
  }
  return native;
}

export const AutoClick = {
  isSupported,
  isAccessibilityEnabled: () => api().isAccessibilityEnabled(),
  openAccessibilitySettings: () => api().openAccessibilitySettings(),
  canDrawOverlays: () => api().canDrawOverlays(),
  requestOverlayPermission: () => api().requestOverlayPermission(),
  showFloatingUI: () => api().showFloatingUI(),
  hideFloatingUI: () => api().hideFloatingUI(),
  setMarkersVisible: (visible: boolean) => api().setMarkersVisible(visible),
  addMarker: (x: number, y: number) => api().addMarker(x, y),
  removeMarker: (id: string) => api().removeMarker(id),
  clearMarkers: () => api().clearMarkers(),
  getMarkers: () => api().getMarkers(),
  configure: (patch: Partial<ClickConfig>) => api().configure(patch),
  getConfig: () => api().getConfig(),
  start: () => api().start(),
  stop: () => api().stop(),
  resetCount: () => api().resetCount(),
  getStatus: () => api().getStatus(),
};

/** 原生状态推送事件名 */
export const STATE_EVENT = 'ZhCatchState';

/** 事件表：RN 0.88 起 NativeEventEmitter 为泛型，需显式声明载荷类型 */
type ZhCatchEvents = {
  ZhCatchState: [AutoClickStatus];
};

let emitter: NativeEventEmitter<ZhCatchEvents> | null = null;

export function subscribeStatus(
  handler: (status: AutoClickStatus) => void,
): () => void {
  if (!native) {
    return () => {};
  }
  if (!emitter) {
    emitter = new NativeEventEmitter<ZhCatchEvents>(
      native as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
    );
  }
  const sub = emitter.addListener(STATE_EVENT, handler);
  return () => sub.remove();
}
