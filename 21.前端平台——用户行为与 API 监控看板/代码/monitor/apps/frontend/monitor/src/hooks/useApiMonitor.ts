import { useQuery } from '@tanstack/react-query'
import { getApiMonitorLogsApi, getApiMonitorStatsApi } from '@/services/api-monitor.service'
import type { ApiQueryParams, ApiStatsParams } from '@/types/api-monitor'

/**
 * API 请求监控 Query Key 常量
 */
export const API_MONITOR_QUERY_KEYS = {
  list: (params: ApiQueryParams) =>
    ['monitor', 'api', 'list', params] as const,
  stats: (params: ApiStatsParams) =>
    ['monitor', 'api', 'stats', params] as const,
}

/**
 * useApiMonitorLogs —— 获取 API 请求日志列表（分页）
 *
 * enabled: 仅在 appId 存在时才发起请求
 * staleTime: 30 秒
 */
export function useApiMonitorLogs(params: ApiQueryParams) {
  return useQuery({
    queryKey: API_MONITOR_QUERY_KEYS.list(params),
    queryFn: () => getApiMonitorLogsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 30,
  })
}

/**
 * useApiMonitorStats —— 获取 API 统计数据（摘要 + 趋势 + 慢接口）
 *
 * staleTime: 60 秒
 */
export function useApiMonitorStats(params: ApiStatsParams) {
  return useQuery({
    queryKey: API_MONITOR_QUERY_KEYS.stats(params),
    queryFn: () => getApiMonitorStatsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 60,
  })
}
