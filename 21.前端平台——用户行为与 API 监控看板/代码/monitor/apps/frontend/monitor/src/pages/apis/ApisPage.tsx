import { useState, useMemo } from 'react'
import { Globe } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { useProjectStore } from '@/stores/project.store'
import { useApiMonitorStats } from '@/hooks/useApiMonitor'
import ApiSummaryCards from '@/components/api-monitor/ApiSummaryCards'
import ApiTrendChart from '@/components/api-monitor/ApiTrendChart'
import SlowApisTable from '@/components/api-monitor/SlowApisTable'
import TimeRangeSelector, {
  type PresetRange,
  type DateRange,
  type TimeRangeMode,
  getPresetTimeRange,
  getCustomTimeRange,
} from '@/components/common/TimeRangeSelector'

/**
 * ApisPage —— API 请求监控看板（第 21 章：完整实现）
 *
 * 布局（与其他看板保持一致的三段式结构）：
 *  1. 页头：项目名称 + 时间范围选择器（预设 + 自定义）
 *  2. 统计摘要卡片（总请求数 / 成功率 / 平均耗时 / P95 耗时）
 *  3. 双列区域：耗时&错误率趋势折线图 + 慢接口 Top 10 表格
 *
 * 数据来源：GET /monitor/apis/stats
 *  → summary（卡片）+ trend（趋势图）+ slowApis（表格）
 *
 * 项目数据获取策略（与其他看板相同的双层保障）：
 *  ① Zustand store 有 currentProject → 直接取（无 HTTP 请求）
 *  ② store 无匹配数据（刷新/直链访问）→ 降级 useProject(projectId) API 请求
 */

export default function ApisPage() {
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

  // ⚠️ useMemo 保证 queryKey 稳定，不触发无限 isLoading 循环
  const { startTime, endTime } = useMemo(() => {
    if (mode === 'custom' && (customRange.from || customRange.to)) {
      return getCustomTimeRange(customRange)
    }
    return getPresetTimeRange(preset)
  }, [mode, preset, customRange])

  // ── 统计数据请求 ─────────────────────────────────────────────────────────
  const statsQuery = useApiMonitorStats({ appId, startTime, endTime })

  const isProjectLoading = !storeHasProject && projectLoading

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* 页头 */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-5 h-5 text-[#6a5fc1]" />
            <h1 className="text-xl font-semibold text-foreground">API 监控</h1>
            {project && (
              <span className="text-xs font-mono text-[#6a5fc1] bg-[#6a5fc1]/10 px-2 py-0.5 rounded-md border border-[#6a5fc1]/20">
                {project.name}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            请求成功率 · 耗时分布 · 慢接口追踪
          </p>
        </div>

        {/* 时间范围选择器 */}
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
          <ApiSummaryCards
            summary={statsQuery.data?.summary}
            loading={statsQuery.isLoading}
          />

          {/* 趋势图 + 慢接口表格（并排布局） */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ApiTrendChart
              data={statsQuery.data?.trend}
              loading={statsQuery.isLoading}
            />
            <SlowApisTable
              apis={statsQuery.data?.slowApis}
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
