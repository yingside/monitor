import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { LcpTrendPoint } from '@/types/performance'

/**
 * LcpTrendChart —— LCP 趋势折线图
 *
 * 展示所选时间范围内，每日 LCP 均值的变化趋势。
 * 额外绘制两条 Reference Line（评分阈值参考线）：
 *   - 2500ms（Good 上限，绿色虚线）
 *   - 4000ms（Poor 下限，红色虚线）
 *
 * 视觉风格参考 Sentry：深紫背景 + 紫色折线 + lime 高亮点。
 */

interface LcpTrendChartProps {
  data: LcpTrendPoint[] | undefined
  loading?: boolean
}

/** 自定义 Tooltip（鼠标悬停时展示） */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#362d59] bg-[#1f1633]/90 backdrop-blur-sm px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-mono text-[#c2ef4e] font-semibold">
        LCP: {payload[0].value.toFixed(0)} ms
      </p>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="h-52 rounded bg-muted/30 animate-pulse" />
  )
}

export default function LcpTrendChart({ data, loading }: LcpTrendChartProps) {
  // 提取并格式化日期（MM/DD，节省横轴空间）
  const chartData = (data ?? []).map((d) => ({
    ...d,
    label: d.date.slice(5),  // 'YYYY-MM-DD' → 'MM-DD'
  }))

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-[0.2px]">
          LCP 趋势
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          每日 Largest Contentful Paint 平均值（ms）
        </p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : chartData.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={208}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#362d59" vertical={false} />
            <XAxis
              dataKey="label"
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
            <Tooltip content={<CustomTooltip />} />

            {/* Good 上限参考线（2500ms） */}
            <ReferenceLine
              y={2500}
              stroke="#4ade80"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{ value: 'Good', fill: '#4ade80', fontSize: 10, position: 'insideTopRight' }}
            />
            {/* Poor 下限参考线（4000ms） */}
            <ReferenceLine
              y={4000}
              stroke="#f87171"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{ value: 'Poor', fill: '#f87171', fontSize: 10, position: 'insideTopRight' }}
            />

            <Line
              type="monotone"
              dataKey="avgLcp"
              stroke="#6a5fc1"
              strokeWidth={2}
              dot={{ fill: '#c2ef4e', r: 3, strokeWidth: 0 }}
              activeDot={{ fill: '#c2ef4e', r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
