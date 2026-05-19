import type { SlowApi } from '@/types/api-monitor'

/**
 * SlowApisTable —— 慢接口 Top 10 表格
 *
 * 展示按 P95 耗时降序排列的慢接口，每行包含：
 *  - HTTP 方法 Badge（GET/POST/PUT/DELETE 等）
 *  - 接口 URL（超长截断）
 *  - 平均耗时
 *  - P95 耗时（排序依据）
 *  - 调用次数
 *  - 错误率（百分比，超 5% 标红）
 *
 * Props:
 *  apis    — 慢接口数据数组
 *  loading — 加载状态
 */

interface SlowApisTableProps {
  apis: SlowApi[] | undefined
  loading?: boolean
}

const METHOD_STYLES: Record<string, string> = {
  GET:    'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20',
  POST:   'bg-[#6a5fc1]/15 text-[#6a5fc1] border-[#6a5fc1]/30',
  PUT:    'bg-[#ffb287]/10 text-[#ffb287] border-[#ffb287]/20',
  PATCH:  'bg-[#c2ef4e]/10 text-[#c2ef4e] border-[#c2ef4e]/20',
  DELETE: 'bg-red-400/10 text-red-400 border-red-400/20',
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}

export default function SlowApisTable({ apis, loading }: SlowApisTableProps) {
  if (loading || !apis) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4">
        慢接口 Top {apis.length}
        <span className="ml-2 text-xs text-muted-foreground font-normal">按 P95 耗时降序</span>
      </h3>

      {apis.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-20">
                  Method
                </th>
                <th className="text-left pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium">
                  URL
                </th>
                <th className="text-right pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-24">
                  Avg
                </th>
                <th className="text-right pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-24">
                  P95
                </th>
                <th className="text-right pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-20">
                  Calls
                </th>
                <th className="text-right pb-3 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-20">
                  Err%
                </th>
              </tr>
            </thead>
            <tbody>
              {apis.map((api, index) => {
                const methodStyle = METHOD_STYLES[api.method.toUpperCase()] ??
                  'bg-muted/30 text-muted-foreground border-border'
                const isHighError = api.errorRate > 5

                return (
                  <tr
                    key={`${api.method}-${api.url}-${index}`}
                    className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded border ${methodStyle}`}>
                        {api.method}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className="font-mono text-xs text-foreground/90 block max-w-[280px] truncate"
                        title={api.url}
                      >
                        {api.url}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {formatDuration(api.avgDuration)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs font-semibold text-foreground tabular-nums">
                      {formatDuration(api.p95Duration)}
                    </td>
                    <td className="py-3 pr-4 text-right text-muted-foreground tabular-nums text-xs">
                      {api.total.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-mono tabular-nums ${
                        isHighError ? 'text-red-400 font-semibold' : 'text-muted-foreground'
                      }`}>
                        {api.errorRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
