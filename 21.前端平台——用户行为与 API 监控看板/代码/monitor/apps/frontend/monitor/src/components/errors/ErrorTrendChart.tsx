import type { TooltipProps } from 'recharts'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ErrorTrendPoint } from '@/types/error-log'

/**
 * ErrorTrendChart —— 错误趋势折线图
 *
 * 使用 Recharts 的 LineChart + ResponsiveContainer 实现响应式折线图。
 *
 * 📌 为什么用 ResponsiveContainer？
 *  Recharts 图表默认需要明确宽高。
 *  ResponsiveContainer 会监听父容器的尺寸变化，自动撑满容器，
 *  不需要手写 window.onresize，也不用 JS 计算宽度。
 *
 * 颜色设计：
 *  - 折线：Sentry Purple #6a5fc1
 *  - 活动数据点：Lime #c2ef4e（强调色，反差明显）
 *  - 网格线：Sentry 边框色 #362d59
 *  - 坐标轴文字：Muted Purple #79628c
 *
 * Props:
 *  data    — 趋势数据点数组（{date, count}[]），来自 useErrorStats
 *  loading — 加载状态（显示骨架屏）
 */

interface ErrorTrendChartProps {
  data: ErrorTrendPoint[]
  loading?: boolean
}

// ── 自定义 Tooltip 气泡 ────────────────────────────────────────────────────────
// Recharts Tooltip 的 content prop 接收一个 React 组件，可以完全自定义样式。
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {payload[0]?.value?.toLocaleString('zh-CN')}
        <span className="text-xs text-muted-foreground font-normal ml-1">次错误</span>
      </p>
    </div>
  )
}

export default function ErrorTrendChart({ data, loading }: ErrorTrendChartProps) {
  // 加载中：骨架屏占位
  if (loading) {
    return <div className="h-[200px] rounded-lg bg-muted/30 animate-pulse" />
  }

  // 无数据：空状态提示
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          当前时间范围内暂无错误数据
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        {/* 网格线：使用 Sentry 边框色，弱化视觉层级 */}
        <CartesianGrid strokeDasharray="3 3" stroke="#362d59" vertical={false} />

        {/* X 轴：日期 */}
        <XAxis
          dataKey="date"
          tick={{ fill: '#79628c', fontSize: 11 }}
          axisLine={{ stroke: '#362d59' }}
          tickLine={false}
          // 日期较长时简化显示（只保留月/日）
          tickFormatter={(v: string) => {
            if (!v) return v
            const parts = v.split('-')
            return parts.length === 3 ? `${parts[1]}/${parts[2]}` : v
          }}
        />

        {/* Y 轴：错误数，不显示小数 */}
        <YAxis
          tick={{ fill: '#79628c', fontSize: 11 }}
          axisLine={{ stroke: '#362d59' }}
          tickLine={false}
          allowDecimals={false}
        />

        {/* 气泡提示 */}
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#362d59' }} />

        {/* 折线：主紫色，活动点切换为 lime 强调色 */}
        <Line
          type="monotone"
          dataKey="count"
          stroke="#6a5fc1"
          strokeWidth={2}
          dot={{ fill: '#6a5fc1', r: 3, strokeWidth: 0 }}
          activeDot={{ fill: '#c2ef4e', r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
