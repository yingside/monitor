import request from '@/utils/request'
import type { ApiResponse, PaginatedData } from '@/types/api'
import type {
  PerformanceLog,
  PerformanceStats,
  PerformanceQueryParams,
  PerformanceStatsParams,
} from '@/types/performance'

/**
 * 性能监控 API 服务层
 *
 * 封装所有与 /monitor/performance 相关的后端接口调用。
 * 均返回解包后的业务数据，不暴露 axios response 结构。
 *
 * 后端数据来源：ClickHouse performance_logs 表（由 consumer-server 从 Kafka 消费写入）
 */

/**
 * 获取性能日志列表（分页）
 *
 * GET /monitor/performance
 * 返回最新的性能采集记录，按 created_at DESC 排序。
 */
export async function getPerformanceLogsApi(
  params: PerformanceQueryParams,
): Promise<PaginatedData<PerformanceLog>> {
  const { data } = await request.get<ApiResponse<PaginatedData<PerformanceLog>>>(
    '/monitor/performance',
    { params },
  )
  return data.data
}

/**
 * 获取性能指标统计（均值 + LCP 趋势 + 分位数 + 最慢页面 Top 10）
 *
 * GET /monitor/performance/stats
 *  - summary：各指标均值，用于评分卡
 *  - lcpTrend：按天聚合的 LCP 均值，用于折线图
 *  - quantiles：FCP / LCP / TTFB / LoadTime 的 P50 / P75 / P95，用于柱状图
 *  - topSlowPages：按均值 LCP 排序的最慢页面 Top 10，用于表格
 */
export async function getPerformanceStatsApi(
  params: PerformanceStatsParams,
): Promise<PerformanceStats> {
  const { data } = await request.get<ApiResponse<PerformanceStats>>(
    '/monitor/performance/stats',
    { params },
  )
  return data.data
}
