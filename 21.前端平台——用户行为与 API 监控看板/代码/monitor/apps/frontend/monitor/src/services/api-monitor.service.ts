import request from '@/utils/request'
import type { ApiResponse, PaginatedData } from '@/types/api'
import type {
  ApiLog,
  ApiMonitorStats,
  ApiQueryParams,
  ApiStatsParams,
} from '@/types/api-monitor'

/**
 * API 请求监控服务层
 *
 * 封装所有与 /monitor/apis 相关的后端接口调用。
 * 均返回解包后的业务数据，不暴露 axios response 结构。
 *
 * 后端数据来源：ClickHouse api_logs 表（由 consumer-server 从 Kafka 消费写入）
 *
 * 注意：此文件对应监控平台中的 API 监控功能，
 * 区别于 src/types/api.ts（那个定义的是前端自身调用后端的通用响应格式）。
 */

/**
 * 获取 API 请求日志列表（分页）
 *
 * GET /monitor/apis
 * 支持按 URL 模糊过滤和只看失败请求两个筛选条件。
 */
export async function getApiMonitorLogsApi(
  params: ApiQueryParams,
): Promise<PaginatedData<ApiLog>> {
  // 清理空值参数（axios 不会自动跳过 undefined）
  const cleanParams: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '' && val !== false) {
      cleanParams[key] = val
    }
  }

  const { data } = await request.get<ApiResponse<PaginatedData<ApiLog>>>(
    '/monitor/apis',
    { params: cleanParams },
  )
  return data.data
}

/**
 * 获取 API 统计数据（摘要 + 趋势 + 慢接口 Top 10）
 *
 * GET /monitor/apis/stats
 *  - summary：总请求数 / 成功率 / 平均耗时 / P95 耗时（用于摘要卡片）
 *  - trend：按天聚合的平均耗时和失败率（用于折线图）
 *  - slowApis：按 P95 耗时排序的慢接口 Top 10（用于表格）
 */
export async function getApiMonitorStatsApi(
  params: ApiStatsParams,
): Promise<ApiMonitorStats> {
  const { data } = await request.get<ApiResponse<ApiMonitorStats>>(
    '/monitor/apis/stats',
    { params },
  )
  return data.data
}
