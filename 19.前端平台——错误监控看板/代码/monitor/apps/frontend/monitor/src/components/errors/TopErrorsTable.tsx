import { TrendingUp, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TopErrorItem } from '@/types/error-log'

/**
 * TopErrorsTable —— 高频错误 TOP 10 表格
 *
 * 数据来源：GET /monitor/errors/stats 响应中的 topErrors 字段
 * （ClickHouse 按 message 聚合，count() 降序取前 10）
 *
 * 📌 为什么要单独做这个组件？
 *  与「最近日志」不同，高频错误是按错误内容聚合的，
 *  一行代表"这条错误消息出现了 N 次"，而不是"第 N 次发生的错误"。
 *  这是监控系统中优先修复哪个错误的核心依据：
 *   → 发生次数最多的错误，影响面最大，优先级最高。
 */

interface TopErrorsTableProps {
  data: TopErrorItem[]
  loading?: boolean
}

type BadgeVariant = 'destructive' | 'warning' | 'default' | 'secondary' | 'outline'

function getErrorTypeBadgeVariant(type: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    js_error: 'destructive',
    resource_error: 'warning',
    promise_error: 'default',
    framework_error: 'secondary',
  }
  return map[type] ?? 'outline'
}

export default function TopErrorsTable({ data, loading }: TopErrorsTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <TrendingUp className="w-4 h-4 text-[#c2ef4e]" />
        <h2 className="text-sm font-medium text-foreground uppercase tracking-[0.2px]">
          高频错误 Top 10
        </h2>
        <span className="text-xs text-muted-foreground">
          （按错误消息聚合，按发生次数降序）
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead className="w-[110px]">错误类型</TableHead>
            <TableHead>错误消息</TableHead>
            <TableHead className="w-[90px] text-right">发生次数</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-12 rounded bg-muted animate-pulse ml-auto" />
                </TableCell>
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
                  <p className="text-sm">当前时间范围内无高频错误数据</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, index) => (
              <TableRow key={`${item.errorType}-${item.message}-${index}`}>
                {/* 排名序号 */}
                <TableCell>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      index === 0
                        ? 'text-[#c2ef4e]'
                        : index === 1
                          ? 'text-orange-400'
                          : index === 2
                            ? 'text-yellow-500'
                            : 'text-muted-foreground'
                    }`}
                  >
                    {index + 1}
                  </span>
                </TableCell>

                {/* 错误类型 */}
                <TableCell>
                  <Badge variant={getErrorTypeBadgeVariant(item.errorType)}>
                    {item.errorType || 'unknown'}
                  </Badge>
                </TableCell>

                {/* 错误消息 */}
                <TableCell>
                  <p className="text-sm text-foreground font-mono truncate max-w-[500px]">
                    {item.message || '（无错误消息）'}
                  </p>
                </TableCell>

                {/* 发生次数（强调显示）*/}
                <TableCell className="text-right">
                  <span className="text-sm font-semibold text-[#c2ef4e] tabular-nums">
                    {item.count.toLocaleString('zh-CN')}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
