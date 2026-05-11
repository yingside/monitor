// ─────────────────────────────────────────────────────────────────────────────
// 事件类型枚举
// ─────────────────────────────────────────────────────────────────────────────

/** 监控事件的四大分类，对应后续四类采集插件 */
export type EventType = 'error' | 'performance' | 'behavior' | 'api'

// ─────────────────────────────────────────────────────────────────────────────
// SDK 初始化配置
// ─────────────────────────────────────────────────────────────────────────────

/**
 * init() 时传入的用户配置
 * 所有可选项在 Monitor 内部都有明确的默认值
 */
export interface MonitorOptions {
  /** 数据上报地址（Data Source Name），由 DSN 服务分配 */
  dsn: string

  /** 项目唯一标识，用于区分不同应用的数据 */
  appId: string

  /** 用户标识（可选），用于关联错误与具体用户 */
  userId?: string

  /**
   * 采样率，范围 0-1，默认 1（全量采集）
   * 0.5 表示随机采集 50% 的事件，可在高流量场景下降低上报量
   */
  sampleRate?: number

  /**
   * 插件列表
   * 每个插件封装一类采集能力（错误采集、性能采集、行为采集等）
   */
  plugins?: Plugin[]

  /**
   * 开启调试模式（默认 false）
   * true 时会在控制台打印每条采集事件，方便本地开发验证
   */
  debug?: boolean

  /**
   * 内存队列最大长度（默认 20）
   * 超出时丢弃最旧的事件，防止在极端情况下内存无限增长
   */
  maxQueueSize?: number
}

/**
 * 经过默认值填充后的配置（Monitor 内部使用）
 * 所有字段均已确定，不存在 undefined 可选项
 */
export interface ResolvedOptions {
  dsn: string
  appId: string
  userId: string | undefined
  sampleRate: number
  plugins: Plugin[]
  debug: boolean
  maxQueueSize: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 错误采集载荷类型（第 06 章：JS 错误与资源加载错误）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JS 运行时错误的结构化数据
 *
 * 对应：window.addEventListener('error', handler, true) 捕获的同步错误
 * 包含定位问题所需的完整信息：消息 / 文件 / 行列号 / 调用栈
 */
export interface JsErrorPayload {
  /** 区分错误来源，js = 同步运行时错误 */
  subType: 'js'
  /** 错误消息（e.message） */
  message: string
  /** 发生错误的脚本文件 URL（e.filename） */
  filename: string
  /** 行号（e.lineno） */
  lineno: number
  /** 列号（e.colno） */
  colno: number
  /** 调用栈字符串（e.error?.stack），SourceMap 还原后可定位到源码 */
  stack: string
  /** Error 构造函数名称（TypeError / ReferenceError / RangeError 等） */
  errorType: string
}

/**
 * 静态资源加载失败的结构化数据
 *
 * 对应：<img> / <script> / <link> 等元素触发的 error 事件
 * 资源错误不会冒泡，必须在捕获阶段监听才能拦截
 */
export interface ResourceErrorPayload {
  /** 区分错误来源，resource = 资源加载失败 */
  subType: 'resource'
  /** 发生错误的元素标签名（IMG / SCRIPT / LINK / AUDIO / VIDEO） */
  tagName: string
  /** 加载失败的资源 URL */
  src: string
}

/**
 * Promise 未捕获异常的结构化数据
 *
 * 对应：window.addEventListener('unhandledrejection', handler)
 * 当一个 Promise 被 reject，但没有对应的 .catch() / try-catch 处理时触发。
 *
 * 典型场景：
 * - async 函数里 throw 但外层忘记 await + try-catch
 * - fetch() 失败但没有 .catch()
 */
export interface PromiseErrorPayload {
  /** 区分错误来源，promise = Promise 未捕获异常 */
  subType: 'promise'
  /** 错误消息（reason.message，若 reason 是 Error 实例；否则 String(reason)） */
  message: string
  /** 调用栈（reason.stack，若 reason 是 Error 实例；否则空字符串） */
  stack: string
  /**
   * Promise reject 时传递的原始值
   * 可能是 Error 实例、字符串、对象等任意类型
   * 这里用 unknown 表示"类型不确定，使用前需要做类型检查"
   */
  reason: unknown
}

/**
 * 框架层错误的结构化数据
 *
 * 对应：
 * - Vue 3：app.config.errorHandler（捕获所有组件内部抛出的错误）
 * - React：ErrorBoundary 组件的 componentDidCatch（捕获渲染阶段的错误）
 */
export interface FrameworkErrorPayload {
  /** 区分错误来源：vue / react */
  subType: 'vue' | 'react'
  /** 错误消息 */
  message: string
  /** 调用栈字符串 */
  stack: string
  /**
   * 组件信息（可选）
   * - Vue：组件名（vm.$options.name）或生命周期 info 字符串（如 "mounted hook"）
   * - React：组件调用栈（React.ErrorInfo.componentStack）
   */
  componentInfo?: string
}

/**
 * 错误事件的完整载荷类型（判别联合类型）
 *
 * capture('error', payload) 中 payload 的实际类型。
 * 通过 subType 字段区分来源，TypeScript 可根据 subType 的值
 * 自动缩窄（narrow）到对应的具体类型。
 *
 * 扩展历史：
 * - JsErrorPayload         → 同步运行时错误（window error 事件）
 * - ResourceErrorPayload   → 资源加载失败（img/script/link error 事件）
 * - PromiseErrorPayload    → Promise 未捕获异常（unhandledrejection 事件）
 * - FrameworkErrorPayload  → 框架层错误（Vue errorHandler / React ErrorBoundary）
 */
export type ErrorPayload =
  | JsErrorPayload
  | ResourceErrorPayload
  | PromiseErrorPayload
  | FrameworkErrorPayload

// ─────────────────────────────────────────────────────────────────────────────
// 监控事件数据结构
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 一条标准监控事件（Pipeline 中流转的基本单位）
 *
 * 无论是 JS 错误、性能指标还是用户行为，上报时都会被封装成这个统一结构。
 * 这样后端只需要一个接口就能接收所有类型的数据。
 */
export interface MonitorEvent {
  /** 会话 ID：同一次页面访问（从打开到关闭）共享同一个 traceId */
  traceId: string

  /** 项目标识，来自 MonitorOptions.appId */
  appId: string

  /** 用户标识，来自 MonitorOptions.userId */
  userId?: string

  /** 事件类型：error / performance / behavior / api */
  type: EventType

  /** 事件的具体内容，由各插件填充，类型由各章节逐步定义 */
  payload: unknown

  /** 事件发生的时间戳（毫秒级 Unix 时间） */
  timestamp: number

  /** 事件发生时的页面 URL */
  page: string

  /** 采集时的 User-Agent */
  ua: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 插件接口
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 插件接口——所有采集能力的统一契约
 *
 * 每个插件封装一类采集逻辑：
 * - 错误采集插件（第 06 章）
 * - 性能采集插件（第 08 章）
 * - 行为采集插件（第 09 章）
 * - API 监控插件（第 10 章）
 *
 * 插件只通过 MonitorInstance 接口与 Monitor 通信，
 * 不能直接访问 Monitor 的私有状态。
 */
export interface Plugin {
  /** 插件唯一名称，用于防止重复注册 */
  name: string

  /**
   * 插件初始化入口
   * 在这里监听事件、注册观察者、绑定全局钩子
   * @param monitor 受限的 Monitor 公共接口，插件通过 monitor.capture() 上报数据
   */
  setup(monitor: MonitorInstance): void

  /**
   * 插件销毁（可选）
   * 在 monitor.destroy() 时调用，用于清理事件监听、释放资源
   */
  teardown?(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Monitor 公共接口（暴露给插件和外部使用者）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MonitorInstance 是插件能看到的 Monitor "公共视图"
 *
 * 设计原则：插件只能拿到 capture() 和只读的 options，
 * 不能拿到内部队列、不能直接触发 flush、不能修改配置。
 * 这是"最小权限原则"在架构上的体现。
 */
export interface MonitorInstance {
  /** 当前生效的配置（只读） */
  readonly options: Readonly<ResolvedOptions>

  /**
   * 采集一条事件，进入数据管道
   * @param type 事件类型
   * @param payload 事件具体内容
   */
  capture(type: EventType, payload: unknown): void
}
