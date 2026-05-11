// 第 05 章：core 包完整实现

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
} from './types'

export const MONITOR_VERSION = '0.1.0'