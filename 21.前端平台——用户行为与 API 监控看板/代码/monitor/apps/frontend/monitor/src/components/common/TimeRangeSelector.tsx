import { useState } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'

/**
 * DateRange —— 日期范围值类型
 *
 * from/to 均为 'YYYY-MM-DD' 格式字符串，或 undefined（未选择）
 */
export interface DateRange {
  from: string | undefined
  to: string | undefined
}

/**
 * TimeRangeMode —— 时间范围选择模式
 *
 *  preset  — 快捷预设（24h / 7d / 30d）
 *  custom  — 自定义日期范围（从/到日期选择器）
 */
export type TimeRangeMode = 'preset' | 'custom'

export type PresetRange = '24h' | '7d' | '30d'

/** 根据预设时间范围计算 ISO 时间字符串 */
export function getPresetTimeRange(preset: PresetRange): { startTime: string; endTime: string } {
  const now = new Date()
  const end = now.toISOString()
  const start = new Date(now)
  if (preset === '24h') start.setHours(start.getHours() - 24)
  else if (preset === '7d') start.setDate(start.getDate() - 7)
  else start.setDate(start.getDate() - 30)
  return { startTime: start.toISOString(), endTime: end }
}

/** 根据自定义日期范围计算 ISO 时间字符串（to 日期自动补 23:59:59） */
export function getCustomTimeRange(range: DateRange): { startTime: string; endTime: string } {
  const now = new Date()
  const startTime = range.from
    ? new Date(`${range.from}T00:00:00`).toISOString()
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const endTime = range.to
    ? new Date(`${range.to}T23:59:59`).toISOString()
    : now.toISOString()
  return { startTime, endTime }
}

const PRESET_OPTIONS: { label: string; value: PresetRange }[] = [
  { label: '24H', value: '24h' },
  { label: '7D',  value: '7d' },
  { label: '30D', value: '30d' },
]

/**
 * TimeRangeSelector —— 时间范围选择器（预设 + 自定义日期范围）
 *
 * 功能说明（对应课程大纲 21.5）：
 *  - 快捷预设模式：24H / 7D / 30D 三个快捷按钮（与错误/性能监控保持一致）
 *  - 自定义模式：点击"自定义"展开日期范围输入，选择从/到日期
 *
 * 设计考量（架构思考）：
 *  - 用受控组件（value + onChange）而非内部 state，保证父组件掌握完整控制权
 *  - 将"时间范围"抽象为统一的查询参数 {startTime, endTime}，组件负责转换格式
 *  - 不引入 react-day-picker，使用原生 <input type="date"> 保持零依赖
 *
 * Props:
 *  preset         — 当前预设值
 *  onPresetChange — 预设改变时的回调
 *  customRange    — 自定义日期范围值
 *  onCustomChange — 自定义范围改变时的回调
 *  mode           — 当前选择模式
 *  onModeChange   — 模式切换回调
 */

interface TimeRangeSelectorProps {
  preset: PresetRange
  onPresetChange: (preset: PresetRange) => void
  customRange: DateRange
  onCustomChange: (range: DateRange) => void
  mode: TimeRangeMode
  onModeChange: (mode: TimeRangeMode) => void
}

export default function TimeRangeSelector({
  preset,
  onPresetChange,
  customRange,
  onCustomChange,
  mode,
  onModeChange,
}: TimeRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(mode === 'custom')

  const handlePresetClick = (value: PresetRange) => {
    onPresetChange(value)
    onModeChange('preset')
    setShowCustom(false)
  }

  const handleCustomToggle = () => {
    const next = !showCustom
    setShowCustom(next)
    if (next) {
      onModeChange('custom')
    } else {
      onModeChange('preset')
    }
  }

  const handleClearCustom = () => {
    onCustomChange({ from: undefined, to: undefined })
    onModeChange('preset')
    setShowCustom(false)
  }

  const hasCustomRange = customRange.from || customRange.to
  const customLabel = hasCustomRange
    ? `${customRange.from ?? '?'} → ${customRange.to ?? '?'}`
    : '自定义'

  // 今天日期字符串（用于 max 限制，不能选未来）
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex items-center gap-2 flex-wrap self-start">
      {/* 预设时间范围按钮 */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-1">
        {PRESET_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => handlePresetClick(value)}
            className={[
              'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-[0.2px] transition-all',
              mode === 'preset' && preset === value
                ? 'bg-[#6a5fc1] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 自定义日期范围触发按钮 */}
      <button
        onClick={handleCustomToggle}
        className={[
          'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all',
          mode === 'custom' && hasCustomRange
            ? 'border-[#6a5fc1] bg-[#6a5fc1]/10 text-[#6a5fc1]'
            : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:border-[#6a5fc1]/40',
        ].join(' ')}
      >
        <Calendar className="w-3.5 h-3.5" />
        <span className="font-mono">{customLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
      </button>

      {/* 自定义日期范围面板（展开式） */}
      {showCustom && (
        <div className="flex items-center gap-2 rounded-lg border border-[#362d59] bg-[#1f1633]/80 backdrop-blur-sm px-3 py-2">
          <span className="text-xs text-muted-foreground font-mono">From</span>
          <input
            type="date"
            value={customRange.from ?? ''}
            max={customRange.to ?? todayStr}
            onChange={(e) => onCustomChange({ ...customRange, from: e.target.value || undefined })}
            className="text-xs font-mono bg-transparent border border-[#362d59] rounded px-2 py-1 text-foreground
                       focus:outline-none focus:border-[#6a5fc1] [color-scheme:dark]"
          />
          <span className="text-xs text-muted-foreground font-mono">→</span>
          <input
            type="date"
            value={customRange.to ?? ''}
            min={customRange.from}
            max={todayStr}
            onChange={(e) => onCustomChange({ ...customRange, to: e.target.value || undefined })}
            className="text-xs font-mono bg-transparent border border-[#362d59] rounded px-2 py-1 text-foreground
                       focus:outline-none focus:border-[#6a5fc1] [color-scheme:dark]"
          />
          {hasCustomRange && (
            <button
              onClick={handleClearCustom}
              className="text-muted-foreground hover:text-red-400 transition-colors"
              title="清除自定义范围"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
