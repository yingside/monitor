/**
 * API 请求监控相关类型定义
 *
 * 注意：此文件名为 api-monitor.ts，区别于 api.ts（后者定义的是前端通用 HTTP 响应包装类型）。
 *
 * 与 monitor-server /monitor/apis 接口响应结构对应。
 * 数据最终来源：ClickHouse api_logs 表。
 *
 * ─── 字段与 ClickHouse 建表对应关系 ────────────────────────────────────────
 * trace_id      String        — 会话唯一标识
 * app_id        String        — 项目标识
 * user_id       String        — 用户标识
 * page          String        — 发起请求时所在页面
 * method        String        — HTTP 方法（GET / POST / PUT 等）
 * url           String        — 请求 URL
 * status        Int32         — HTTP 响应状态码
 * duration      Float64       — 请求耗时（ms）
 * request_size  Int64         — 请求体大小（bytes）
 * response_size Int64         — 响应体大小（bytes）
 * success       Bool          — 是否成功（非 4xx/5xx 且无网络错误）
 * ua            String        — User-Agent
 * created_at    DateTime      — 采集时间
 */

/** 时间范围（与其他监控页面保持一致） */
export type TimeRange = '24h' | '7d' | '30d'

/**
 * API 整体统计摘要（用于顶部统计卡片）
 *
 *  total        — 时间段内总请求数
 *  successCount — 成功请求数
 *  errorCount   — 失败请求数（4xx / 5xx / 网络错误）
 *  successRate  — 成功率（百分比，保留 2 位小数）
 *  avgDuration  — 平均耗时（ms）
 *  p95Duration  — P95 耗时（95% 的请求在此时间内完成，ms）
 */
export interface ApiSummary {
  total: number
  successCount: number
  errorCount: number
  successRate: number    // 0 ~ 100
  avgDuration: number    // ms
  p95Duration: number    // ms
}

/**
 * API 每日趋势数据点（用于折线图）
 *
 *  avgDuration — 当日所有请求的平均耗时（ms）
 *  errorRate   — 当日请求失败率（0 ~ 100 的百分比）
 */
export interface ApiTrendPoint {
  date: string         // 'YYYY-MM-DD'
  avgDuration: number  // ms
  errorRate: number    // %
}

/**
 * 慢接口数据项（按 P95 耗时降序，Top 10）
 *
 *  p95Duration — P95 耗时，代表"慢尾用户"的体验
 *  errorRate   — 该接口的整体失败率（百分比）
 */
export interface SlowApi {
  url: string
  method: string
  avgDuration: number  // ms
  p95Duration: number  // ms
  total: number        // 总调用次数
  errorRate: number    // %
}

/**
 * GET /monitor/apis/stats 响应结构
 *
 *  summary  — 整体统计摘要（用于卡片）
 *  trend    — 按天聚合的耗时/错误率趋势（用于折线图）
 *  slowApis — 按 P95 耗时排序的慢接口 Top 10（用于表格）
 */
export interface ApiMonitorStats {
  summary: ApiSummary
  trend: ApiTrendPoint[]
  slowApis: SlowApi[]
}

/**
 * 单条 API 日志（来自 ClickHouse api_logs 表）
 */
export interface ApiLog {
  trace_id: string
  app_id: string
  user_id: string
  page: string
  method: string
  url: string
  status: number
  duration: number
  request_size: number
  response_size: number
  success: boolean
  ua: string
  created_at: string
}

/** GET /monitor/apis 查询参数 */
export interface ApiQueryParams {
  appId: string
  startTime?: string   // ISO 8601
  endTime?: string     // ISO 8601
  url?: string         // URL 模糊匹配
  onlyFailed?: boolean // 只看失败请求
  page?: number
  pageSize?: number
}

/** GET /monitor/apis/stats 查询参数 */
export interface ApiStatsParams {
  appId: string
  startTime?: string
  endTime?: string
}
