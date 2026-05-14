import type {
  EventType,
  MonitorEvent,
  MonitorInstance,
  MonitorOptions,
  Plugin,
  ResolvedOptions,
} from './types'
import { Transport } from './transport'

// ─────────────────────────────────────────────────────────────────────────────
// 内部工具：会话 ID 生成
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 生成一个 UUID v4 格式的随机会话 ID
 *
 * core 包不依赖 browser-utils，所以在此内联一份最小实现。
 * browser-utils 包导出的 generateUUID() 是对外暴露的"官方版本"，
 * 两者实现完全相同，分开存放是为了保持依赖方向清晰：
 *   core → 不依赖任何内部包
 *   browser-utils → 不依赖任何内部包
 *   browser → 依赖 core + browser-utils
 */
function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────────────────────────────────────

/**
 * init() 未传入的可选项使用以下默认值
 * satisfies 确保这里列出的字段类型与 ResolvedOptions 的对应字段完全匹配
 */
const DEFAULT_OPTIONS = {
  userId: undefined,
  sampleRate: 1,
  plugins: [] as Plugin[],
  debug: false,
  maxQueueSize: 20,
  // 第 11 章新增：上报策略默认值
  flushInterval: 5000,   // 5 秒定时刷新
  maxBatchSize: 10,      // 每批最多 10 条
} satisfies Omit<ResolvedOptions, 'dsn' | 'appId'>

// ─────────────────────────────────────────────────────────────────────────────
// Monitor 核心类
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Monitor 是整个 SDK 的大脑
 *
 * 职责：
 * 1. 持有用户配置（options）
 * 2. 维护插件注册表（plugins）
 * 3. 驱动数据管道（capture → 采样 → 规范化 → 队列 → flush）
 * 4. 对外暴露 MonitorInstance 接口给插件使用
 *
 * 注意：Monitor 不应被外部直接 new，应通过 @monitor/browser 的 init() 创建单例。
 */
export class Monitor implements MonitorInstance {
  // 经过默认值填充的最终配置
  readonly options: Readonly<ResolvedOptions>

  // 本次页面访问的会话 ID（一次 init 到 destroy 共享同一个 traceId）
  private readonly traceId: string

  // 已注册的插件列表
  private readonly plugins: Plugin[] = []

  /**
   * 上报层（第 11 章接入）
   *
   * 在 init() 之后创建，负责批量上报、定时刷新、页面卸载可靠上报。
   * init() 之前 capture() 触发的事件（正常不会发生，但作为防御性设计）
   * 会先缓存在 preInitQueue 中，init() 完成后统一转交给 Transport。
   */
  private _transport: Transport | null = null

  /**
   * 初始化前的临时缓冲队列
   *
   * 理论上插件的 capture() 调用只在 init() 之后发生，
   * 但为了防御性设计，保留此安全缓冲。
   */
  private preInitQueue: MonitorEvent[] = []

  // 防止重复初始化的标志
  private initialized = false

  constructor(options: MonitorOptions) {
    // 合并用户配置与默认值，得到完整的 ResolvedOptions
    this.options = Object.freeze({
      ...DEFAULT_OPTIONS,
      ...options,
      // plugins 单独处理：用户若未传则使用空数组，不能 spread 覆盖 DEFAULT_OPTIONS.plugins
      plugins: options.plugins ?? [],
    })
    this.traceId = generateSessionId()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 启动所有已配置的插件
   *
   * 设计决策：为什么把"注册插件"和"启动插件"分两步？
   *
   * 如果在构造函数里直接 setup()，插件里调用 monitor.capture() 时
   * Monitor 实例还没完全构建好（this 还未赋值给外部变量），
   * 可能引发时序问题。
   * 把 init() 单独暴露，让调用者控制"什么时候真正启动"，更安全。
   */
  init(): void {
    if (this.initialized) return
    this.initialized = true

    // ── 第 11 章：创建 Transport 实例 ────────────────────────────────────
    // Transport 在这里创建，而不是构造函数里，原因：
    // Transport 一旦创建就会启动定时器和页面生命周期监听，
    // 如果构造函数里创建但用户忘记调用 init()，这些定时器就会悄悄跑着浪费资源。
    // 放在 init() 里，保证"只有真正启动时，才开始计时上报"。
    this._transport = new Transport({
      dsn: this.options.dsn,
      flushInterval: this.options.flushInterval,
      maxBatchSize: this.options.maxBatchSize,
      debug: this.options.debug,
    })

    // 将 init() 之前意外缓存的事件转交给 Transport
    for (const event of this.preInitQueue) {
      this._transport.enqueue(event)
    }
    this.preInitQueue = []

    for (const plugin of this.options.plugins) {
      this._registerPlugin(plugin)
    }

    if (this.options.debug) {
      console.log(
        `[Monitor] initialized | appId=${this.options.appId} | traceId=${this.traceId} | plugins=${this.plugins.map((p) => p.name).join(', ') || 'none'}`,
      )
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 插件管理
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 动态注册一个插件（init() 之后也可以调用）
   *
   * 使用场景：在某个用户交互后才按需加载的插件（懒加载）
   */
  use(plugin: Plugin): this {
    this._registerPlugin(plugin)
    return this
  }

  private _registerPlugin(plugin: Plugin): void {
    // 防止同名插件重复注册
    if (this.plugins.some((p) => p.name === plugin.name)) {
      if (this.options.debug) {
        console.warn(`[Monitor] Plugin "${plugin.name}" is already registered, skipping.`)
      }
      return
    }
    this.plugins.push(plugin)
    // 调用插件的 setup()，传入受限的 MonitorInstance 接口
    // 插件只能通过这个接口与 Monitor 通信，不能访问私有状态
    plugin.setup(this)

    if (this.options.debug) {
      console.log(`[Monitor] Plugin "${plugin.name}" registered.`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 数据管道：采集 → 处理 → 缓冲 → 上报
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 数据管道入口：采集一条事件
   *
   * 完整的数据流转过程：
   *
   *   Plugin 调用 monitor.capture('error', payload)
   *       ↓
   *   [1] 采样过滤 → 按 sampleRate 随机丢弃
   *       ↓
   *   [2] 规范化   → 封装为统一的 MonitorEvent 结构
   *       ↓
   *   [3] 交给 Transport → 进入批量队列，等待定时/满批上报
   *
   * 第 11 章变更：
   *   之前 [3] 是 push 到 Monitor.queue（内存缓冲 TODO）
   *   现在 [3] 是 Transport.enqueue()（真正的上报队列）
   */
  capture(type: EventType, payload: unknown): void {
    // [1] 采样过滤
    if (Math.random() > this.options.sampleRate) return

    // [2] 规范化：封装成统一的 MonitorEvent
    const event: MonitorEvent = {
      traceId: this.traceId,
      appId: this.options.appId,
      userId: this.options.userId,
      type,
      payload,
      timestamp: Date.now(),
      // 安全访问浏览器 API（core 本身不绑定浏览器环境，保留 SSR 兼容性）
      page: typeof location !== 'undefined' ? location.href : '',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    }

    // debug 模式下立即打印（方便本地开发验证采集结果）
    if (this.options.debug) {
      console.log(`[Monitor] capture | type=${type}`, event)
    }

    // [3] 交给 Transport 处理（或放入预初始化缓冲）
    if (this._transport) {
      this._transport.enqueue(event)
    } else {
      // Transport 尚未初始化（init() 还没被调用）
      // 暂存到 preInitQueue，init() 完成后会统一转交
      this.preInitQueue.push(event)
      if (this.preInitQueue.length > this.options.maxQueueSize) {
        this.preInitQueue.shift()
      }
    }
  }

  /**
   * 手动触发立即上报（第 11 章新增对外接口）
   *
   * 通常不需要调用，Transport 会自动定时上报。
   * 特殊场景下（如用户登出、关键节点打点后希望立刻发出）可手动调用。
   */
  flush(): void {
    this._transport?.flush()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 销毁
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 销毁 Monitor 实例
   *
   * 调用每个插件的 teardown()，清理事件监听、取消定时器等资源。
   * 同时销毁 Transport，触发最后一次 sendBeacon 上报。
   * SPA 应用切换项目时可能需要调用。
   */
  destroy(): void {
    for (const plugin of this.plugins) {
      plugin.teardown?.()
    }
    this.plugins.length = 0

    // 销毁 Transport（内部会 sendBeacon 最后一批数据）
    this._transport?.destroy()
    this._transport = null

    this.preInitQueue = []
    this.initialized = false

    if (this.options.debug) {
      console.log(`[Monitor] destroyed | appId=${this.options.appId}`)
    }
  }
}
