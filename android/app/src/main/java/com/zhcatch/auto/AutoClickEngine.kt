package com.zhcatch.auto

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Path
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * 连点引擎：持有配置、标记点、运行状态，并在独立线程里按间隔调度点击。
 *
 * 点击动作通过无障碍服务 dispatchGesture 注入，因此可以作用于前台任意 App，
 * 包括本应用悬浮层之下的目标抢购页面。
 */
object AutoClickEngine {

    private const val PREFS = "zhcatch_prefs"
    private const val KEY_CONFIG = "config"
    private const val KEY_MARKERS = "markers"

    /** 一个标记点，坐标为屏幕物理像素，左上角为原点 */
    data class Marker(val id: String, var x: Int, var y: Int)

    /** 连点参数 */
    data class Config(
        var intervalMs: Long = 120L,
        var jitterMs: Long = 40L,
        var pressMs: Long = 45L,
        var randomRadius: Int = 0,
        var maxTaps: Int = 0,
        var shuffle: Boolean = false,
        var countdownMs: Long = 3000L,
    )

    val markers = CopyOnWriteArrayList<Marker>()

    @Volatile
    var config: Config = Config()
        private set

    @Volatile
    var running: Boolean = false
        private set

    @Volatile
    var tapCount: Int = 0
        private set

    /** 当前已连接的无障碍服务实例，未开启时为 null */
    @Volatile
    var service: ClickAccessibilityService? = null

    @Volatile
    var markersVisible: Boolean = true

    @Volatile
    var floatingVisible: Boolean = false

    /** 状态变化回调，由原生模块注册，用于往 JS 推事件 */
    @Volatile
    var onStateChanged: (() -> Unit)? = null

    private var prefs: SharedPreferences? = null
    private var worker: Thread? = null
    private val main = Handler(Looper.getMainLooper())

    fun init(context: Context) {
        if (prefs != null) {
            return
        }
        val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs = p
        load(p)
    }

    // ---------------------------------------------------------------- 持久化

    private fun load(p: SharedPreferences) {
        val raw = p.getString(KEY_CONFIG, null)
        if (raw != null) {
            val f = raw.split(",")
            if (f.size >= 7) {
                config = Config(
                    intervalMs = f[0].toLongOrNull() ?: 120L,
                    jitterMs = f[1].toLongOrNull() ?: 40L,
                    pressMs = f[2].toLongOrNull() ?: 45L,
                    randomRadius = f[3].toIntOrNull() ?: 0,
                    maxTaps = f[4].toIntOrNull() ?: 0,
                    shuffle = f[5] == "1",
                    countdownMs = f[6].toLongOrNull() ?: 3000L,
                )
                clampConfig()
            }
        }
        val rawMarkers = p.getString(KEY_MARKERS, null)
        markers.clear()
        if (!rawMarkers.isNullOrEmpty()) {
            rawMarkers.split(";").forEach { item ->
                val parts = item.split("|")
                if (parts.size == 3) {
                    val x = parts[1].toIntOrNull()
                    val y = parts[2].toIntOrNull()
                    if (x != null && y != null) {
                        markers.add(Marker(parts[0], x, y))
                    }
                }
            }
        }
    }

    private fun save() {
        val p = prefs ?: return
        val c = config
        val cfg = listOf(
            c.intervalMs.toString(),
            c.jitterMs.toString(),
            c.pressMs.toString(),
            c.randomRadius.toString(),
            c.maxTaps.toString(),
            if (c.shuffle) "1" else "0",
            c.countdownMs.toString(),
        ).joinToString(",")
        val mk = markers.joinToString(";") { "${it.id}|${it.x}|${it.y}" }
        p.edit().putString(KEY_CONFIG, cfg).putString(KEY_MARKERS, mk).apply()
    }

    // ---------------------------------------------------------------- 配置

    private fun clampConfig() {
        val c = config
        c.intervalMs = c.intervalMs.coerceIn(10L, 60_000L)
        c.jitterMs = c.jitterMs.coerceIn(0L, 5_000L)
        c.pressMs = c.pressMs.coerceIn(5L, 2_000L)
        c.randomRadius = c.randomRadius.coerceIn(0, 300)
        c.maxTaps = c.maxTaps.coerceIn(0, 10_000_000)
        c.countdownMs = c.countdownMs.coerceIn(0L, 60_000L)
    }

    /** 局部更新配置，返回完整新配置 */
    fun configure(
        intervalMs: Long? = null,
        jitterMs: Long? = null,
        pressMs: Long? = null,
        randomRadius: Int? = null,
        maxTaps: Int? = null,
        shuffle: Boolean? = null,
        countdownMs: Long? = null,
    ): Config {
        val c = config.copy()
        if (intervalMs != null) c.intervalMs = intervalMs
        if (jitterMs != null) c.jitterMs = jitterMs
        if (pressMs != null) c.pressMs = pressMs
        if (randomRadius != null) c.randomRadius = randomRadius
        if (maxTaps != null) c.maxTaps = maxTaps
        if (shuffle != null) c.shuffle = shuffle
        if (countdownMs != null) c.countdownMs = countdownMs
        config = c
        clampConfig()
        save()
        emit()
        return config
    }

    // ---------------------------------------------------------------- 标记点

    fun addMarker(x: Int, y: Int): Marker {
        val m = Marker(UUID.randomUUID().toString(), x, y)
        markers.add(m)
        save()
        emit()
        return m
    }

    fun removeMarker(id: String) {
        markers.removeAll { it.id == id }
        save()
        emit()
    }

    fun clearMarkers() {
        markers.clear()
        save()
        emit()
    }

    fun moveMarker(id: String, x: Int, y: Int) {
        markers.firstOrNull { it.id == id }?.let {
            it.x = x
            it.y = y
            save()
        }
    }

    // ---------------------------------------------------------------- 运行控制

    /** 启动连点；无障碍服务未开启或没有标记点时返回 false */
    fun start(): Boolean {
        val svc = service ?: return false
        if (markers.isEmpty()) {
            return false
        }
        if (running) {
            return true
        }
        tapCount = 0
        running = true
        emit()

        val t = Thread({ loop(svc) }, "zhcatch-clicker")
        t.isDaemon = true
        worker = t
        t.start()
        return true
    }

    fun stop() {
        if (!running) {
            return
        }
        running = false
        worker?.interrupt()
        worker = null
        emit()
    }

    fun resetCount() {
        tapCount = 0
        emit()
    }

    private fun loop(svc: ClickAccessibilityService) {
        try {
            // 倒计时：留给用户切到抢购页面
            val deadline = SystemClock.uptimeMillis() + config.countdownMs
            while (running && SystemClock.uptimeMillis() < deadline) {
                Thread.sleep(30L)
            }
            var cursor = 0
            while (running) {
                val list = markers
                if (list.isEmpty()) {
                    break
                }
                val m = if (config.shuffle || list.size == 1) {
                    if (list.size == 1) list[0] else list[Random.nextInt(list.size)]
                } else {
                    list[cursor++ % list.size]
                }
                val (x, y) = jittered(m)
                val ok = performTap(svc, x, y)
                if (!ok && service == null) {
                    break
                }
                if (ok) {
                    tapCount += 1
                    // 每 10 次推一次状态，避免高频事件把 JS 线程打满
                    if (tapCount % 10 == 0) {
                        emit()
                    }
                }
                val c = config
                val jitter = if (c.jitterMs > 0L) {
                    ((Random.nextDouble() * 2 - 1) * c.jitterMs).toLong()
                } else {
                    0L
                }
                val wait = (c.intervalMs + jitter).coerceAtLeast(10L)
                if (c.maxTaps > 0 && tapCount >= c.maxTaps) {
                    break
                }
                Thread.sleep(wait)
            }
        } catch (_: InterruptedException) {
            // 正常停止路径
        } finally {
            running = false
            worker = null
            emit()
        }
    }

    private fun jittered(m: Marker): Pair<Int, Int> {
        val r = config.randomRadius
        if (r <= 0) {
            return m.x to m.y
        }
        val angle = Random.nextDouble() * Math.PI * 2
        val radius = Random.nextDouble() * r
        val dx = (Math.cos(angle) * radius).roundToInt()
        val dy = (Math.sin(angle) * radius).roundToInt()
        return (m.x + dx) to (m.y + dy)
    }

    /** 在指定坐标注入一次点击（按下-抬起），同步等待结果 */
    private fun performTap(svc: AccessibilityService, x: Int, y: Int): Boolean {
        val path = Path()
        path.moveTo(x.toFloat(), y.toFloat())
        // 极短的线段，保证系统把它识别为点击而不是空路径
        path.lineTo(x + 1f, y + 1f)
        val duration = config.pressMs.coerceAtLeast(1L)
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0L, duration))
            .build()

        val latch = CountDownLatch(1)
        val ref = booleanArrayOf(false)

        val callback = object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                ref[0] = true
                latch.countDown()
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                latch.countDown()
            }
        }

        val dispatched = try {
            svc.dispatchGesture(gesture, callback, null)
        } catch (_: Exception) {
            false
        }
        if (!dispatched) {
            return false
        }
        latch.await((duration + 500L), TimeUnit.MILLISECONDS)
        return ref[0]
    }

    // ---------------------------------------------------------------- 状态广播

    /** 在主线程上回调状态，供原生模块推事件 */
    fun emit() {
        val cb = onStateChanged ?: return
        if (Looper.myLooper() == Looper.getMainLooper()) {
            cb()
        } else {
            main.post { cb() }
        }
    }

    /** 无障碍服务是否已连接（用于权限判断，避免只读设置项） */
    fun serviceConnected(): Boolean = service != null

    fun hasMarkers(): Boolean = markers.isNotEmpty()

    /** 屏幕尺寸，供新增标记点时取中心位置 */
    fun screenCenter(context: Context): Pair<Int, Int> {
        val (w, h) = screenSize(context)
        return (w / 2) to (h / 2)
    }

    /** 屏幕物理像素尺寸 */
    fun screenSize(context: Context): Pair<Int, Int> {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            val b = wm.currentWindowMetrics.bounds
            b.width() to b.height()
        } else {
            @Suppress("DEPRECATION")
            val d = android.util.DisplayMetrics().also { wm.defaultDisplay.getMetrics(it) }
            d.widthPixels to d.heightPixels
        }
    }

    /** 供悬浮层判断是否需要重绘标记点 */
    fun markerSignature(): Int {
        var h = markers.size
        markers.forEach { h = h * 31 + it.x + it.y * 7 + it.id.hashCode() }
        return h
    }

    fun samePoint(a: Marker, b: Marker): Boolean = a.x == b.x && a.y == b.y

    fun distance(ax: Int, ay: Int, bx: Int, by: Int): Int = abs(ax - bx) + abs(ay - by)
}
