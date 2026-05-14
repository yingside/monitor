/**
 * 监控事件 Payload 类型定义
 *
 * 这些类型描述了从 Kafka 消息中反序列化出来的数据结构，
 * 与 SDK 端 packages/core/src/types.ts 中的类型定义完全对应。
 *
 * 为什么在 consumer-server 中重新定义而不是直接引用 @monitor/core？
 *   - consumer-server 是纯 Node.js 后端服务，理论上不应依赖 SDK 包
 *   - SDK 包的某些类型依赖浏览器 API（如 PerformanceEntry），后端无法使用
 *   - 这里只提取 Consumer 需要用到的字段，保持后端代码的独立性
 */

// =============================================================================
// 公共结构：MonitorEvent（每条 Kafka 消息的外层包装）
// =============================================================================

/**
 * 从 Kafka 消费到的监控事件（对应 SDK 的 MonitorEvent）
 *
 * dsn-server 接收 SDK 上报后，直接将整个 ReportEventDto 序列化为 JSON 写入 Kafka。
 * Consumer 这里反序列化后得到的就是这个结构。
 */
export interface MonitorEventMessage {
  traceId: string
  appId: string
  userId?: string
  type: 'error' | 'performance' | 'behavior' | 'api'
  payload: unknown   // 具体类型由 type 决定，各 Handler 负责做类型收窄
  timestamp: number  // 客户端时间戳（毫秒）
  page: string
  ua: string
}

// =============================================================================
// 错误事件 Payload（type = 'error'）
// =============================================================================

/** JS 运行时错误（window error 事件捕获） */
export interface JsErrorPayload {
  subType: 'js'
  message: string
  filename: string
  lineno: number
  colno: number
  stack: string
  errorType: string  // TypeError / ReferenceError 等
}

/** 静态资源加载失败（img / script / link error 事件） */
export interface ResourceErrorPayload {
  subType: 'resource'
  tagName: string    // IMG / SCRIPT / LINK ...
  src: string        // 加载失败的资源 URL
}

/** Promise 未捕获异常（unhandledrejection 事件） */
export interface PromiseErrorPayload {
  subType: 'promise'
  message: string
  stack: string
  reason: unknown
}

/** Vue / React 框架层错误（errorHandler / ErrorBoundary） */
export interface FrameworkErrorPayload {
  subType: 'vue' | 'react'
  message: string
  stack: string
  componentInfo?: string
}

export type ErrorPayload =
  | JsErrorPayload
  | ResourceErrorPayload
  | PromiseErrorPayload
  | FrameworkErrorPayload

// =============================================================================
// 性能事件 Payload（type = 'performance'）
// =============================================================================

/**
 * Core Web Vitals 单项指标（每条事件只包含一个指标）
 *
 * SDK 通过 web-vitals 库异步采集，每个指标就绪后单独上报。
 * FID 已废弃，SDK 改用 INP（Interaction to Next Paint），
 * Consumer 将 INP 映射到 ClickHouse 的 fid 列（兼容旧字段名）。
 */
export interface WebVitalPayload {
  subType: 'web-vital'
  metric: 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string
}

/** 页面导航时序（基于 PerformanceNavigationTiming API） */
export interface NavigationTimingPayload {
  subType: 'navigation-timing'
  dns: number
  tcp: number
  ssl: number
  ttfb: number
  download: number
  domInteractive: number
  domComplete: number
  loadTime: number
}

export type PerformancePayload = WebVitalPayload | NavigationTimingPayload

// =============================================================================
// 用户行为 Payload（type = 'behavior'）
// =============================================================================

/** PV（页面浏览）事件 */
export interface PVPayload {
  subType: 'pv'
  page: string
  referrer: string
}

/** 点击行为事件 */
export interface ClickPayload {
  subType: 'click'
  elementPath: string   // CSS 选择器路径
  elementText: string   // 元素可读文本
  page: string
}

/** SPA 路由跳转事件 */
export interface RouteChangePayload {
  subType: 'route-change'
  from: string
  to: string
}

/** 自定义埋点事件 */
export interface CustomPayload {
  subType: 'custom'
  name: string
  extra?: Record<string, unknown>
}

export type BehaviorPayload = PVPayload | ClickPayload | RouteChangePayload | CustomPayload

// =============================================================================
// API 请求 Payload（type = 'api'）
// =============================================================================

/** XHR / Fetch 请求监控数据 */
export interface ApiPayload {
  subType: 'xhr' | 'fetch'
  method: string
  url: string
  status: number
  duration: number
  success: boolean
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 将毫秒时间戳转换为 ClickHouse DateTime 接受的字符串格式
 *
 * ClickHouse DateTime 使用 UTC 时间，格式：'YYYY-MM-DD HH:MM:SS'
 *
 * 示例：
 *   1715000000000 → '2024-05-06 19:33:20'
 */
export function toClickHouseDateTime(timestampMs: number): string {
  return new Date(timestampMs)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19)  // 截掉毫秒和 'Z'
}
