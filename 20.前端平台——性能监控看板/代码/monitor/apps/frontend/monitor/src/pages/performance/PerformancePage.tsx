import { useState, useMemo } from 'react'
import { Gauge } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { useProjectStore } from '@/stores/project.store'
import { usePerformanceStats } from '@/hooks/usePerformance'
import VitalsCards from '@/components/performance/VitalsCards'
import LcpTrendChart from '@/components/performance/LcpTrendChart'
import MetricsQuantileChart from '@/components/performance/MetricsQuantileChart'
import SlowPagesTable from '@/components/performance/SlowPagesTable'
import type { TimeRange } from '@/types/performance'

/**
 * PerformancePage —— 性能监控看板（第 20 章：完整实现）
 *
 * 布局（与 ErrorsPage 结构一致）：
 *  1. 页头：项目名称 + 时间范围选择器
 *  2. Core Web Vitals 评分卡（6 张：FCP / LCP / FID / CLS / TTFB / Load）
 *  3. 双列区域：LCP 趋势折线图 + 分位数柱状图
 *  4. 最慢页面 Top 10 表格
 *
 * 数据来源：GET /monitor/performance/stats
 *  → summary（评分卡）+ lcpTrend（趋势图）+ quantiles（分位图）+ topSlowPages（表格）
 *
 * 项目数据获取策略（与 ErrorsPage 相同的双层保障）：
 *  ① Zustand store 有 currentProject → 直接取（无 HTTP 请求）
 *  ② store 无匹配数据（刷新/直链访问）→ 降级 useProject(projectId) API 请求
 */

// ── 时间范围工具函数（与 ErrorsPage 共用相同逻辑）───────────────────────────
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
  { label: '7D',  value: '7d' },
  { label: '30D', value: '30d' },
]

// ── 页面组件 ─────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const { projectId } = useParams<{ projectId: string }>()

  // ① 优先从 store 读（ProjectsPage 点击卡片时已通过 setCurrentProject 写入）
  const { currentProject } = useProjectStore()
  const storeHasProject = currentProject?.id === projectId

  // ② 仅在 store 未命中时（刷新、直链）才发 API 请求
  const { data: fetchedProject, isLoading: projectLoading } = useProject(
    storeHasProject ? '' : (projectId ?? ''),
  )

  const project = storeHasProject ? currentProject : fetchedProject

  // ── 时间范围状态 ─────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')

  const appId = project?.appId ?? ''

  // ⚠️ 必须用 useMemo 包裹（避免 queryKey 每次渲染都变化 → 无限 isLoading 循环）
  const { startTime, endTime } = useMemo(() => getTimeRangeParams(timeRange), [timeRange])

  // ── 统计数据请求 ─────────────────────────────────────────────────────────
  const statsQuery = usePerformanceStats({ appId, startTime, endTime })

  const isProjectLoading = !storeHasProject && projectLoading

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* 页头 */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-5 h-5 text-[#ffb287]" />
            <h1 className="text-xl font-semibold text-foreground">性能监控</h1>
            {project && (
              <span className="text-xs font-mono text-[#6a5fc1] bg-[#6a5fc1]/10 px-2 py-0.5 rounded-md border border-[#6a5fc1]/20">
                {project.name}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            FCP · LCP · FID · CLS · TTFB · Core Web Vitals 性能指标
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
              onClick={() => setTimeRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 项目加载中 */}
      {isProjectLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 h-28 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
            <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
          </div>
          <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1：Core Web Vitals 评分卡 */}
          <section>
            <VitalsCards
              summary={statsQuery.data?.summary}
              loading={statsQuery.isLoading}
            />
          </section>

          {/* Section 2：LCP 趋势 + 分位数柱状图 */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LcpTrendChart
              data={statsQuery.data?.lcpTrend}
              loading={statsQuery.isLoading}
            />
            <MetricsQuantileChart
              quantiles={statsQuery.data?.quantiles}
              loading={statsQuery.isLoading}
            />
          </section>

          {/* Section 3：最慢页面 Top 10 */}
          <section>
            <SlowPagesTable
              pages={statsQuery.data?.topSlowPages}
              loading={statsQuery.isLoading}
            />
          </section>
        </div>
      )}
    </div>
  )
}

