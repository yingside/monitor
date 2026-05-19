/**
 * 性能监控相关类型定义
 *
 * 与 monitor-server /monitor/performance 接口响应结构对应。
 * 数据最终来源：ClickHouse performance_logs 表。
 *
 * ─── 字段与 ClickHouse 建表对应关系 ────────────────────────────────────────
 * fcp        Float64  — First Contentful Paint（ms）
 * lcp        Float64  — Largest Contentful Paint（ms）
 * fid        Float64  — First Input Delay（ms）
 * cls        Float64  — Cumulative Layout Shift（无单位，越小越好）
 * ttfb       Float64  — Time to First Byte（ms）
 * load_time  Float64  — 页面完整加载耗时（ms）
 */

/** 时间范围（与错误监控保持一致） */
export type TimeRange = '24h' | '7d' | '30d'

/**
 * Web Vitals 指标评级
 *
 * 根据 Google Core Web Vitals 官方阈值划分三档：
 *  good              — 指标值达到推荐标准（绿色）
 *  needs-improvement — 需要改进（黄色）
 *  poor              — 表现较差，影响用户体验（红色）
 */
export type VitalRating = 'good' | 'needs-improvement' | 'poor'

/**
 * 各指标的 P50 / P75 / P95 分位数
 *
 * 白话：把所有用户的指标值从小到大排序，
 *  P50 = 中位数（一半用户比这个快），
 *  P75 = 75% 的用户比这个快（代表"大多数用户"体验），
 *  P95 = 95% 的用户比这个快（代表"尾部用户"体验，最差的 5%）。
 *
 * Google 推荐以 P75 为目标衡量标准。
 */
export interface MetricQuantile {
  p50: number
  p75: number
  p95: number
}

/**
 * 关键指标的分位数汇总
 * （FID 通常分布极小，不在分位数图中单独展示；CLS 无单位，展示方式不同）
 */
export interface PerformanceQuantiles {
  fcp: MetricQuantile
  lcp: MetricQuantile
  ttfb: MetricQuantile
  loadTime: MetricQuantile
}

/** 各指标的均值摘要（用于评分卡） */
export interface PerformanceSummary {
  avgFcp: number
  avgLcp: number
  avgFid: number
  avgCls: number
  avgTtfb: number
  avgLoadTime: number
}

/** LCP 按天趋势数据点（用于折线图） */
export interface LcpTrendPoint {
  date: string    // 'YYYY-MM-DD'
  avgLcp: number  // 当日 LCP 平均值（ms）
}

/** 最慢页面（按 avgLcp 降序） */
export interface SlowPage {
  page: string    // 页面 URL
  avgLcp: number  // 该页面的平均 LCP（ms）
  avgFcp: number  // 该页面的平均 FCP（ms）
  count: number   // 本时段内该页面的采集次数
}

/**
 * GET /monitor/performance/stats 响应结构
 *
 *  summary      — 各指标均值（用于评分卡展示）
 *  lcpTrend     — 按天聚合的 LCP 平均值趋势（用于折线图）
 *  quantiles    — 关键指标分位数（用于柱状图，P50/P75/P95）
 *  topSlowPages — 最慢页面 Top 10（用于表格）
 */
export interface PerformanceStats {
  summary: PerformanceSummary
  lcpTrend: LcpTrendPoint[]
  quantiles: PerformanceQuantiles
  topSlowPages: SlowPage[]
}

/**
 * 单条性能日志（来自 ClickHouse performance_logs 表）
 *
 * 注意：fid 为 0 时表示本次页面访问未触发首次交互（页面可能未被点击）。
 */
export interface PerformanceLog {
  trace_id: string
  app_id: string
  user_id: string
  page: string
  fcp: number
  lcp: number
  fid: number
  cls: number
  ttfb: number
  load_time: number
  ua: string
  created_at: string
}

/** GET /monitor/performance 查询参数 */
export interface PerformanceQueryParams {
  appId: string
  startTime?: string  // ISO 8601
  endTime?: string    // ISO 8601
  page?: number
  pageSize?: number
}

/** GET /monitor/performance/stats 查询参数（复用） */
export interface PerformanceStatsParams {
  appId: string
  startTime?: string
  endTime?: string
}
