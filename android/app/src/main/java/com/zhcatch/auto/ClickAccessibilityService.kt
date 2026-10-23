package com.zhcatch.auto

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

/**
 * 点击注入服务。
 *
 * 本服务不做任何界面读取，只负责两件事：
 * 1. 把自己注册给 [AutoClickEngine]，让引擎可以用 dispatchGesture 注入点击；
 * 2. 在连接时挂载悬浮层，断开时清理。
 */
class ClickAccessibilityService : AccessibilityService() {

    private var overlay: OverlayController? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        AutoClickEngine.init(applicationContext)
        AutoClickEngine.service = this
        overlay = OverlayController(this)
        AutoClickEngine.emit()

        // 服务被系统重启但引擎里还有上次的运行态时，主动收尾，避免状态错乱
        if (AutoClickEngine.running) {
            AutoClickEngine.stop()
        }
        if (AutoClickEngine.floatingVisible) {
            restoreFloating()
        }
    }

    /** 进程重启后恢复悬浮层显示 */
    private fun restoreFloating() {
        val o = overlay ?: return
        val ctx = applicationContext
        val ok = android.provider.Settings.canDrawOverlays(ctx)
        if (!ok) {
            AutoClickEngine.floatingVisible = false
            AutoClickEngine.emit()
            return
        }
        o.show(AutoClickEngine.markersVisible)
        AutoClickEngine.floatingVisible = true
        AutoClickEngine.emit()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // 不需要读取窗口内容，此处留空
    }

    override fun onInterrupt() {
        AutoClickEngine.stop()
    }

    override fun onUnbind(intent: Intent?): Boolean {
        cleanup()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun cleanup() {
        AutoClickEngine.stop()
        overlay?.destroy()
        overlay = null
        AutoClickEngine.service = null
        AutoClickEngine.floatingVisible = false
        AutoClickEngine.emit()
    }

    // ------------------------------------------------------------ 供悬浮层调用

    fun toggleFromOverlay() {
        if (AutoClickEngine.running) {
            AutoClickEngine.stop()
        } else {
            if (!AutoClickEngine.hasMarkers()) {
                toast("请先把标记点拖到抢购按钮上")
                return
            }
            startWithCountdown()
        }
    }

    /** 悬浮条上点开始：先把标记层设为不可触摸，再启动引擎 */
    private fun startWithCountdown() {
        overlay?.setMarkersInteractive(false)
        val ok = AutoClickEngine.start()
        if (!ok) {
            overlay?.setMarkersInteractive(true)
            toast("无障碍服务未就绪，请重新开启")
        }
    }

    fun onEngineStateChanged() {
        overlay?.syncState()
    }

    private fun toast(text: String) {
        android.os.Handler(mainLooper).post {
            Toast.makeText(applicationContext, text, Toast.LENGTH_SHORT).show()
        }
    }

    /** 供外部（模块）在无障碍服务存活时直接操作悬浮层 */
    fun overlayController(): OverlayController? = overlay

    fun isServiceReady(): Boolean = AutoClickEngine.service === this

    fun now(): Long = SystemClock.uptimeMillis()
}
