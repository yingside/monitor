import { useQuery } from '@tanstack/react-query'
import { getBehaviorLogsApi, getBehaviorStatsApi } from '@/services/behavior.service'
import type { BehaviorQueryParams, BehaviorStatsParams } from '@/types/behavior'

/**
 * 用户行为监控 Query Key 常量
 *
 * 设计原则与错误/性能监控保持一致：
 * params 对象整体作为 key 的一部分，任何参数变化都会触发新请求。
 */
export const BEHAVIOR_QUERY_KEYS = {
  list: (params: BehaviorQueryParams) =>
    ['monitor', 'behavior', 'list', params] as const,
  stats: (params: BehaviorStatsParams) =>
    ['monitor', 'behavior', 'stats', params] as const,
}

/**
 * useBehaviorLogs —— 获取行为日志列表（分页）
 *
 * enabled: 仅在 appId 存在时才发起请求
 * staleTime: 30 秒，行为数据更新较频繁
 */
export function useBehaviorLogs(params: BehaviorQueryParams) {
  return useQuery({
    queryKey: BEHAVIOR_QUERY_KEYS.list(params),
    queryFn: () => getBehaviorLogsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 30,
  })
}

/**
 * useBehaviorStats —— 获取行为统计数据（PV/UV 趋势 + 热门页面）
 *
 * staleTime: 60 秒，聚合统计数据变化不如列表频繁
 */
export function useBehaviorStats(params: BehaviorStatsParams) {
  return useQuery({
    queryKey: BEHAVIOR_QUERY_KEYS.stats(params),
    queryFn: () => getBehaviorStatsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 60,
  })
}
