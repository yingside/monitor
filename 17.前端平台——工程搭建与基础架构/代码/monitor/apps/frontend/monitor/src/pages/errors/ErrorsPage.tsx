import { AlertTriangle } from 'lucide-react'

/**
 * ErrorsPage —— 错误监控看板
 *
 * 第 17 章：占位页，展示页面骨架和路由可用性。
 * 第 19 章：实现完整的错误列表、错误详情、趋势图等功能。
 */
export default function ErrorsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* 页头 */}
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="w-5 h-5 text-[#c2ef4e]" />
        <h1 className="text-xl font-semibold text-foreground">Errors</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        JS 错误 / 资源加载失败 / Promise 异常 / 框架层错误
      </p>

      {/* 占位骨架 */}
      <div className="space-y-4">
        {/* 统计卡片行 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['总错误数', 'JS 错误', '资源错误', 'Promise 错误'].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-4 space-y-2"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-[0.2px]">
                {label}
              </p>
              <div className="h-7 w-20 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>

        {/* 趋势图占位 */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
          <div className="h-48 rounded bg-muted/50 animate-pulse" />
        </div>

        {/* 列表占位 */}
        <div className="rounded-xl border border-border bg-card">
          <div className="p-4 border-b border-border">
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border-b border-border last:border-0">
              <div className="flex items-start gap-3">
                <div className="h-4 w-4 rounded bg-muted animate-pulse mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted/60 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  )
}
