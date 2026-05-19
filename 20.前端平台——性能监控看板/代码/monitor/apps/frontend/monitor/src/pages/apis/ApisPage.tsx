import { Globe } from 'lucide-react'

/**
 * ApisPage —— API 请求监控看板
 *
 * 第 17 章：占位页。
 * 第 21 章：实现请求成功率、耗时分布、慢请求列表等。
 */
export default function ApisPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <Globe className="w-5 h-5 text-[#6a5fc1]" />
        <h1 className="text-xl font-semibold text-foreground">API Requests</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        HTTP 请求监控 · 成功率 / 耗时分布 / 错误追踪
      </p>

      {/* 骨架 */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['总请求数', '成功率', '平均耗时', '失败请求'].map((label) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-[0.2px]">{label}</p>
              <div className="h-7 w-20 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
            <div className="h-48 rounded bg-muted/50 animate-pulse" />
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
            <div className="h-48 rounded bg-muted/50 animate-pulse" />
          </div>
        </div>
      </div>


    </div>
  )
}
