import type {
  EventType,
  MonitorEvent,
  MonitorInstance,
  MonitorOptions,
  Plugin,
  ResolvedOptions,
} from './types'

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

  // 等待上报的事件队列（HTTP 上报实现前，这里是内存缓冲区）
  private queue: MonitorEvent[] = []

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
   *   [3] 写入队列 → 推入内存缓冲区，超出上限时丢弃最旧的
   *       ↓
   *   [4] flush    → 触发上报（debug 模式下打印日志，后续接入 HTTP 上报时将完善）
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

    // [3] 写入队列
    this.queue.push(event)
    // 超出上限时丢弃最旧的，防止内存无限增长
    if (this.queue.length > this.options.maxQueueSize) {
      this.queue.shift()
    }

    // [4] 触发上报
    this._flush()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 上报实现（待 HTTP 上报）
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 将队列中的事件批量上报
   *
   * 待实现（HTTP 上报接入后）：
   *   - 常规上报：fetch POST → DSN 服务
   *   - 页面卸载时：Navigator.sendBeacon（更可靠，浏览器保证页面关闭前发出）
   *   - 上报成功后清空队列
   *
   * 当前：debug 模式下打印日志，验证数据流转正确
   */
  private _flush(): void {
    if (this.queue.length === 0) return

    if (this.options.debug) {
      console.log(
        `[Monitor] flush | ${this.queue.length} event(s) pending upload to ${this.options.dsn}`,
        [...this.queue],
      )
    }

    // TODO: 接入 Transport 层，实现真正的 HTTP 上报
    // await transport.send(this.queue)
    // this.queue = []
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 销毁
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 销毁 Monitor 实例
   *
   * 调用每个插件的 teardown()，清理事件监听、取消定时器等资源，
   * 防止内存泄漏。SPA 应用切换项目时可能需要调用。
   */
  destroy(): void {
    for (const plugin of this.plugins) {
      plugin.teardown?.()
    }
    this.plugins.length = 0
    this.queue = []
    this.initialized = false

    if (this.options.debug) {
      console.log(`[Monitor] destroyed | appId=${this.options.appId}`)
    }
  }
}
