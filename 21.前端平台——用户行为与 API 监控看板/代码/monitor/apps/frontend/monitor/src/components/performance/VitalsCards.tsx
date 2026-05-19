import type { PerformanceSummary, VitalRating } from '@/types/performance'

/**
 * VitalsCards —— Core Web Vitals 评分卡组件
 *
 * 展示 6 个性能指标卡片：FCP / LCP / FID / CLS / TTFB / Load
 * 每张卡片包含：
 *  - 指标名称（metric key）与描述
 *  - 均值（来自 summary）
 *  - 评级标签（Good / Needs Improvement / Poor）
 *  - 三段式进度条（直观展示当前值在评级区间中的位置）
 *
 * Props:
 *  summary — 来自 usePerformanceStats 的均值摘要（undefined 时显示骨架屏）
 *  loading — 加载状态
 */

interface VitalsCardsProps {
  summary: PerformanceSummary | undefined
  loading?: boolean
}

// ── Web Vitals 阈值配置 ──────────────────────────────────────────────────────
// 数据来源：https://web.dev/vitals/
// good：不超过 good 阈值
// needsImprovement：超过 good 但不超过 poor 阈值
// poor：超过 poor 阈值

interface VitalThreshold {
  good: number    // 不超过此值为 Good
  poor: number    // 超过此值为 Poor
  unit: 'ms' | ''
  decimals: number  // 显示小数位数
  desc: string
}

const VITAL_THRESHOLDS: Record<string, VitalThreshold> = {
  FCP: {
    good: 1800, poor: 3000, unit: 'ms', decimals: 0,
    desc: 'First Contentful Paint · 首次内容绘制',
  },
  LCP: {
    good: 2500, poor: 4000, unit: 'ms', decimals: 0,
    desc: 'Largest Contentful Paint · 最大内容绘制',
  },
  FID: {
    good: 100,  poor: 300,  unit: 'ms', decimals: 0,
    desc: 'First Input Delay · 首次输入延迟',
  },
  CLS: {
    good: 0.1,  poor: 0.25, unit: '',  decimals: 3,
    desc: 'Cumulative Layout Shift · 累计布局偏移',
  },
  TTFB: {
    good: 800,  poor: 1800, unit: 'ms', decimals: 0,
    desc: 'Time to First Byte · 首字节时间',
  },
  Load: {
    good: 2500, poor: 5000, unit: 'ms', decimals: 0,
    desc: 'Load Time · 完整加载耗时',
  },
}

function getRating(value: number, threshold: VitalThreshold): VitalRating {
  if (value === 0) return 'good'  // 0 = 无数据，不标差
  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

const RATING_STYLES: Record<VitalRating, { label: string; badge: string; bar: string; border: string }> = {
  'good':              { label: 'Good',           badge: 'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20', bar: 'bg-[#4ade80]', border: 'border-[#4ade80]/20' },
  'needs-improvement': { label: 'Needs Impr.',    badge: 'text-[#ffb287] bg-[#ffb287]/10 border-[#ffb287]/20', bar: 'bg-[#ffb287]', border: 'border-[#ffb287]/20' },
  'poor':              { label: 'Poor',           badge: 'text-red-400 bg-red-400/10 border-red-400/20',       bar: 'bg-red-400',   border: 'border-red-400/20' },
}

/**
 * 计算当前值在三段式进度条中的 fill 比例（0~100）
 * 用于直观展示指标值距离"满分"还有多远
 */
function getBarFill(value: number, threshold: VitalThreshold): number {
  if (value === 0) return 0
  // 以 poor 阈值的 1.2 倍为进度条满值，避免超差太多时条子溢出
  const max = threshold.poor * 1.2
  return Math.min((value / max) * 100, 100)
}

function formatValue(value: number, threshold: VitalThreshold): string {
  if (value === 0) return '—'
  return value.toFixed(threshold.decimals) + (threshold.unit ? ` ${threshold.unit}` : '')
}

// ── 骨架屏 ────────────────────────────────────────────────────────────────────
function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          <div className="h-7 w-20 rounded bg-muted animate-pulse" />
          <div className="h-4 w-12 rounded bg-muted animate-pulse" />
          <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ── 单张卡片 ────────────────────────────────────────────────────────────────
interface VitalCardProps {
  metricKey: string
  value: number
  threshold: VitalThreshold
}

function VitalCard({ metricKey, value, threshold }: VitalCardProps) {
  const rating = getRating(value, threshold)
  const style = RATING_STYLES[rating]
  const fill = getBarFill(value, threshold)

  return (
    <div
      className={`rounded-xl border bg-card/60 backdrop-blur-sm p-4 space-y-2 transition-all hover:bg-card/90 ${style.border}`}
    >
      {/* 指标 key + 评级 badge */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-mono font-semibold text-foreground tracking-wide uppercase">
          {metricKey}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-[0.2px] ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* 指标值 */}
      <p className="text-2xl font-semibold text-foreground font-mono leading-none">
        {formatValue(value, threshold)}
      </p>

      {/* 指标描述 */}
      <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
        {threshold.desc}
      </p>

      {/* 三段式进度条 */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
          style={{ width: `${fill}%` }}
        />
      </div>

      {/* 阈值标注 */}
      <p className="text-[10px] text-muted-foreground/60">
        Good ≤ {formatValue(threshold.good, threshold)}
      </p>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function VitalsCards({ summary, loading }: VitalsCardsProps) {
  if (loading || !summary) return <SkeletonCards />

  const metrics: Array<{ key: string; value: number }> = [
    { key: 'FCP',  value: summary.avgFcp },
    { key: 'LCP',  value: summary.avgLcp },
    { key: 'FID',  value: summary.avgFid },
    { key: 'CLS',  value: summary.avgCls },
    { key: 'TTFB', value: summary.avgTtfb },
    { key: 'Load', value: summary.avgLoadTime },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map(({ key, value }) => (
        <VitalCard
          key={key}
          metricKey={key}
          value={value}
          threshold={VITAL_THRESHOLDS[key]}
        />
      ))}
    </div>
  )
}
