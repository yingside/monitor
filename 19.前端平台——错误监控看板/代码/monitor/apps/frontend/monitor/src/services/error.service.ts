import request from '@/utils/request'
import type { ApiResponse, PaginatedData } from '@/types/api'
import type {
  ErrorLog,
  ErrorStats,
  ErrorQueryParams,
  BaseMonitorQueryParams,
} from '@/types/error-log'

/**
 * 错误监控 API 服务层
 *
 * 封装所有与 /monitor/errors 相关的后端接口调用。
 * 均返回解包后的业务数据，不暴露 axios response 结构。
 *
 * 后端数据来源：ClickHouse error_logs 表（由 consumer-server 从 Kafka 消费写入）
 */

/**
 * 获取错误日志列表（分页）
 *
 * GET /monitor/errors
 * 返回最新的错误日志条目，按 created_at DESC 排序。
 * 支持按 errorType 过滤，不传则返回所有类型。
 */
export async function getErrorsApi(
  params: ErrorQueryParams,
): Promise<PaginatedData<ErrorLog>> {
  // 清理空值参数（axios 不会自动跳过空字符串）
  const cleanParams: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') {
      cleanParams[key] = val
    }
  }

  const { data } = await request.get<ApiResponse<PaginatedData<ErrorLog>>>(
    '/monitor/errors',
    { params: cleanParams },
  )
  return data.data
}

/**
 * 获取错误统计数据（趋势 + 类型分布 + TOP 10 高频错误）
 *
 * GET /monitor/errors/stats
 *  - trend：按天聚合的错误总数，用于折线图
 *  - typeDistribution：各类型（js/resource/promise/framework）的错误数量
 *  - topErrors：出现次数最多的前 10 条错误消息（按 message 聚合）
 */
export async function getErrorStatsApi(
  params: BaseMonitorQueryParams,
): Promise<ErrorStats> {
  const { data } = await request.get<ApiResponse<ErrorStats>>(
    '/monitor/errors/stats',
    { params },
  )
  return data.data
}
