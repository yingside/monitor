import { Gauge } from 'lucide-react'

/**
 * PerformancePage —— 性能监控看板
 *
 * 第 17 章：占位页。
 * 第 20 章：实现 Web Vitals 趋势图、Navigation Timing 分析等。
 */
export default function PerformancePage() {
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <Gauge className="w-5 h-5 text-[#ffb287]" />
        <h1 className="text-xl font-semibold text-foreground">Performance</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        FCP / LCP / INP / CLS / TTFB · Web Vitals 核心性能指标
      </p>

      {/* 骨架 */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {['FCP', 'LCP', 'INP', 'CLS', 'TTFB', 'Load'].map((metric) => (
            <div key={metric} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-mono">{metric}</p>
              <div className="h-7 w-20 rounded bg-muted animate-pulse" />
              <div className="h-2 w-full rounded-full bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="h-5 w-40 rounded bg-muted animate-pulse mb-4" />
          <div className="h-64 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>


    </div>
  )
}
