package com.zhcatch.auto

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * 悬浮层控制器。
 *
 * 设计要点：
 * 1. 每个标记点是一个**独立的小悬浮窗**，而不是一整块全屏透明层。
 *    标记点之外的触摸自然穿透到下层 App，用户可以正常滑动抢购页面。
 * 2. 所有视图操作统一编组到主线程执行（onMain）。RN 桥方法运行在
 *    native-modules 线程，直接 addView 会把视图树建到错误线程，
 *    之后主线程更新 UI 会抛 CalledFromWrongThreadException。
 * 3. 运行时把标记窗切成 FLAG_NOT_TOUCHABLE，
 *    注入的点击会落到标记窗下方的目标 App 上。
 *
 * 坐标统一使用屏幕物理像素（左上角原点），与 dispatchGesture 一致。
 */
class OverlayController(private val service: ClickAccessibilityService) {

    private val wm = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val main = Handler(Looper.getMainLooper())
    private val density = service.resources.displayMetrics.density

    private class MarkerWindow(val view: View, val params: WindowManager.LayoutParams)

    private val markerWindows = LinkedHashMap<String, MarkerWindow>()

    private var barView: LinearLayout? = null
    private var barParams: WindowManager.LayoutParams? = null
    private var statusText: TextView? = null
    private var actionButton: TextView? = null
    private var expandRow: LinearLayout? = null
    private var hintText: TextView? = null
    private var toggleMarksButton: TextView? = null

    /** 标记窗是否可拖动（编辑态）；运行时为 false */
    private var markersInteractive = true

    var visible = false
        private set

    private val ticker = object : Runnable {
        override fun run() {
            updateStatusText()
            if (AutoClickEngine.floatingVisible) {
                main.postDelayed(this, 200L)
            }
        }
    }

    /** 视图操作必须落在主线程 */
    private fun onMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
        } else {
            main.post(block)
        }
    }

    // ------------------------------------------------------------------ 对外接口（任意线程可调）

    /** 显示悬浮层；控制条创建成功经 callback 返回 true（标记窗失败不阻塞） */
    fun show(markersVisible: Boolean, onResult: (Boolean) -> Unit = {}) {
        onMain { onResult(showOnMain(markersVisible)) }
    }

    /** 隐藏并释放所有窗口 */
    fun destroy() {
        onMain { destroyOnMain() }
    }

    /** 与引擎同步：新增/删除/移动标记窗 */
    fun syncMarkers() {
        onMain { syncMarkersOnMain() }
    }

    /** 兼容旧调用名 */
    fun rebuildMarkers() = syncMarkers()

    /**
     * 切换标记窗是否可拖动。
     * 运行时必须为 false，否则注入的点击会被自己的悬浮窗吃掉。
     */
    fun setMarkersInteractive(interactive: Boolean) {
        onMain { setMarkersInteractiveOnMain(interactive) }
    }

    fun setMarkersVisible(show: Boolean) {
        onMain { setMarkersVisibleOnMain(show) }
    }

    /** 运行状态变化时刷新控制条与标记层 */
    fun syncState() {
        onMain { syncStateOnMain() }
    }

    // ------------------------------------------------------------------ 主线程实现

    private fun showOnMain(markersVisible: Boolean): Boolean {
        if (!Settings.canDrawOverlays(service)) {
            return false
        }
        if (barView == null) {
            createControlBar()
        }
        if (barView == null) {
            return false
        }
        visible = true
        markersInteractive = true
        setMarkersVisibleOnMain(markersVisible)
        setMarkersInteractiveOnMain(true)
        syncMarkersOnMain()
        main.removeCallbacks(ticker)
        main.post(ticker)
        updateStatusText()
        return true
    }

    private fun destroyOnMain() {
        main.removeCallbacks(ticker)
        markerWindows.keys.toList().forEach { removeMarkerWindowOnMain(it) }
        removeWindow(barView)
        barView = null
        barParams = null
        statusText = null
        actionButton = null
        expandRow = null
        hintText = null
        toggleMarksButton = null
        visible = false
        markersInteractive = true
    }

    private fun syncMarkersOnMain() {
        val ids = AutoClickEngine.markers.map { it.id }.toSet()

        // 删除已不存在的标记窗
        markerWindows.keys.toList()
            .filter { it !in ids }
            .forEach { removeMarkerWindowOnMain(it) }

        AutoClickEngine.markers.forEach { m ->
            val exist = markerWindows[m.id]
            if (exist == null) {
                addMarkerWindowOnMain(m)
            } else {
                if (exist.params.x != m.x || exist.params.y != m.y) {
                    exist.params.x = m.x
                    exist.params.y = m.y
                    try {
                        wm.updateViewLayout(exist.view, exist.params)
                    } catch (_: Exception) {
                    }
                }
                (exist.view as? MarkerView)?.invalidate()
            }
        }
        applyMarkersVisibility(AutoClickEngine.markersVisible)
    }

    private fun setMarkersInteractiveOnMain(interactive: Boolean) {
        markersInteractive = interactive
        markerWindows.values.forEach { applyTouchable(it.view, it.params, interactive) }
    }

    private fun setMarkersVisibleOnMain(show: Boolean) {
        val changed = AutoClickEngine.markersVisible != show
        AutoClickEngine.markersVisible = show
        applyMarkersVisibility(show)
        toggleMarksButton?.text = if (show) "隐藏标记" else "显示标记"
        // 推给 JS，让 App 内的「显示标记点」开关保持同步
        if (changed) {
            AutoClickEngine.emit()
        }
    }

    private fun syncStateOnMain() {
        val running = AutoClickEngine.running
        setMarkersInteractiveOnMain(!running)
        syncMarkersOnMain()
        actionButton?.let { btn ->
            btn.text = if (running) "停止" else "开始"
            btn.background = rounded(
                d(15).toFloat(),
                if (running) 0xFF37474F.toInt() else 0xFFE53935.toInt(),
                0,
            )
        }
        updateStatusText()
    }

    private fun updateStatusText() {
        val st = statusText ?: return
        val running = AutoClickEngine.running
        val n = AutoClickEngine.markers.size
        st.text = if (running) {
            "运行 ${AutoClickEngine.tapCount}"
        } else {
            if (n == 0) "就绪 · 0 标记" else "就绪 · $n 标记"
        }

        val hint = hintText ?: return
        when {
            running && AutoClickEngine.tapCount == 0 && AutoClickEngine.config.countdownMs > 0 ->
                hint.text = "倒计时中，即将开始点击…"
            !running && n == 0 -> hint.text = "点 ⋯ 添加标记，拖到抢购按钮上"
            !running -> hint.text = "打开目标 App，按开始即可连点"
            else -> hint.text = "间隔 ${AutoClickEngine.config.intervalMs}ms"
        }
        hint.visibility = View.VISIBLE
    }

    // ------------------------------------------------------------------ 标记窗实现

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    private fun sizePx(): Int = (52 * density).roundToInt()

    private fun addMarkerWindowOnMain(m: AutoClickEngine.Marker) {
        if (!Settings.canDrawOverlays(service)) {
            return
        }
        val size = sizePx()
        val v = MarkerView(service, m)
        val p = WindowManager.LayoutParams(
            size,
            size,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        )
        p.gravity = Gravity.TOP or Gravity.START
        p.x = m.x
        p.y = m.y
        try {
            wm.addView(v, p)
        } catch (_: Exception) {
            return
        }
        markerWindows[m.id] = MarkerWindow(v, p)
        if (!AutoClickEngine.markersVisible) {
            v.visibility = View.INVISIBLE
        }
        applyTouchable(v, p, markersInteractive)
    }

    private fun removeMarkerWindowOnMain(id: String) {
        val w = markerWindows.remove(id) ?: return
        try {
            if (w.view.isAttachedToWindow) {
                wm.removeView(w.view)
            }
        } catch (_: Exception) {
        }
    }

    private fun removeWindow(v: View?) {
        if (v == null) {
            return
        }
        try {
            if (v.isAttachedToWindow) {
                wm.removeView(v)
            }
        } catch (_: Exception) {
        }
    }

    private fun applyTouchable(v: View, p: WindowManager.LayoutParams, touchable: Boolean) {
        val flags = if (touchable) {
            p.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        } else {
            p.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        }
        if (flags == p.flags) {
            return
        }
        p.flags = flags
        try {
            wm.updateViewLayout(v, p)
        } catch (_: Exception) {
        }
    }

    private fun applyMarkersVisibility(show: Boolean) {
        markerWindows.values.forEach { w ->
            w.view.visibility = if (show) View.VISIBLE else View.INVISIBLE
        }
    }

    // ------------------------------------------------------------------ 控制条

    @SuppressLint("ClickableViewAccessibility")
    private fun createControlBar() {
        val bar = LinearLayout(service)
        bar.orientation = LinearLayout.VERTICAL
        bar.setPadding(d(10), d(6), d(10), d(6))
        bar.background = rounded(d(18).toFloat(), 0xF0202024.toInt(), 0x33FFFFFF)

        // 第一行：拖动柄 + 状态 + 主按钮 + 更多
        val row = LinearLayout(service)
        row.orientation = LinearLayout.HORIZONTAL
        row.gravity = Gravity.CENTER_VERTICAL

        val grip = TextView(service)
        grip.text = "⠿"
        grip.setTextColor(0x99FFFFFF.toInt())
        grip.textSize = 17f
        grip.setPadding(d(4), d(2), d(10), d(2))
        row.addView(grip)

        val status = TextView(service)
        status.text = "就绪"
        status.setTextColor(Color.WHITE)
        status.textSize = 12f
        status.setPadding(d(2), 0, d(10), 0)
        statusText = status
        row.addView(status)

        val action = TextView(service)
        action.text = "开始"
        action.setTextColor(Color.WHITE)
        action.textSize = 13f
        action.gravity = Gravity.CENTER
        action.setPadding(d(16), d(7), d(16), d(7))
        action.background = rounded(d(15).toFloat(), 0xFFE53935.toInt(), 0)
        actionButton = action
        row.addView(action)

        val more = TextView(service)
        more.text = "⋯"
        more.setTextColor(0xCCFFFFFF.toInt())
        more.textSize = 18f
        more.gravity = Gravity.CENTER
        more.setPadding(d(10), d(4), d(6), d(4))
        row.addView(more)

        bar.addView(row)

        // 第二行：提示
        val hint = TextView(service)
        hint.text = ""
        hint.setTextColor(0xFFFFC107.toInt())
        hint.textSize = 11f
        hint.setPadding(d(4), d(3), d(4), 0)
        hint.visibility = View.GONE
        hintText = hint
        bar.addView(hint)

        // 展开行：加标记 / 标记显隐 / 清空 / 关闭
        val expand = LinearLayout(service)
        expand.orientation = LinearLayout.HORIZONTAL
        expand.gravity = Gravity.CENTER_VERTICAL
        expand.setPadding(0, d(6), 0, d(2))
        expand.visibility = View.GONE
        expandRow = expand

        val addOne = chip("+ 标记")
        addOne.setOnClickListener {
            val (cx, cy) = AutoClickEngine.screenCenter(service)
            AutoClickEngine.addMarker(cx, cy)
            syncMarkersOnMain()
            toast("已添加标记，拖到目标位置")
            updateStatusText()
        }
        expand.addView(addOne)

        val toggleMarks = chip("隐藏标记")
        toggleMarks.setOnClickListener {
            setMarkersVisibleOnMain(!AutoClickEngine.markersVisible)
        }
        toggleMarksButton = toggleMarks
        expand.addView(toggleMarks)

        val clear = chip("清空")
        clear.setTextColor(0xFFFF8A80.toInt())
        clear.setOnClickListener {
            AutoClickEngine.clearMarkers()
            syncMarkersOnMain()
            toast("已清空标记点")
            updateStatusText()
        }
        expand.addView(clear)

        val close = chip("关闭")
        close.setOnClickListener {
            AutoClickEngine.stop()
            AutoClickEngine.floatingVisible = false
            destroyOnMain()
            AutoClickEngine.emit()
        }
        expand.addView(close)

        bar.addView(expand)

        more.setOnClickListener {
            expand.visibility =
                if (expand.visibility == View.GONE) View.VISIBLE else View.GONE
        }

        // 拖动控制条
        val drag = View.OnTouchListener { _, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    dragStartX = ev.rawX.toInt()
                    dragStartY = ev.rawY.toInt()
                    dragOriginLeft = barParams?.x ?: 0
                    dragOriginTop = barParams?.y ?: 0
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val p = barParams ?: return@OnTouchListener false
                    p.x = dragOriginLeft + (ev.rawX.toInt() - dragStartX)
                    p.y = dragOriginTop + (ev.rawY.toInt() - dragStartY)
                    try {
                        wm.updateViewLayout(bar, p)
                    } catch (_: Exception) {
                    }
                    true
                }
                else -> false
            }
        }
        grip.setOnTouchListener(drag)

        action.setOnClickListener {
            service.toggleFromOverlay()
            syncStateOnMain()
        }

        val p = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        )
        p.gravity = Gravity.TOP or Gravity.START
        p.x = d(16)
        p.y = d(120)

        barView = bar
        barParams = p
        try {
            wm.addView(bar, p)
        } catch (_: Exception) {
            barView = null
            barParams = null
        }
    }

    private var dragStartX = 0
    private var dragStartY = 0
    private var dragOriginLeft = 0
    private var dragOriginTop = 0

    private fun chip(label: String): TextView {
        val t = TextView(service)
        t.text = label
        t.setTextColor(0xDDFFFFFF.toInt())
        t.textSize = 11.5f
        t.gravity = Gravity.CENTER
        t.setPadding(d(10), d(5), d(10), d(5))
        val lp = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
        lp.rightMargin = d(6)
        t.layoutParams = lp
        t.background = rounded(d(11).toFloat(), 0x33FFFFFF, 0x22FFFFFF)
        return t
    }

    // ------------------------------------------------------------------ 工具

    private fun d(v: Int): Int = (v * density).roundToInt()

    private fun d(v: Float): Float = v * density

    private fun rounded(radius: Float, fill: Int, stroke: Int): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
            setColor(fill)
            if (stroke != 0) {
                setStroke(d(1f).roundToInt(), stroke)
            }
        }

    private fun toast(text: String) {
        android.widget.Toast.makeText(service, text, android.widget.Toast.LENGTH_SHORT).show()
    }

    // ------------------------------------------------------------------ 标记视图

    /**
     * 单个标记点：红色准星 + 序号。
     * 拖动移动，轻点显示坐标，长按删除。
     * 触摸事件由系统派发在主线程，因此这里直接操作视图是安全的。
     */
    private inner class MarkerView(
        ctx: Context,
        private val marker: AutoClickEngine.Marker,
    ) : View(ctx) {

        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = d(2f)
            color = 0xFFFF1744.toInt()
        }
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            color = 0x33FF1744
        }
        private val cross = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = d(1.5f)
            color = Color.WHITE
        }
        private val badge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            color = 0xFFFF1744.toInt()
        }
        private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = d(10f)
            textAlign = Paint.Align.CENTER
        }
        private val dragRing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = d(2f)
            color = 0xCC00E5FF.toInt()
        }

        private var dragging = false
        private var downRawX = 0f
        private var downRawY = 0f
        private var originX = 0
        private var originY = 0
        private var downAt = 0L
        private var moved = false

        init {
            isClickable = true
        }

        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            val r = width / 2f - d(6f)

            canvas.drawCircle(cx, cy, r, fill)
            canvas.drawCircle(cx, cy, r, ring)
            canvas.drawLine(cx - r * 0.5f, cy, cx + r * 0.5f, cy, cross)
            canvas.drawLine(cx, cy - r * 0.5f, cx, cy + r * 0.5f, cross)

            val idx = AutoClickEngine.markers.indexOfFirst { it.id == marker.id } + 1
            if (idx > 0) {
                val bcy = cy - r - d(9f)
                canvas.drawCircle(cx, bcy, d(8f), badge)
                canvas.drawText(idx.toString(), cx, bcy + d(3.5f), text)
            }

            if (dragging) {
                canvas.drawCircle(cx, cy, r + d(3f), dragRing)
            }
        }

        @SuppressLint("ClickableViewAccessibility")
        override fun onTouchEvent(ev: MotionEvent): Boolean {
            if (!markersInteractive) {
                return false
            }
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    dragging = true
                    moved = false
                    downRawX = ev.rawX
                    downRawY = ev.rawY
                    originX = marker.x
                    originY = marker.y
                    downAt = System.currentTimeMillis()
                    invalidate()
                    return true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = ev.rawX - downRawX
                    val dy = ev.rawY - downRawY
                    if (hypot(dx, dy) > d(3f)) {
                        moved = true
                    }
                    if (moved) {
                        marker.x = (originX + dx).roundToInt()
                        marker.y = (originY + dy).roundToInt()
                        markerWindows[marker.id]?.let { w ->
                            w.params.x = marker.x
                            w.params.y = marker.y
                            try {
                                wm.updateViewLayout(this, w.params)
                            } catch (_: Exception) {
                            }
                        }
                    }
                    return true
                }

                MotionEvent.ACTION_UP -> {
                    dragging = false
                    invalidate()
                    val held = System.currentTimeMillis() - downAt
                    when {
                        held >= 700 && !moved -> {
                            AutoClickEngine.removeMarker(marker.id)
                            removeMarkerWindowOnMain(marker.id)
                            toast("已删除标记点")
                            updateStatusText()
                        }
                        !moved -> {
                            val (w, h) = AutoClickEngine.screenSize(service)
                            toast("坐标 ${marker.x}, ${marker.y} / 屏 $w×$h")
                        }
                    }
                    performClick()
                    return true
                }

                MotionEvent.ACTION_CANCEL -> {
                    dragging = false
                    invalidate()
                    return true
                }
            }
            return super.onTouchEvent(ev)
        }
    }
}
