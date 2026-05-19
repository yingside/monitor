import request from '@/utils/request'
import type { ApiResponse, PaginatedData } from '@/types/api'
import type {
  BehaviorLog,
  BehaviorStats,
  BehaviorQueryParams,
  BehaviorStatsParams,
} from '@/types/behavior'

/**
 * 用户行为监控 API 服务层
 *
 * 封装所有与 /monitor/behaviors 相关的后端接口调用。
 * 均返回解包后的业务数据，不暴露 axios response 结构。
 *
 * 后端数据来源：ClickHouse behavior_logs 表（由 consumer-server 从 Kafka 消费写入）
 */

/**
 * 获取行为日志列表（分页）
 *
 * GET /monitor/behaviors
 * 返回最新的行为采集记录，按 created_at DESC 排序。
 */
export async function getBehaviorLogsApi(
  params: BehaviorQueryParams,
): Promise<PaginatedData<BehaviorLog>> {
  const { data } = await request.get<ApiResponse<PaginatedData<BehaviorLog>>>(
    '/monitor/behaviors',
    { params },
  )
  return data.data
}

/**
 * 获取行为统计数据（PV/UV 趋势 + 热门页面 Top 10）
 *
 * GET /monitor/behaviors/stats
 *  - pvuvTrend：按天聚合的 PV（浏览量）和 UV（独立访客数），用于双轴折线图
 *  - topPages：按 PV 降序排列的热门页面 Top 10，用于表格
 */
export async function getBehaviorStatsApi(
  params: BehaviorStatsParams,
): Promise<BehaviorStats> {
  const { data } = await request.get<ApiResponse<BehaviorStats>>(
    '/monitor/behaviors/stats',
    { params },
  )
  return data.data
}
