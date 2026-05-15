import { MousePointerClick } from 'lucide-react'

/**
 * BehaviorsPage —— 用户行为监控看板
 *
 * 第 17 章：占位页。
 * 第 21 章：实现 PV/UV 统计、点击热图、自定义埋点分析等。
 */
export default function BehaviorsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <MousePointerClick className="w-5 h-5 text-[#fa7faa]" />
        <h1 className="text-xl font-semibold text-foreground">Behaviors</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        页面浏览 / 点击事件 / 路由变化 / 自定义埋点
      </p>

      {/* 骨架 */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Page Views', 'Unique Users', 'Click Events', 'Custom Events'].map((label) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-[0.2px]">{label}</p>
              <div className="h-7 w-20 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="h-5 w-36 rounded bg-muted animate-pulse mb-4" />
          <div className="h-48 rounded bg-muted/50 animate-pulse" />
        </div>
      </div>


    </div>
  )
}
