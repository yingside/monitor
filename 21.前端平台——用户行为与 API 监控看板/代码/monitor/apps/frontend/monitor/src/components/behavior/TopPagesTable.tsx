import type { TopPage } from '@/types/behavior'

/**
 * TopPagesTable —— 热门页面 Top 10 表格
 *
 * 展示按 PV 降序排列的热门页面，每行包含：
 *  - 排名（编号）
 *  - 页面 URL（超长时截断）
 *  - PV（浏览量）
 *  - UV（唯一访客数）
 *  - UV/PV 比率（代表"新老访客比"，比率越高说明新访客越多）
 *
 * Props:
 *  pages   — 热门页面数据数组
 *  loading — 加载状态
 */

interface TopPagesTableProps {
  pages: TopPage[] | undefined
  loading?: boolean
}

const RANK_COLORS = ['text-[#c2ef4e]', 'text-[#6a5fc1]', 'text-[#ffb287]']

export default function TopPagesTable({ pages, loading }: TopPagesTableProps) {
  if (loading || !pages) {
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
        热门页面 Top {pages.length}
        <span className="ml-2 text-xs text-muted-foreground font-normal">按 PV 降序</span>
      </h3>

      {pages.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-10">
                  #
                </th>
                <th className="text-left pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium">
                  Page
                </th>
                <th className="text-right pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-20">
                  PV
                </th>
                <th className="text-right pb-3 pr-4 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-20">
                  UV
                </th>
                <th className="text-right pb-3 text-xs text-muted-foreground uppercase tracking-[0.2px] font-medium w-24">
                  UV/PV
                </th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page, index) => {
                const rankColor = RANK_COLORS[index] ?? 'text-muted-foreground'
                const uvRatio = page.pv > 0
                  ? ((page.uv / page.pv) * 100).toFixed(1)
                  : '0.0'

                return (
                  <tr
                    key={`${page.page}-${index}`}
                    className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                  >
                    <td className={`py-3 pr-4 font-mono font-semibold ${rankColor}`}>
                      {index + 1}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className="font-mono text-xs text-foreground/90 block max-w-[320px] truncate"
                        title={page.page}
                      >
                        {page.page}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-foreground tabular-nums">
                      {page.pv.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right text-muted-foreground tabular-nums">
                      {page.uv.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-xs font-mono text-[#c2ef4e]/80">
                        {uvRatio}%
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
