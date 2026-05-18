/**
 * 错误监控相关类型定义
 *
 * 与 monitor-server /monitor/errors 接口响应结构对应。
 * 数据最终来源：ClickHouse error_logs 表。
 */

/**
 * 错误类型枚举（与 SDK 上报 / ClickHouse error_logs.error_type 字段保持一致）
 * 注意：带 _error 后缀，与前端自定义的短名称不同
 */
export type ErrorType = 'js_error' | 'resource_error' | 'promise_error' | 'framework_error'

/**
 * 单条错误日志（来自 ClickHouse error_logs 表）
 *
 * 字段含义：
 *  trace_id   — 会话唯一标识（由 SDK 生成，用于关联同一次会话内的所有事件）
 *  app_id     — 项目标识（对应 monitor-server projects.appId）
 *  user_id    — 业务用户 ID（SDK 配置的 userId，匿名时为空字符串）
 *  page       — 错误发生时的页面 URL
 *  error_type — 错误类型：js_error / resource_error / promise_error / framework_error
 *  message    — 错误消息字符串
 *  stack      — 错误堆栈（原始字符串，生产环境通常需要 SourceMap 还原）
 *  filename   — 触发错误的脚本文件名
 *  lineno     — 触发错误的行号
 *  colno      — 触发错误的列号
 *  ua         — User-Agent 字符串
 *  created_at — ClickHouse 写入时间（ISO 8601 格式）
 */
export interface ErrorLog {
  trace_id: string
  app_id: string
  user_id: string
  page: string
  error_type: ErrorType | string
  message: string
  stack: string
  filename: string
  lineno: number
  colno: number
  ua: string
  created_at: string
}

/**
 * 错误趋势数据点（按天聚合）
 *
 * 用于折线图的 X/Y 轴数据：
 *  date  — 日期字符串（'YYYY-MM-DD'）
 *  count — 当日错误总数
 */
export interface ErrorTrendPoint {
  date: string
  count: number
}

/** 错误类型分布（类型 → 数量）*/
export interface ErrorTypeItem {
  errorType: ErrorType | string
  count: number
}

/** TOP 10 高频错误（按 message 聚合）*/
export interface TopErrorItem {
  message: string
  errorType: ErrorType | string
  count: number
}

/**
 * 错误统计汇总（GET /monitor/errors/stats 响应）
 *
 *  trend            — 每日错误数趋势（用于折线图）
 *  typeDistribution — 各错误类型数量分布（用于统计卡片）
 *  topErrors        — 出现次数最多的前 10 条错误（用于高频错误表格）
 */
export interface ErrorStats {
  trend: ErrorTrendPoint[]
  typeDistribution: ErrorTypeItem[]
  topErrors: TopErrorItem[]
}

/** 错误列表查询参数（GET /monitor/errors）*/
export interface ErrorQueryParams {
  appId: string
  startTime?: string   // ISO 8601
  endTime?: string     // ISO 8601
  errorType?: string   // 不传则查全部类型
  page?: number
  pageSize?: number
}

/** 基础统计查询参数（GET /monitor/errors/stats）*/
export interface BaseMonitorQueryParams {
  appId: string
  startTime?: string   // ISO 8601
  endTime?: string     // ISO 8601
}

/**
 * 时间范围快捷选项
 *
 *  '24h' — 最近 24 小时
 *  '7d'  — 最近 7 天
 *  '30d' — 最近 30 天
 */
export type TimeRange = '24h' | '7d' | '30d'
