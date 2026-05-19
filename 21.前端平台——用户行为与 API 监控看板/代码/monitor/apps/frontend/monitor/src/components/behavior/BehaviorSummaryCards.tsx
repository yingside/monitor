import type { BehaviorStats } from '@/types/behavior'
import { Eye, Users, MousePointerClick, BarChart3 } from 'lucide-react'

/**
 * BehaviorSummaryCards —— 用户行为统计摘要卡片
 *
 * 展示 4 个统计卡片：
 *  - 总 PV（页面浏览总量）
 *  - 总 UV（唯一访客数，基于 pvuvTrend 汇总）
 *  - 今日 PV（最后一天数据）
 *  - 热门页面数（topPages 去重数量）
 *
 * Props:
 *  stats   — 来自 useBehaviorStats 的统计数据
 *  loading — 加载状态
 */

interface BehaviorSummaryCardsProps {
  stats: BehaviorStats | undefined
  loading?: boolean
}

interface CardConfig {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  desc: string
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="h-7 w-24 rounded bg-muted animate-pulse" />
      <div className="h-3 w-32 rounded bg-muted/60 animate-pulse" />
    </div>
  )
}

export default function BehaviorSummaryCards({ stats, loading }: BehaviorSummaryCardsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const totalPv = stats.pvuvTrend.reduce((sum, d) => sum + d.pv, 0)
  const totalUv = stats.pvuvTrend.reduce((sum, d) => sum + d.uv, 0)
  const lastDay = stats.pvuvTrend[stats.pvuvTrend.length - 1]
  const todayPv = lastDay?.pv ?? 0

  const cards: CardConfig[] = [
    {
      label: 'TOTAL PV',
      value: totalPv.toLocaleString(),
      icon: <Eye className="w-4 h-4" />,
      iconBg: 'bg-[#6a5fc1]/15 text-[#6a5fc1]',
      desc: '时间段内总页面浏览量',
    },
    {
      label: 'TOTAL UV',
      value: totalUv.toLocaleString(),
      icon: <Users className="w-4 h-4" />,
      iconBg: 'bg-[#c2ef4e]/15 text-[#c2ef4e]',
      desc: '时间段内累计唯一访客',
    },
    {
      label: 'LAST DAY PV',
      value: todayPv.toLocaleString(),
      icon: <BarChart3 className="w-4 h-4" />,
      iconBg: 'bg-[#fa7faa]/15 text-[#fa7faa]',
      desc: '最近一天的页面浏览量',
    },
    {
      label: 'HOT PAGES',
      value: stats.topPages.length,
      icon: <MousePointerClick className="w-4 h-4" />,
      iconBg: 'bg-[#ffb287]/15 text-[#ffb287]',
      desc: '有访问记录的页面数量',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#6a5fc1]/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.2px]">
              {card.label}
            </p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
              {card.icon}
            </div>
          </div>
          <p className="text-2xl font-semibold text-foreground">{card.value}</p>
          <p className="text-xs text-muted-foreground">{card.desc}</p>
        </div>
      ))}
    </div>
  )
}
