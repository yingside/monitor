import { ExternalLink } from 'lucide-react'
import type { SlowPage, VitalRating } from '@/types/performance'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * SlowPagesTable —— 最慢页面 Top 10 表格
 *
 * 按 avgLcp 降序展示最慢的 10 条页面 URL，包含：
 *  - 排名序号（前 3 名高亮）
 *  - 页面 URL（超长截断 + 悬停 Tooltip）
 *  - Avg LCP（ms）+ 评级 badge
 *  - Avg FCP（ms）
 *  - 采集次数
 */

interface SlowPagesTableProps {
  pages: SlowPage[] | undefined
  loading?: boolean
}

// 复用 VitalsCards 中的评级逻辑（LCP 阈值：Good ≤ 2500ms，Poor > 4000ms）
function getLcpRating(value: number): VitalRating {
  if (value <= 2500) return 'good'
  if (value <= 4000) return 'needs-improvement'
  return 'poor'
}

const RATING_STYLES: Record<VitalRating, string> = {
  'good':              'text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20',
  'needs-improvement': 'text-[#ffb287] bg-[#ffb287]/10 border-[#ffb287]/20',
  'poor':              'text-red-400 bg-red-400/10 border-red-400/20',
}

const RATING_LABEL: Record<VitalRating, string> = {
  'good': 'Good',
  'needs-improvement': 'Needs Impr.',
  'poor': 'Poor',
}

// 前 3 名排名样式
const RANK_STYLES = ['text-yellow-400', 'text-zinc-400', 'text-orange-700']

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 w-full rounded bg-muted/30 animate-pulse" />
      ))}
    </div>
  )
}

export default function SlowPagesTable({ pages, loading }: SlowPagesTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-[0.2px]">
          最慢页面 Top 10
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          按 Avg LCP 降序 · 优先优化排名靠前的页面
        </p>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : !pages?.length ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#362d59] hover:bg-transparent">
              <TableHead className="w-10 text-[#79628c] text-xs">#</TableHead>
              <TableHead className="text-[#79628c] text-xs">页面 URL</TableHead>
              <TableHead className="text-right text-[#79628c] text-xs w-36">Avg LCP</TableHead>
              <TableHead className="text-right text-[#79628c] text-xs w-28">Avg FCP</TableHead>
              <TableHead className="text-right text-[#79628c] text-xs w-20">采集次数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((row, index) => {
              const rating = getLcpRating(row.avgLcp)
              return (
                <TableRow
                  key={`${row.page}-${index}`}
                  className="border-b border-[#362d59]/50 hover:bg-[#362d59]/20 transition-colors"
                >
                  {/* 排名 */}
                  <TableCell className="w-10">
                    <span
                      className={`text-sm font-bold font-mono ${index < 3 ? RANK_STYLES[index] : 'text-muted-foreground'}`}
                    >
                      {index + 1}
                    </span>
                  </TableCell>

                  {/* 页面 URL */}
                  <TableCell className="max-w-0">
                    <div
                      className="flex items-center gap-1.5 group cursor-default"
                      title={row.page}
                    >
                      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-xs text-foreground/80 truncate font-mono">
                        {row.page}
                      </span>
                    </div>
                  </TableCell>

                  {/* Avg LCP + 评级 */}
                  <TableCell className="text-right w-36">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-[0.2px] ${RATING_STYLES[rating]}`}
                      >
                        {RATING_LABEL[rating]}
                      </span>
                      <span className="text-sm font-mono font-semibold text-foreground">
                        {row.avgLcp.toFixed(0)} ms
                      </span>
                    </div>
                  </TableCell>

                  {/* Avg FCP */}
                  <TableCell className="text-right w-28">
                    <span className="text-sm font-mono text-muted-foreground">
                      {row.avgFcp > 0 ? `${row.avgFcp.toFixed(0)} ms` : '—'}
                    </span>
                  </TableCell>

                  {/* 采集次数 */}
                  <TableCell className="text-right w-20">
                    <span className="text-xs font-mono text-muted-foreground">
                      {row.count.toLocaleString()}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
