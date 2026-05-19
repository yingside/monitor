import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { PvUvTrendPoint } from '@/types/behavior'

/**
 * PvUvTrendChart —— PV/UV 趋势折线图（双轴双线）
 *
 * 设计要点：
 *  - PV（页面浏览量）和 UV（唯一访客）量级差异大，使用左右双 Y 轴
 *  - PV 用左 Y 轴（主轴），UV 用右 Y 轴（辅轴）
 *  - 两条折线颜色区分：PV 用主色 #6a5fc1，UV 用强调色 #c2ef4e
 *
 * > 🏗️ 架构思考：为什么用双 Y 轴？
 *   PV 可能是 10000，UV 只有 500。如果共用一个 Y 轴，
 *   UV 的折线会被挤压到底部，趋势变化不可见。
 *   双 Y 轴让每条线都能"撑开"自己的高度空间，趋势更清晰。
 *
 * Props:
 *  data    — PV/UV 趋势数据数组
 *  loading — 加载状态
 */

interface PvUvTrendChartProps {
  data: PvUvTrendPoint[] | undefined
  loading?: boolean
}

// 自定义 Tooltip 样式（与错误/性能监控保持一致）
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ color: string; name: string; value: number }>
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
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function PvUvTrendChart({ data, loading }: PvUvTrendChartProps) {
  if (loading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
        <div className="h-52 rounded bg-muted/40 animate-pulse" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">PV / UV 趋势</h3>
        <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
          暂无数据
        </div>
      </div>
    )
  }

  // 格式化日期为更短的显示（MM-DD）
  const chartData = data.map((d) => ({
    ...d,
    date: d.date.slice(5), // 'YYYY-MM-DD' → 'MM-DD'
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">PV / UV 趋势</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#6a5fc1] rounded-full inline-block" />
            PV 浏览量
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#c2ef4e] rounded-full inline-block" />
            UV 访客数
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
          {/* 左 Y 轴：PV */}
          <YAxis
            yAxisId="pv"
            orientation="left"
            tick={{ fill: '#79628c', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          {/* 右 Y 轴：UV */}
          <YAxis
            yAxisId="uv"
            orientation="right"
            tick={{ fill: '#79628c', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#362d59', strokeWidth: 1 }} />
          <Legend wrapperStyle={{ display: 'none' }} />
          <Line
            yAxisId="pv"
            type="monotone"
            dataKey="pv"
            name="PV"
            stroke="#6a5fc1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6a5fc1', strokeWidth: 0 }}
          />
          <Line
            yAxisId="uv"
            type="monotone"
            dataKey="uv"
            name="UV"
            stroke="#c2ef4e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#c2ef4e', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
