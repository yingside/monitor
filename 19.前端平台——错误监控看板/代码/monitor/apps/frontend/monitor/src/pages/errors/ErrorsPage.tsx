import { useState, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { useProjectStore } from '@/stores/project.store'
import { useErrors, useErrorStats } from '@/hooks/useErrors'
import ErrorStatsCards from '@/components/errors/ErrorStatsCards'
import ErrorTrendChart from '@/components/errors/ErrorTrendChart'
import TopErrorsTable from '@/components/errors/TopErrorsTable'
import ErrorTable from '@/components/errors/ErrorTable'
import ErrorDetailDialog from '@/components/errors/ErrorDetailDialog'
import type { ErrorLog, TimeRange } from '@/types/error-log'

/**
 * ErrorsPage —— 错误监控看板（第 19 章：完整实现）
 *
 * 项目数据获取策略（双层保障）：
 *  1. 优先从 Zustand store 读 currentProject（ProjectsPage 点击时已写入）
 *     → 无需额外 HTTP 请求，页面加载即可渲染内容
 *  2. 若 store 为空（直接通过 URL 访问、刷新页面等场景）
 *     → 降级为 useProject(projectId) 发 API 请求
 *
 * 时间范围：24H / 7D / 30D（切换时重置分页）
 */

// ── 时间范围工具函数 ──────────────────────────────────────────────────────────
function getTimeRangeParams(range: TimeRange): { startTime: string; endTime: string } {
  const now = new Date()
  const end = now.toISOString()
  const start = new Date(now)
  if (range === '24h') start.setHours(start.getHours() - 24)
  else if (range === '7d') start.setDate(start.getDate() - 7)
  else start.setDate(start.getDate() - 30)
  return { startTime: start.toISOString(), endTime: end }
}

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
]

// ── 页面组件 ──────────────────────────────────────────────────────────────────
export default function ErrorsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  // ① 优先从 store 读项目数据（ProjectsPage 点击卡片时已通过 setCurrentProject 写入）
  const { currentProject } = useProjectStore()
  const storeHasProject = currentProject?.id === projectId

  // ② 仅在 store 没有匹配数据时（直接访问 URL、页面刷新）才发 API 请求
  const { data: fetchedProject, isLoading: projectLoading } = useProject(
    storeHasProject ? '' : (projectId ?? ''),
  )

  // 最终使用的项目对象：store 优先，API 降级
  const project = storeHasProject ? currentProject : fetchedProject

  // ② 时间范围状态
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')

  // ③ 错误列表过滤与分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [errorType, setErrorType] = useState('')

  // ④ 详情弹窗状态
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const appId = project?.appId ?? ''
  // ⚠️ 必须用 useMemo，不能直接调用 getTimeRangeParams(timeRange)
  // 原因：getTimeRangeParams 每次调用都 new Date() 生成新的时间戳字符串，
  // 导致 queryKey 每次渲染都不同 → TanStack Query 认为是新请求 → isLoading = true
  // → 骨架屏 → 数据回来触发重渲染 → 再次生成新 key → 无限循环
  const { startTime, endTime } = useMemo(() => getTimeRangeParams(timeRange), [timeRange])

  // ⑤ 数据请求（appId 有值才触发，见 hooks 中的 enabled 配置）
  const statsQuery = useErrorStats({ appId, startTime, endTime })
  const errorsQuery = useErrors({
    appId,
    startTime,
    endTime,
    errorType: errorType || undefined,
    page: currentPage,
    pageSize: 20,
  })

  // ── 事件处理 ────────────────────────────────────────────────────────────────
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    setCurrentPage(1)
  }

  const handleErrorTypeChange = (type: string) => {
    setErrorType(type)
    setCurrentPage(1)
  }

  const handleRowClick = (log: ErrorLog) => {
    setSelectedLog(log)
    setDetailOpen(true)
  }

  // ── 渲染 ────────────────────────────────────────────────────────────────────
  // 只有在 store 没命中且 API 还在加载时才显示骨架
  const isProjectLoading = !storeHasProject && projectLoading

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* 页头 */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-[#c2ef4e]" />
            <h1 className="text-xl font-semibold text-foreground">错误监控</h1>
            {project && (
              <span className="text-xs font-mono text-[#6a5fc1] bg-[#6a5fc1]/10 px-2 py-0.5 rounded-md border border-[#6a5fc1]/20">
                {project.name}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            JS 错误 / 资源加载失败 / Promise 异常 / 框架层错误
          </p>
        </div>

        {/* 时间范围选择器 */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-1 self-start">
          {TIME_RANGE_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              className={[
                'px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-[0.2px] transition-colors',
                timeRange === value
                  ? 'bg-[#6a5fc1] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              ].join(' ')}
              onClick={() => handleTimeRangeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区：项目信息加载中 */}
      {isProjectLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
          <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
        </div>
      ) : !appId ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm text-red-400">
            项目信息加载失败，请返回项目列表重新选择
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ① 统计卡片 */}
          <ErrorStatsCards
            stats={statsQuery.data}
            loading={statsQuery.isLoading}
          />

          {/* ② 错误趋势折线图 */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-foreground uppercase tracking-[0.2px]">
                错误趋势
              </h2>
              <p className="text-xs text-muted-foreground">
                {timeRange === '24h'
                  ? '近 24 小时（按天汇总）'
                  : timeRange === '7d'
                    ? '近 7 天'
                    : '近 30 天'}
              </p>
            </div>
            <ErrorTrendChart
              data={statsQuery.data?.trend ?? []}
              loading={statsQuery.isLoading}
            />
          </div>

          {/* ③ 高频错误 TOP 10 */}
          <TopErrorsTable
            data={statsQuery.data?.topErrors ?? []}
            loading={statsQuery.isLoading}
          />

          {/* ④ 最近错误日志 */}
          <div>
            <h2 className="text-sm font-medium text-foreground uppercase tracking-[0.2px] mb-3 px-1">
              最近错误日志
            </h2>
            <ErrorTable
              list={errorsQuery.data?.list ?? []}
              total={errorsQuery.data?.total ?? 0}
              page={currentPage}
              pageSize={20}
              loading={errorsQuery.isLoading}
              selectedErrorType={errorType}
              onPageChange={setCurrentPage}
              onErrorTypeChange={handleErrorTypeChange}
              onRowClick={handleRowClick}
            />
          </div>
        </div>
      )}

      {/* 错误详情弹窗 */}
      <ErrorDetailDialog
        log={selectedLog}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
