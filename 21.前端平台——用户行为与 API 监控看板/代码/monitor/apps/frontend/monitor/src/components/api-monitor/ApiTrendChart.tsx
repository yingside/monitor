import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { ApiTrendPoint } from '@/types/api-monitor'

/**
 * ApiTrendChart —— API 耗时与错误率趋势折线图（双轴）
 *
 * 设计要点：
 *  - 左 Y 轴：平均耗时（ms），折线颜色 #6a5fc1
 *  - 右 Y 轴：错误率（%），折线颜色 #fa7faa
 *  - 错误率 > 5% 时增加红色参考线，提示异常阈值
 *
 * > 🏗️ 架构思考：
 *   将耗时和错误率放在同一图表中，是为了发现"高错误率时段"
 *   与"高延迟时段"是否重叠，帮助定位后端瓶颈。
 *
 * Props:
 *  data    — API 趋势数据数组
 *  loading — 加载状态
 */

interface ApiTrendChartProps {
  data: ApiTrendPoint[] | undefined
  loading?: boolean
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ color: string; name: string; value: number; unit?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#362d59] bg-[#1f1633]/95 backdrop-blur-sm p-3 text-xs shadow-xl">
      <p className="text-muted-foreground mb-2 font-mono">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground uppercase tracking-[0.2px]">{entry.name}</span>
          <span className="font-semibold text-foreground ml-auto pl-4">
            {entry.value}
            <span className="text-muted-foreground font-normal">{entry.unit}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ApiTrendChart({ data, loading }: ApiTrendChartProps) {
  if (loading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-5 w-36 rounded bg-muted animate-pulse mb-4" />
        <div className="h-52 rounded bg-muted/40 animate-pulse" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">请求耗时 & 错误率趋势</h3>
        <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
          暂无数据
        </div>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    date: d.date.slice(5),
  }))

  // 检查是否有任何一天错误率超过 5%
  const hasHighErrorRate = data.some((d) => d.errorRate > 5)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">请求耗时 & 错误率趋势</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#6a5fc1] rounded-full inline-block" />
            Avg Duration
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#fa7faa] rounded-full inline-block" />
            Error Rate
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#362d59" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#79628c', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          {/* 左 Y 轴：耗时 */}
          <YAxis
            yAxisId="duration"
            orientation="left"
            tick={{ fill: '#79628c', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => `${v}ms`}
          />
          {/* 右 Y 轴：错误率 */}
          <YAxis
            yAxisId="errorRate"
            orientation="right"
            tick={{ fill: '#79628c', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#362d59', strokeWidth: 1 }} />

          {/* 错误率阈值警戒线（5%） */}
          {hasHighErrorRate && (
            <ReferenceLine
              yAxisId="errorRate"
              y={5}
              stroke="#fa7faa"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: '5%', position: 'insideTopRight', fill: '#fa7faa', fontSize: 10 }}
            />
          )}

          <Line
            yAxisId="duration"
            type="monotone"
            dataKey="avgDuration"
            name="AVG"
            unit="ms"
            stroke="#6a5fc1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6a5fc1', strokeWidth: 0 }}
          />
          <Line
            yAxisId="errorRate"
            type="monotone"
            dataKey="errorRate"
            name="ERR%"
            unit="%"
            stroke="#fa7faa"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#fa7faa', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
