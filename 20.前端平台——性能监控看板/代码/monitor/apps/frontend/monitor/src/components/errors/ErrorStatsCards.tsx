import { AlertTriangle, Code2, Globe, Zap } from 'lucide-react'
import type { ErrorStats } from '@/types/error-log'

/**
 * ErrorStatsCards —— 错误概览统计卡片组
 *
 * 展示 4 张卡片：
 *  1. 总错误数  — 所有类型之和（来自 typeDistribution 聚合）
 *  2. JS 错误   — error_type = 'js' 的数量
 *  3. 资源错误  — error_type = 'resource' 的数量
 *  4. Promise 错误 — error_type = 'promise' 的数量
 *
 * Props:
 *  stats   — 来自 useErrorStats 的统计数据（undefined 时显示骨架屏）
 *  loading — 加载状态（true 时显示 pulse 动画占位）
 */

interface ErrorStatsCardsProps {
  stats: ErrorStats | undefined
  loading?: boolean
}

type BadgeColor = string

interface StatCard {
  label: string
  value: number
  icon: React.FC<{ className?: string }>
  iconColor: BadgeColor
  accentColor: BadgeColor
}

export default function ErrorStatsCards({ stats, loading }: ErrorStatsCardsProps) {
  // 从类型分布中提取各类型数量
  const getCount = (type: string) =>
    stats?.typeDistribution.find((t) => t.errorType === type)?.count ?? 0

  const total =
    stats?.typeDistribution.reduce((sum, t) => sum + t.count, 0) ?? 0

  const cards: StatCard[] = [
    {
      label: '总错误数',
      value: total,
      icon: AlertTriangle,
      iconColor: 'text-red-400',
      accentColor: 'bg-red-500/10 border-red-500/20',
    },
    {
      label: 'JS 错误',
      value: getCount('js_error'),
      icon: Code2,
      iconColor: 'text-orange-400',
      accentColor: 'bg-orange-500/10 border-orange-500/20',
    },
    {
      label: '资源错误',
      value: getCount('resource_error'),
      icon: Globe,
      iconColor: 'text-yellow-400',
      accentColor: 'bg-yellow-500/10 border-yellow-500/20',
    },
    {
      label: 'Promise 错误',
      value: getCount('promise_error'),
      icon: Zap,
      iconColor: 'text-purple-400',
      accentColor: 'bg-purple-500/10 border-purple-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, iconColor, accentColor }) => (
        <div
          key={label}
          className={`rounded-xl border bg-card p-4 ${accentColor}`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-[0.2px]">
              {label}
            </p>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-background/40">
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 rounded bg-muted animate-pulse" />
          ) : (
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {value.toLocaleString('zh-CN')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
