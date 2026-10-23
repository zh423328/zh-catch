package com.zhcatch.auto

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.roundToInt

/**
 * RN 与原生连点引擎之间的桥。
 *
 * 方法签名见 CONTRACT.md，RN 侧封装在 src/native/AutoClick.ts。
 */
class AutoClickModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    private val main = Handler(Looper.getMainLooper())

    init {
        AutoClickEngine.init(ctx)
        // 引擎状态变化 → 推给 JS
        AutoClickEngine.onStateChanged = { pushState() }
    }

    override fun getName(): String = "ZhCatch"

    // ------------------------------------------------------------ 权限

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        promise.resolve(isAccessibilityOn() || AutoClickEngine.serviceConnected())
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        try {
            val i = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(i)
        } catch (_: Exception) {
        }
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(ctx))
    }

    @ReactMethod
    fun requestOverlayPermission() {
        try {
            val i = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${ctx.packageName}"),
            )
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(i)
        } catch (_: Exception) {
        }
    }

    /**
     * 判断本应用的无障碍服务是否已启用。
     * 注意 HyperOS/MIUI 会把设置项里的组件名改写成短格式
     * （如 com.pkg/.auto.Service），因此只按包名匹配，不做全串比对。
     */
    private fun isAccessibilityOn(): Boolean {
        val enabled = Settings.Secure.getString(
            ctx.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        val pkg = ctx.packageName
        while (splitter.hasNext()) {
            val entry = splitter.next().trim()
            if (entry.isEmpty()) {
                continue
            }
            val slash = entry.indexOf('/')
            if (slash <= 0) {
                continue
            }
            if (entry.substring(0, slash).equals(pkg, ignoreCase = true)) {
                return true
            }
        }
        return false
    }

    // ------------------------------------------------------------ 悬浮层

    @ReactMethod
    fun showFloatingUI(promise: Promise) {
        if (!Settings.canDrawOverlays(ctx)) {
            promise.resolve(false)
            return
        }
        val svc = AutoClickEngine.service
        val overlay = svc?.overlayController()
        if (overlay == null) {
            promise.resolve(false)
            return
        }
        // show 编组到主线程执行，结果回 native-modules 线程 resolve
        overlay.show(AutoClickEngine.markersVisible) { ok ->
            if (ok) {
                AutoClickEngine.floatingVisible = true
                AutoClickEngine.emit()
            }
            promise.resolve(ok)
        }
    }

    @ReactMethod
    fun hideFloatingUI(promise: Promise) {
        AutoClickEngine.floatingVisible = false
        AutoClickEngine.service?.overlayController()?.destroy()
        AutoClickEngine.emit()
        promise.resolve(true)
    }

    @ReactMethod
    fun setMarkersVisible(visible: Boolean, promise: Promise) {
        AutoClickEngine.markersVisible = visible
        val o = AutoClickEngine.service?.overlayController()
        o?.setMarkersVisible(visible)
        AutoClickEngine.emit()
        promise.resolve(true)
    }

    // ------------------------------------------------------------ 标记点

    @ReactMethod
    fun addMarker(x: Double, y: Double, promise: Promise) {
        val px: Int
        val py: Int
        if (x <= 0 && y <= 0) {
            val (cx, cy) = AutoClickEngine.screenCenter(ctx)
            px = cx
            py = cy
        } else {
            px = x.roundToInt()
            py = y.roundToInt()
        }
        val m = AutoClickEngine.addMarker(px, py)
        AutoClickEngine.service?.overlayController()?.rebuildMarkers()
        promise.resolve(m.id)
    }

    @ReactMethod
    fun removeMarker(id: String, promise: Promise) {
        AutoClickEngine.removeMarker(id)
        AutoClickEngine.service?.overlayController()?.rebuildMarkers()
        promise.resolve(null)
    }

    @ReactMethod
    fun clearMarkers(promise: Promise) {
        AutoClickEngine.clearMarkers()
        AutoClickEngine.service?.overlayController()?.rebuildMarkers()
        promise.resolve(null)
    }

    @ReactMethod
    fun getMarkers(promise: Promise) {
        val arr = Arguments.createArray()
        AutoClickEngine.markers.forEach { m ->
            arr.pushMap(
                Arguments.createMap().apply {
                    putString("id", m.id)
                    putDouble("x", m.x.toDouble())
                    putDouble("y", m.y.toDouble())
                },
            )
        }
        promise.resolve(arr)
    }

    // ------------------------------------------------------------ 配置

    @ReactMethod
    fun configure(patch: ReadableMap, promise: Promise) {
        val c = AutoClickEngine.configure(
            intervalMs = if (patch.hasKey("intervalMs")) patch.getDouble("intervalMs").toLong() else null,
            jitterMs = if (patch.hasKey("jitterMs")) patch.getDouble("jitterMs").toLong() else null,
            pressMs = if (patch.hasKey("pressMs")) patch.getDouble("pressMs").toLong() else null,
            randomRadius = if (patch.hasKey("randomRadius")) patch.getDouble("randomRadius").roundToInt() else null,
            maxTaps = if (patch.hasKey("maxTaps")) patch.getDouble("maxTaps").roundToInt() else null,
            shuffle = if (patch.hasKey("shuffle")) patch.getBoolean("shuffle") else null,
            countdownMs = if (patch.hasKey("countdownMs")) patch.getDouble("countdownMs").toLong() else null,
        )
        promise.resolve(configMap(c))
    }

    @ReactMethod
    fun getConfig(promise: Promise) {
        promise.resolve(configMap(AutoClickEngine.config))
    }

    private fun configMap(c: AutoClickEngine.Config): WritableMap =
        Arguments.createMap().apply {
            putDouble("intervalMs", c.intervalMs.toDouble())
            putDouble("jitterMs", c.jitterMs.toDouble())
            putDouble("pressMs", c.pressMs.toDouble())
            putDouble("randomRadius", c.randomRadius.toDouble())
            putDouble("maxTaps", c.maxTaps.toDouble())
            putBoolean("shuffle", c.shuffle)
            putDouble("countdownMs", c.countdownMs.toDouble())
        }

    // ------------------------------------------------------------ 运行控制

    @ReactMethod
    fun start(promise: Promise) {
        try {
            val enabled = isAccessibilityOn() || AutoClickEngine.serviceConnected()
            if (!enabled || !AutoClickEngine.hasMarkers()) {
                promise.resolve(false)
                return
            }
            AutoClickEngine.service?.overlayController()?.setMarkersInteractive(false)
            val ok = AutoClickEngine.start()
            if (!ok) {
                AutoClickEngine.service?.overlayController()?.setMarkersInteractive(true)
            }
            promise.resolve(ok)
        } catch (e: Exception) {
            // 任何异常都回 false，让 UI 走统一提示，不抛 reject
            android.util.Log.w("ZhCatch", "start failed", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        AutoClickEngine.stop()
        AutoClickEngine.service?.overlayController()?.setMarkersInteractive(true)
        promise.resolve(null)
    }

    @ReactMethod
    fun resetCount(promise: Promise) {
        AutoClickEngine.resetCount()
        promise.resolve(null)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(statusMap())
    }

    private fun statusMap(): WritableMap {
        val markers = Arguments.createArray()
        AutoClickEngine.markers.forEach { m ->
            markers.pushMap(
                Arguments.createMap().apply {
                    putString("id", m.id)
                    putDouble("x", m.x.toDouble())
                    putDouble("y", m.y.toDouble())
                },
            )
        }
        return Arguments.createMap().apply {
            putBoolean("running", AutoClickEngine.running)
            putDouble("tapCount", AutoClickEngine.tapCount.toDouble())
            putDouble("markerCount", AutoClickEngine.markers.size.toDouble())
            putArray("markers", markers)
            putBoolean("accessibility", isAccessibilityOn() || AutoClickEngine.serviceConnected())
            putBoolean("overlayPermitted", Settings.canDrawOverlays(ctx))
            putBoolean("floatingVisible", AutoClickEngine.floatingVisible)
            putBoolean("markersVisible", AutoClickEngine.markersVisible)
            putMap("config", configMap(AutoClickEngine.config))
        }
    }

    // ------------------------------------------------------------ 事件

    private fun pushState() {
        main.post {
            if (!ctx.hasActiveReactInstance()) {
                return@post
            }
            try {
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("ZhCatchState", statusMap())
            } catch (_: Exception) {
            }
        }
    }

    /** 让 DeviceEventEmitter 在新架构下不报警告 */
    @ReactMethod
    fun addListener(eventName: String) {
        // 占位：RN 需要该签名存在以避免告警
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // 占位
    }

    override fun invalidate() {
        AutoClickEngine.onStateChanged = null
        super.invalidate()
    }

    companion object {
        const val NAME = "ZhCatch"
    }
}
