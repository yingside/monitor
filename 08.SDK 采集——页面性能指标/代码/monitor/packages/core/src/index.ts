// 导出 Monitor 核心类
export { Monitor } from './monitor'

// 导出所有公共类型（插件开发者和框架适配层需要）
export type {
  EventType,
  MonitorOptions,
  MonitorEvent,
  MonitorInstance,
  Plugin,
  ResolvedOptions,
  // 错误采集载荷类型
  JsErrorPayload,
  ResourceErrorPayload,
  PromiseErrorPayload,
  FrameworkErrorPayload,
  ErrorPayload,
  // 性能采集载荷类型（第 08 章新增）
  PerformanceMetricPayload,
  NavigationTimingPayload,
  PerformancePayload,
} from './types'

export const MONITOR_VERSION = '0.1.0'