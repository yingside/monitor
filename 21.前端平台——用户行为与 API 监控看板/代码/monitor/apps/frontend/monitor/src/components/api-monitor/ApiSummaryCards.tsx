import type { ApiSummary } from '@/types/api-monitor'
import { Activity, CheckCircle2, XCircle, Clock } from 'lucide-react'

/**
 * ApiSummaryCards —— API 监控统计摘要卡片
 *
 * 展示 4 个统计卡片：
 *  - 总请求数
 *  - 成功率（百分比）
 *  - 平均耗时（ms）
 *  - P95 耗时（ms）— 95% 的请求在此时间内完成
 *
 * Props:
 *  summary — 来自 useApiMonitorStats 的统计摘要
 *  loading — 加载状态
 */

interface ApiSummaryCardsProps {
  summary: ApiSummary | undefined
  loading?: boolean
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="h-7 w-24 rounded bg-muted animate-pulse" />
      <div className="h-3 w-36 rounded bg-muted/60 animate-pulse" />
    </div>
  )
}

/** 成功率颜色：> 99% 绿，95-99% 黄，< 95% 红 */
function getSuccessRateColor(rate: number): string {
  if (rate >= 99) return 'text-[#4ade80]'
  if (rate >= 95) return 'text-[#ffb287]'
  return 'text-red-400'
}

export default function ApiSummaryCards({ summary, loading }: ApiSummaryCardsProps) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const successRateColor = getSuccessRateColor(summary.successRate)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 总请求数 */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#6a5fc1]/40 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.2px]">
            Total Requests
          </p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#6a5fc1]/15 text-[#6a5fc1]">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-semibold text-foreground">
          {summary.total.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          成功 {summary.successCount.toLocaleString()} / 失败 {summary.errorCount.toLocaleString()}
        </p>
      </div>

      {/* 成功率 */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#6a5fc1]/40 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.2px]">
            Success Rate
          </p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            summary.successRate >= 99
              ? 'bg-[#4ade80]/15 text-[#4ade80]'
              : summary.successRate >= 95
                ? 'bg-[#ffb287]/15 text-[#ffb287]'
                : 'bg-red-400/15 text-red-400'
          }`}>
            {summary.successRate >= 95
              ? <CheckCircle2 className="w-4 h-4" />
              : <XCircle className="w-4 h-4" />}
          </div>
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${successRateColor}`}>
          {summary.successRate.toFixed(2)}%
        </p>
        <p className="text-xs text-muted-foreground">请求成功率（非 4xx/5xx）</p>
      </div>

      {/* 平均耗时 */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#6a5fc1]/40 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.2px]">
            Avg Duration
          </p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#c2ef4e]/15 text-[#c2ef4e]">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-semibold text-foreground tabular-nums">
          {summary.avgDuration.toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground ml-1">ms</span>
        </p>
        <p className="text-xs text-muted-foreground">所有请求的平均耗时</p>
      </div>

      {/* P95 耗时 */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#6a5fc1]/40 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.2px]">
            P95 Duration
          </p>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#fa7faa]/15 text-[#fa7faa]">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-semibold text-foreground tabular-nums">
          {summary.p95Duration.toLocaleString()}
          <span className="text-sm font-normal text-muted-foreground ml-1">ms</span>
        </p>
        <p className="text-xs text-muted-foreground">95% 请求在此时间内完成</p>
      </div>
    </div>
  )
}
