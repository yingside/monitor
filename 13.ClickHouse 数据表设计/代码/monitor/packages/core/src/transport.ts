// ─────────────────────────────────────────────────────────────────────────────
// Transport：SDK 上报层
//
// 职责：
//   1. 维护内存缓冲队列（批量聚合，减少 HTTP 请求次数）
//   2. 定时刷新（flushInterval），周期性批量上报
//   3. 满批立发（maxBatchSize），防止突发事件撑满内存
//   4. 页面卸载可靠上报（navigator.sendBeacon），保证关页前数据不丢
//
// 上报方式对比：
//   ┌──────────────────┬──────────────────────┬──────────────────────────┐
//   │                  │ fetch POST           │ navigator.sendBeacon     │
//   ├──────────────────┼──────────────────────┼──────────────────────────┤
//   │ 使用场景         │ 正常操作期间定时上报  │ 页面关闭 / 切换后台时    │
//   │ 页面关闭后能否发 │ 不保证（可能被取消） │ 浏览器保证发出           │
//   │ 能否获取响应     │ 能                   │ 不能                     │
//   │ body 大小限制   │ 无明确限制           │ 通常 64KB                │
//   │ Content-Type    │ 自由设定             │ 需要 Blob 绕过限制       │
//   └──────────────────┴──────────────────────┴──────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

import type { MonitorEvent } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Transport 配置
// ─────────────────────────────────────────────────────────────────────────────

/** Transport 内部配置（从 ResolvedOptions 中提取传入） */
export interface TransportConfig {
  /** DSN 数据上报地址 */
  dsn: string
  /** 定时刷新间隔（ms） */
  flushInterval: number
  /** 每批最多发送的事件数量 */
  maxBatchSize: number
  /** 是否打印调试日志 */
  debug: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Transport 核心类
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transport 是 SDK 与后端之间的"数据快递员"
 *
 * 架构思考：为什么要把上报逻辑单独抽一个类，而不是放在 Monitor 里？
 *
 * 1. 单一职责：Monitor 管采集 + 插件，Transport 管上报；各自独立变化
 * 2. 可替换：未来想换成 WebSocket / 信标上报策略，只换 Transport，Monitor 不动
 * 3. 可测试：Transport 可以单独 mock，不需要启动完整 Monitor
 *
 * 参考：Sentry 里这一层叫 "BaseTransport"，我们的命名和设计思路一致。
 */
export class Transport {
  private readonly config: TransportConfig

  /**
   * 内存缓冲队列
   *
   * 采集到的事件先进入这里，不会立刻发出。等待：
   * a) 定时器触发（到了 flushInterval）
   * b) 队列满了（达到 maxBatchSize）
   * c) 页面即将关闭（sendBeacon）
   * d) 手动调用 flush()
   */
  private queue: MonitorEvent[] = []

  /** 定时器 ID，用于周期性批量上报 */
  private timer: ReturnType<typeof setInterval> | null = null

  // 保存监听函数引用，保证 removeEventListener 能精确移除
  private readonly _onVisibilityChange: () => void
  private readonly _onBeforeUnload: () => void

  constructor(config: TransportConfig) {
    this.config = config

    this._onVisibilityChange = () => {
      // 用户切换到其他标签页 / 按下 Home 键进入后台 → document.hidden
      // 此时页面可能随时被系统回收，用 sendBeacon 保险地把队列数据发出去
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this._sendBeacon()
      }
    }

    this._onBeforeUnload = () => {
      // 用户关闭标签页 / 刷新 / 跳转到外部链接 → 触发 beforeunload
      // 普通 fetch 此时会被浏览器取消，sendBeacon 是唯一可靠的上报方式
      this._sendBeacon()
    }

    this._startTimer()
    this._bindPageLifecycle()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 公共接口
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 将一条采集事件加入队列
   *
   * 若队列长度达到 maxBatchSize，立即触发 fetch 上报（不等定时器）。
   * 这是"满了就发"策略，防止突发大量事件时队列无限膨胀。
   */
  enqueue(event: MonitorEvent): void {
    this.queue.push(event)

    if (this.config.debug) {
      console.log(
        `[Monitor] Transport: enqueued | type=${event.type}`,
        `| queue=${this.queue.length}/${this.config.maxBatchSize}`,
      )
    }

    // 满批立发：达到批量上限时不等定时器
    if (this.queue.length >= this.config.maxBatchSize) {
      this._sendFetch()
    }
  }

  /**
   * 手动触发立即上报（把当前队列里的所有事件发出去）
   *
   * 使用场景：
   * - 用户点击"立即上报"按钮（演示 / 调试）
   * - 用户登出时，强制刷新队列防止数据丢失
   */
  flush(): void {
    this._sendFetch()
  }

  /**
   * 销毁 Transport
   *
   * 停止定时器、移除页面生命周期监听，并尝试用 sendBeacon 发送剩余数据。
   * 应在 Monitor.destroy() 中调用。
   */
  destroy(): void {
    this._stopTimer()
    this._unbindPageLifecycle()
    // 最后尝试发一次，不保证一定成功
    this._sendBeacon()
    this.queue = []
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 内部实现
  // ─────────────────────────────────────────────────────────────────────────

  private _startTimer(): void {
    // SSR / Node.js 环境（无 setInterval）直接跳过
    if (typeof setInterval === 'undefined') return
    this.timer = setInterval(() => {
      this._sendFetch()
    }, this.config.flushInterval)
  }

  private _stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private _bindPageLifecycle(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._onBeforeUnload)
    }
  }

  private _unbindPageLifecycle(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._onBeforeUnload)
    }
  }

  /**
   * 常规批量上报：fetch POST
   *
   * 为什么加 keepalive: true？
   * 当用户关闭页面时，普通 fetch 会被浏览器中断（"page is being unloaded"）。
   * keepalive 选项告诉浏览器"这个请求很重要，即使页面关闭也要发出去"。
   * 注意：keepalive 有 64KB 的 body 限制，超出时浏览器会忽略 keepalive 标志。
   * 因此我们在这里优先用 fetch，页面卸载时改用 sendBeacon 更可靠。
   */
  private _sendFetch(): void {
    if (this.queue.length === 0) return

    // splice(0, maxBatchSize)：取出最多 maxBatchSize 条（修改原数组）
    // 剩余的事件留在队列，等待下次定时器
    const batch = this.queue.splice(0, this.config.maxBatchSize)

    if (this.config.debug) {
      console.log(
        `[Monitor] Transport: fetch POST → ${this.config.dsn}`,
        `| batch=${batch.length} event(s)`,
        batch,
      )
    }

    fetch(this.config.dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify(batch),
    }).catch((err: unknown) => {
      // 上报失败：简单策略 → 直接丢弃，不重试
      //
      // 生产级策略（本课程预留，第 11 章扩展说明）：
      //   1. 将失败的 batch 写入 IndexedDB
      //   2. 下次 SDK 初始化时读取并重试
      //   这样即使在离线状态也不会丢失数据
      if (this.config.debug) {
        console.error('[Monitor] Transport: fetch failed, batch discarded', err)
      }
    })
  }

  /**
   * 页面卸载可靠上报：navigator.sendBeacon
   *
   * sendBeacon 的核心价值：
   * 浏览器规范保证，即使页面已经卸载（unload），sendBeacon 发出的请求也会
   * 在后台完成，不会被取消。这解决了前端监控最头疼的问题：
   * "用户关页面的那一刻，最后一批数据能不能到达服务器？"
   *
   * 为什么用 Blob 而不是直接传字符串？
   * sendBeacon(url, data) 的 data 如果是字符串，Content-Type 会被设为
   * 'text/plain;charset=UTF-8'，后端解析起来麻烦。
   * 用 new Blob([json], { type: 'application/json' }) 可以强制指定 Content-Type，
   * 让后端能直接用 JSON 解析器处理。
   */
  private _sendBeacon(): void {
    if (this.queue.length === 0) return

    // 注意：这里取出全部队列（不像 _sendFetch 按批次取）
    // 因为 sendBeacon 是"最后一搏"，要尽量把剩余数据全发出去
    const batch = [...this.queue]
    this.queue = []

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' })
      const queued = navigator.sendBeacon(this.config.dsn, blob)

      if (this.config.debug) {
        console.log(
          `[Monitor] Transport: sendBeacon → ${this.config.dsn}`,
          `| batch=${batch.length} event(s) | queued=${queued}`,
        )
      }

      // queued=false 表示浏览器拒绝了请求（通常是 body 超出 64KB 限制）
      // 此时尝试降级到 fetch
      if (!queued) {
        if (this.config.debug) {
          console.warn('[Monitor] Transport: sendBeacon rejected (body too large?), falling back to fetch')
        }
        this._fallbackFetch(batch)
      }
      return
    }

    // sendBeacon 不可用（极少数浏览器）→ 降级到 fetch + keepalive
    if (this.config.debug) {
      console.warn('[Monitor] Transport: sendBeacon unavailable, falling back to fetch + keepalive')
    }
    this._fallbackFetch(batch)
  }

  /**
   * sendBeacon 不可用时的降级方案
   *
   * 使用 fetch + keepalive: true，尽力保证请求能发出去。
   * 不如 sendBeacon 可靠，但聊胜于无。
   */
  private _fallbackFetch(batch: MonitorEvent[]): void {
    fetch(this.config.dsn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify(batch),
    }).catch((err: unknown) => {
      if (this.config.debug) {
        console.error('[Monitor] Transport: fallback fetch also failed, data lost', err)
      }
    })
  }
}
