import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { PerformanceQuantiles } from '@/types/performance'

/**
 * MetricsQuantileChart —— 分位数柱状图
 *
 * 展示 4 个关键指标（FCP / LCP / TTFB / Load）的 P50 / P75 / P95 分布。
 *
 * 为什么要看分位数？
 *  均值受极端值影响大，分位数更能反映"大多数用户"的真实体验：
 *  - P50（中位数）：一半用户比这快
 *  - P75：75% 用户比这快（Google 推荐用 P75 衡量达标率）
 *  - P95：95% 用户比这快（尾部用户体验）
 *
 * 图表风格：Sentry 深色 + 分组柱状 + 自定义 Tooltip
 */

interface MetricsQuantileChartProps {
  quantiles: PerformanceQuantiles | undefined
  loading?: boolean
}

// Recharts 自定义 Tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#362d59] bg-[#1f1633]/90 backdrop-blur-sm px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1 font-semibold">{label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }} className="font-mono">
          {item.name}: {item.value.toFixed(0)} ms
        </p>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-52 rounded bg-muted/30 animate-pulse" />
}

export default function MetricsQuantileChart({ quantiles, loading }: MetricsQuantileChartProps) {
  // 将嵌套的 quantiles 对象转成 Recharts 友好的数组格式
  const chartData = quantiles
    ? [
        { metric: 'FCP',  p50: quantiles.fcp.p50,      p75: quantiles.fcp.p75,      p95: quantiles.fcp.p95 },
        { metric: 'LCP',  p50: quantiles.lcp.p50,      p75: quantiles.lcp.p75,      p95: quantiles.lcp.p95 },
        { metric: 'TTFB', p50: quantiles.ttfb.p50,     p75: quantiles.ttfb.p75,     p95: quantiles.ttfb.p95 },
        { metric: 'Load', p50: quantiles.loadTime.p50, p75: quantiles.loadTime.p75, p95: quantiles.loadTime.p95 },
      ]
    : []

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-[0.2px]">
          分位数分布
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          P50 / P75 / P95 — 衡量不同百分位用户的体验（ms）
        </p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : chartData.every((d) => d.p75 === 0) ? (
        <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={208}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#362d59" vertical={false} />
            <XAxis
              dataKey="metric"
              tick={{ fill: '#79628c', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#79628c', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}ms`}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#362d59', fillOpacity: 0.3 }} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#79628c', paddingTop: 8 }}
              iconType="rect"
              iconSize={8}
            />

            {/* P50：最浅，中位数 */}
            <Bar dataKey="p50" name="P50" fill="#6a5fc1" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
            {/* P75：Google 官方推荐评估基准 */}
            <Bar dataKey="p75" name="P75" fill="#6a5fc1" fillOpacity={0.9} radius={[2, 2, 0, 0]} />
            {/* P95：尾部用户（最差 5%）*/}
            <Bar dataKey="p95" name="P95" fill="#c2ef4e" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
