import { useQuery } from '@tanstack/react-query'
import { getPerformanceLogsApi, getPerformanceStatsApi } from '@/services/performance.service'
import type { PerformanceQueryParams, PerformanceStatsParams } from '@/types/performance'

/**
 * 性能监控 Query Key 常量
 *
 * 设计与错误监控保持一致：params 对象整体作为 key 的一部分，
 * 保证任何查询参数变化都会触发新请求，同时旧 key 的数据仍被缓存。
 */
export const PERFORMANCE_QUERY_KEYS = {
  list: (params: PerformanceQueryParams) =>
    ['monitor', 'performance', 'list', params] as const,
  stats: (params: PerformanceStatsParams) =>
    ['monitor', 'performance', 'stats', params] as const,
}

/**
 * usePerformanceLogs —— 获取性能日志列表（分页）
 *
 * enabled: 仅在 appId 存在时才发起请求，避免在项目加载前产生无效请求。
 * staleTime: 30 秒，性能数据更新频繁。
 */
export function usePerformanceLogs(params: PerformanceQueryParams) {
  return useQuery({
    queryKey: PERFORMANCE_QUERY_KEYS.list(params),
    queryFn: () => getPerformanceLogsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 30,
  })
}

/**
 * usePerformanceStats —— 获取性能统计数据（均值 + 趋势 + 分位数 + 最慢页面）
 *
 * staleTime: 60 秒，统计聚合数据变化不如列表频繁。
 */
export function usePerformanceStats(params: PerformanceStatsParams) {
  return useQuery({
    queryKey: PERFORMANCE_QUERY_KEYS.stats(params),
    queryFn: () => getPerformanceStatsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 60,
  })
}
