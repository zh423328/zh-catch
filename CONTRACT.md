# ZhCatch 接口契约（原生 ⇄ RN）

本文件是原生层与 RN 层唯一的对接约定。两端独立开发，任何一方都不要改动这里的签名。

## 1. 唯一入口

RN 侧只允许通过 `src/native/AutoClick.ts` 调用原生能力，页面层不得直接 import `NativeModules`。
原生模块名：**`ZhCatch`**。

## 2. 数据模型

```ts
type Marker = {id: string; x: number; y: number}; // 屏幕物理像素，左上角为原点

type ClickConfig = {
  intervalMs: number;    // 两次点击间隔，默认 120
  jitterMs: number;      // 间隔随机抖动 ±ms，默认 40
  pressMs: number;       // 单次按压时长，默认 45
  randomRadius: number;  // 点击点随机偏移半径 px，默认 0
  maxTaps: number;       // 0 = 不限
  shuffle: boolean;      // 多点随机取点
  countdownMs: number;   // 开始前倒计时，默认 3000
};

type AutoClickStatus = {
  running: boolean;
  tapCount: number;
  markerCount: number;
  markers: Marker[];
  accessibility: boolean;
  overlayPermitted: boolean;
  floatingVisible: boolean;
  markersVisible: boolean; // 标记点显示状态，与悬浮层「隐藏标记」联动
  config: ClickConfig;
};
```

## 3. 方法（全部返回 Promise，除非注明）

| 方法 | 说明 |
| --- | --- |
| `isAccessibilityEnabled()` | 无障碍开关 |
| `openAccessibilitySettings()` | 跳转系统无障碍设置（同步） |
| `canDrawOverlays()` | 悬浮窗权限 |
| `requestOverlayPermission()` | 跳转悬浮窗授权页（同步） |
| `showFloatingUI()` | 显示悬浮控制条 + 所有标记点 |
| `hideFloatingUI()` | 隐藏悬浮层 |
| `setMarkersVisible(v)` | 只显示/隐藏标记点，控制条保留 |
| `addMarker(x, y)` | 新增标记点，resolve 新 id |
| `removeMarker(id)` | 删除 |
| `clearMarkers()` | 清空 |
| `getMarkers()` | 读取 |
| `configure(patch)` | 部分更新配置，resolve 完整配置 |
| `getConfig()` | 读取配置 |
| `start()` | 开始连点；无障碍未开时 resolve `false` |
| `stop()` | 停止 |
| `resetCount()` | 计数归零 |
| `getStatus()` | 完整状态快照 |

## 4. 事件

事件名 **`ZhCatchState`**，payload 为 `AutoClickStatus`。触发时机：运行状态变化、点击数（每 10 次节流 + 停止时必发）、标记点增删、配置变更、悬浮层显示变化。

订阅封装已给出：`subscribeStatus(handler) => unsubscribe`。

## 5. 行为保证

- `start()` **永不 reject**：无障碍未开 / 没有标记点 / 内部异常，一律 `resolve(false)`。`false` 不区分具体原因，UI 统一提示「请先开启无障碍服务并至少添加 1 个标记点」。
- `configure()` 原生侧兜底 clamp：interval 10–60000、jitter 0–5000、press 5–2000、radius 0–300、maxTaps 0–1000万、countdown 0–60000。
- 标记点为**独立小悬浮窗**（约 52dp），窗外触摸穿透到下层 App；长按标记窗删除，轻点显示坐标。
- 连点引擎在独立线程运行，注入坐标与标记窗坐标同源（屏幕物理像素）。

## 6. RN 侧要求

- 语言：简体中文文案，代码标识符英文。
- 不新增第三方 UI 库依赖（`react-native-safe-area-context` 已装，可用）。
- 不修改 `android/`、`src/native/AutoClick.ts`、`App.tsx` 之外的任何原生文件；UI 写入范围：`App.tsx`、`src/screens/`、`src/components/`、`src/theme.ts`、`src/utils/`。
- 不允许出现 `TouchableOpacity` 之外的自造手势库调用。
- 所有交互必须处理「无障碍未开启」「悬浮窗未授权」两种未就绪态。
