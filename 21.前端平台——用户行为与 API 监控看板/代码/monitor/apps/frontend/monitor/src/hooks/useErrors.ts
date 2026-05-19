import { useQuery } from '@tanstack/react-query'
import { getErrorsApi, getErrorStatsApi } from '@/services/error.service'
import type { ErrorQueryParams, BaseMonitorQueryParams } from '@/types/error-log'

/**
 * 错误监控 Query Key 常量
 *
 * 📌 为什么要把 params 完整放入 queryKey？
 *  TanStack Query 以 key 为缓存标识。
 *  当 appId / 时间范围 / 分页参数 / 过滤条件任一发生变化时，
 *  新的 key 会触发新的请求，老数据继续缓存直到过期。
 *  这样用户切换时间范围时能享受之前的缓存，而不是每次都重新请求。
 */
export const ERROR_QUERY_KEYS = {
  list: (params: ErrorQueryParams) =>
    ['monitor', 'errors', 'list', params] as const,
  stats: (params: BaseMonitorQueryParams) =>
    ['monitor', 'errors', 'stats', params] as const,
}

/**
 * useErrors —— 获取错误日志列表（分页）
 *
 * enabled: 仅在 appId 存在时才发起请求，避免在项目加载前产生无效请求。
 * staleTime: 30 秒，错误数据更新频繁，不需要太长的缓存时间。
 */
export function useErrors(params: ErrorQueryParams) {
  return useQuery({
    queryKey: ERROR_QUERY_KEYS.list(params),
    queryFn: () => getErrorsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 30, // 30 秒
  })
}

/**
 * useErrorStats —— 获取错误统计汇总（趋势 + 类型分布 + TOP 10）
 *
 * staleTime: 60 秒，统计数据变化不如列表频繁。
 */
export function useErrorStats(params: BaseMonitorQueryParams) {
  return useQuery({
    queryKey: ERROR_QUERY_KEYS.stats(params),
    queryFn: () => getErrorStatsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 60, // 1 分钟
  })
}
