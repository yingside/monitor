// 职责：创建 Monitor 单例，暴露对外 API；聚合所有采集插件的对外导出

import { Monitor } from '@monitor/core'
import type { EventType, MonitorOptions, Plugin } from '@monitor/core'

// 重导出常用类型，让接入方不需要直接依赖 @monitor/core
export type { MonitorOptions, Plugin, EventType } from '@monitor/core'
export type {
  JsErrorPayload,
  ResourceErrorPayload,
  PromiseErrorPayload,
  FrameworkErrorPayload,
  ErrorPayload,
} from '@monitor/core'
export { MONITOR_VERSION } from '@monitor/core'

// ─────────────────────────────────────────────────────────────────────────────
// 采集插件（按需引入，只注册实际需要的插件）
// ─────────────────────────────────────────────────────────────────────────────

// 第 06 章：JS 错误 & 资源加载错误采集插件
export { createErrorPlugin } from './plugins/error'
export type { ErrorPluginOptions } from './plugins/error'

// ─────────────────────────────────────────────────────────────────────────────
// 单例
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 内部持有的 Monitor 单例
 *
 * 为什么用单例？
 * 整个应用里只有一个监控实例，共享 traceId（会话 ID）和已注册的插件列表。
 * 如果允许多实例，同一个页面就会有多个独立的事件队列，traceId 不同，
 * 后端无法将同一次会话的数据关联起来。
 */
let _monitor: Monitor | null = null

// ─────────────────────────────────────────────────────────────────────────────
// 对外 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 初始化监控 SDK
 *
 * 应在应用最入口处调用一次（main.ts / main.tsx），
 * 早于任何业务代码，确保插件能捕获到页面最早期的事件。
 *
 * @param options 初始化配置
 * @returns Monitor 实例（通常不需要保存返回值，通过 getMonitor() 可随时获取）
 *
 * @example
 * ```ts
 * import { init } from '@monitor/browser'
 *
 * init({
 *   dsn: 'http://localhost:3001/collect',
 *   appId: 'my-app',
 *   debug: true,
 * })
 * ```
 */
export function init(options: MonitorOptions): Monitor {
  if (_monitor) {
    if (options.debug) {
      console.warn('[Monitor] SDK is already initialized. Duplicate init() call ignored.')
    }
    return _monitor
  }

  _monitor = new Monitor(options)
  _monitor.init()
  return _monitor
}

/**
 * 获取当前 Monitor 实例
 *
 * 主要供插件内部和框架适配层（@monitor/vue、@monitor/react）使用。
 * 业务代码通常不需要直接拿到实例。
 */
export function getMonitor(): Monitor | null {
  return _monitor
}

/**
 * 手动上报一条事件
 *
 * 用于代码埋点（custom event），在 init() 之后任意位置调用。
 * 如果 SDK 尚未初始化，会静默忽略。
 *
 * @example
 * ```ts
 * import { capture } from '@monitor/browser'
 *
 * // 用户点击购买按钮时，手动埋点
 * capture('behavior', { action: 'click', target: 'buy-button', productId: '123' })
 * ```
 */
export function capture(type: EventType, payload: unknown): void {
  _monitor?.capture(type, payload)
}

/**
 * 动态注册一个插件（init() 之后也可以调用）
 *
 * 用于懒加载场景：某些页面才需要某类采集能力，可按需注册，
 * 不需要在 init() 时一次性传入所有插件。
 */
export function use(plugin: Plugin): void {
  _monitor?.use(plugin)
}

/**
 * 销毁 SDK 实例
 *
 * 会调用每个插件的 teardown()，清理事件监听、计时器等资源。
 * SPA 应用在切换租户/项目时如需重新初始化，先调用 destroy() 再调用 init()。
 */
export function destroy(): void {
  _monitor?.destroy()
  _monitor = null
}

