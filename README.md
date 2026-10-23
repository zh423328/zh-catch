# ZhCatch 智点连点器

安卓抢购连点器：把悬浮标记点拖到抢购按钮的位置，按「开始」，App 以设定频率持续点击这些坐标，直到手动停止。基于 React Native 0.88 + Android 无障碍手势注入实现。

## 功能

- **悬浮标记点**：每个标记点是独立小悬浮窗，可拖到屏幕任意位置；标记点之外的触摸直接穿透到下层 App，不影响你滑动页面
- **多点支持**：可放多个标记点（如「领取」+「确认」两个按钮），按顺序轮询或随机取点
- **连点参数**：点击间隔、间隔抖动（±ms 随机）、按压时长、随机偏移半径、最大次数
- **开始倒计时**：按开始后留出几秒切到抢购页面
- **悬浮控制条**：不回到 App 也能开始 / 停止 / 加点 / 清空 / 关闭
- **参数持久化**：配置和标记点位置自动保存，重启后还在

## 安装与运行

环境要求：Node ≥ 22、JDK 17、Android SDK（`ANDROID_HOME` 已配置）。

```bash
# 安装依赖（已配置国内源）
npm install

# 连接手机或启动模拟器后
npm run android

# 或手动构建 APK
cd android && ./gradlew assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

真机安装：

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## 首次使用

1. 打开 App，在「控制」页点 **去开启**，跳转系统无障碍设置，找到「智点连点器」并开启
   （系统可能提示该服务可以注入点击手势，本服务不读取任何屏幕内容）
2. 返回 App，点 **去授权** 允许「显示在其他应用上层」
3. 点 **显示悬浮控制条**，屏幕上出现控制条；点控制条的 `⋯` → **+ 标记** 添加标记点
4. 把标记窗**拖**到抢购按钮的位置（可放多个）
5. 打开抢购页面，按控制条上的 **开始**（或回 App 按大按钮），等待倒计时结束即开始连点
6. 随时按控制条 **停止** 结束

## 使用技巧

- 抢购按钮位置固定时，提前摆好标记点再倒计时，比手速点更稳
- 间隔建议 ≥ 100ms 并保留抖动，过密可能触发平台风控或被判定为异常点击
- 「随机偏移半径」设 10–30px 可让点击落点更自然
- 按压时长调到 300ms 以上可以当「长按连发」用
- 标记窗**轻点**显示坐标便于微调，**长按**删除

## 目录结构

```
src/
  native/AutoClick.ts      # 原生桥接层（唯一入口，含类型定义）
  screens/HomeScreen.tsx   # 主控制页：授权引导 + 启停
  screens/MarkersScreen.tsx# 标记点列表管理
  screens/ConfigScreen.tsx # 参数面板
  components/…             # 通用组件
  hooks/useAutoClickStatus.ts
android/app/src/main/java/com/zhcatch/auto/
  AutoClickEngine.kt       # 连点引擎：调度、抖动、持久化
  ClickAccessibilityService.kt # 无障碍服务：挂载悬浮层 + 提供手势注入
  OverlayController.kt     # 悬浮层：标记窗 + 控制条
  AutoClickModule.kt       # RN 桥（模块名 ZhCatch）
  AutoClickPackage.kt
```

## 技术要点

- 点击注入走 `AccessibilityService.dispatchGesture`，作用对象是**前台任意 App**，不限于本应用
- 标记点是独立悬浮窗而非全屏层，窗体外触摸事件自然穿透，运行时才把标记窗切成不可触摸，让注入点击落到下层目标上
- 引擎在独立线程调度，事件每 10 次点击节流推送一次到 JS，避免高频事件卡 UI
- 配置与标记点坐标持久化在 SharedPreferences

## 已知限制

- 仅 Android（iOS 无对应的无障碍注入能力）
- Android 13+ 部分厂商（MIUI 等）需要额外在「无障碍 → 已下载的应用」里允许，并在电池设置中允许后台运行
- 强杀进程后无障碍服务会掉线，重新开启即可（悬浮层状态会自动恢复）
