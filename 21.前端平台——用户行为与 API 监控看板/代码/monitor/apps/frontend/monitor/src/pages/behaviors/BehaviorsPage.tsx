import { useState, useMemo } from 'react'
import { MousePointerClick } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { useProjectStore } from '@/stores/project.store'
import { useBehaviorStats } from '@/hooks/useBehavior'
import BehaviorSummaryCards from '@/components/behavior/BehaviorSummaryCards'
import PvUvTrendChart from '@/components/behavior/PvUvTrendChart'
import TopPagesTable from '@/components/behavior/TopPagesTable'
import TimeRangeSelector, {
  type PresetRange,
  type DateRange,
  type TimeRangeMode,
  getPresetTimeRange,
  getCustomTimeRange,
} from '@/components/common/TimeRangeSelector'

/**
 * BehaviorsPage —— 用户行为监控看板（第 21 章：完整实现）
 *
 * 布局（与前两个看板保持一致的三段式结构）：
 *  1. 页头：项目名称 + 时间范围选择器（支持预设 24h/7d/30d + 自定义日期范围）
 *  2. 统计摘要卡片（总 PV / 总 UV / 当日 PV / 热门页面数）
 *  3. 双列区域：PV/UV 趋势折线图 + 热门页面 Top 10 表格
 *
 * 数据来源：GET /monitor/behaviors/stats
 *  → pvuvTrend（PV/UV 趋势图）+ topPages（热门页面表格）
 *
 * 项目数据获取策略（与 ErrorsPage / PerformancePage 相同的双层保障）：
 *  ① Zustand store 有 currentProject → 直接取（无 HTTP 请求）
 *  ② store 无匹配数据（刷新/直链访问）→ 降级 useProject(projectId) API 请求
 *
 * 时间范围设计（第 21 章新特性）：
 *  - 支持预设模式（24h / 7d / 30d）与自定义日期范围模式
 *  - TimeRangeSelector 组件统一管理两种模式的时间参数转换
 */

export default function BehaviorsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  // ── 项目数据（双层保障）─────────────────────────────────────────────────
  const { currentProject } = useProjectStore()
  const storeHasProject = currentProject?.id === projectId
  const { data: fetchedProject, isLoading: projectLoading } = useProject(
    storeHasProject ? '' : (projectId ?? ''),
  )
  const project = storeHasProject ? currentProject : fetchedProject

  // ── 时间范围状态 ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState<TimeRangeMode>('preset')
  const [preset, setPreset] = useState<PresetRange>('7d')
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined })

  const appId = project?.appId ?? ''

  // ⚠️ 必须用 useMemo 包裹，避免 queryKey 每次渲染都产生新引用 → 无限 isLoading 循环
  const { startTime, endTime } = useMemo(() => {
    if (mode === 'custom' && (customRange.from || customRange.to)) {
      return getCustomTimeRange(customRange)
    }
    return getPresetTimeRange(preset)
  }, [mode, preset, customRange])

  // ── 统计数据请求 ─────────────────────────────────────────────────────────
  const statsQuery = useBehaviorStats({ appId, startTime, endTime })

  const isProjectLoading = !storeHasProject && projectLoading

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* 页头 */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MousePointerClick className="w-5 h-5 text-[#fa7faa]" />
            <h1 className="text-xl font-semibold text-foreground">用户行为</h1>
            {project && (
              <span className="text-xs font-mono text-[#6a5fc1] bg-[#6a5fc1]/10 px-2 py-0.5 rounded-md border border-[#6a5fc1]/20">
                {project.name}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            PV · UV · 热门页面 · 行为趋势分析
          </p>
        </div>

        {/* 时间范围选择器（支持预设 + 自定义，第 21 章新增） */}
        <TimeRangeSelector
          mode={mode}
          onModeChange={setMode}
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomChange={setCustomRange}
        />
      </div>

      {/* 项目加载中 */}
      {isProjectLoading && (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          加载项目数据中...
        </div>
      )}

      {!isProjectLoading && (
        <div className="space-y-6">
          {/* 统计摘要卡片 */}
          <BehaviorSummaryCards
            stats={statsQuery.data}
            loading={statsQuery.isLoading}
          />

          {/* 趋势图 + 热门页面（并排布局） */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PvUvTrendChart
              data={statsQuery.data?.pvuvTrend}
              loading={statsQuery.isLoading}
            />
            <TopPagesTable
              pages={statsQuery.data?.topPages}
              loading={statsQuery.isLoading}
            />
          </div>

          {/* 错误状态 */}
          {statsQuery.isError && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-400">
              数据加载失败，请检查后端服务是否正常运行。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
