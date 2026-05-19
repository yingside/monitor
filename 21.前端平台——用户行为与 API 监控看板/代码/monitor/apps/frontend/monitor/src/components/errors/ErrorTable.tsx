import { useState } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ErrorLog } from '@/types/error-log'

/**
 * ErrorTable —— 错误日志列表表格
 *
 * 功能：
 *  - 按错误类型下拉过滤（触发父组件重新请求）
 *  - 客户端关键词搜索（搜索当前页内 message / filename）
 *  - 分页控制（上一页 / 下一页）
 *  - 点击行展开错误详情（通过 onRowClick 回调）
 *
 * Props：
 *  list           — 当前页错误日志列表
 *  total          — 总条数（用于计算分页）
 *  page           — 当前页码（1-based）
 *  pageSize       — 每页条数
 *  loading        — 加载状态
 *  onPageChange   — 翻页回调
 *  onErrorTypeChange — 错误类型过滤回调（传 '' 表示全部）
 *  onRowClick     — 行点击回调（展示详情弹窗）
 */

interface ErrorTableProps {
  list: ErrorLog[]
  total: number
  page: number
  pageSize: number
  loading?: boolean
  selectedErrorType?: string  // 当前过滤类型（受控，父组件维护）
  onPageChange: (page: number) => void
  onErrorTypeChange: (type: string) => void
  onRowClick: (log: ErrorLog) => void
}

// 错误类型过滤选项（value 与 ClickHouse error_type 字段一致）
const ERROR_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'js_error', label: 'JS 错误' },
  { value: 'resource_error', label: '资源错误' },
  { value: 'promise_error', label: 'Promise 错误' },
  { value: 'framework_error', label: '框架错误' },
]

// 错误类型 → Badge 样式映射
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

// 格式化日期（月/日 时:分）
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return dateStr
  }
}

export default function ErrorTable({
  list,
  total,
  page,
  pageSize,
  loading,
  selectedErrorType = '',
  onPageChange,
  onErrorTypeChange,
  onRowClick,
}: ErrorTableProps) {
  const [searchValue, setSearchValue] = useState('')

  const totalPages = Math.ceil(total / pageSize)

  // 客户端关键词搜索（仅搜索当前页，服务端暂不支持 keyword 过滤）
  const filtered = searchValue
    ? list.filter(
        (log) =>
          log.message?.toLowerCase().includes(searchValue.toLowerCase()) ||
          log.filename?.toLowerCase().includes(searchValue.toLowerCase()),
      )
    : list

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ── 工具栏 ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
        {/* 关键词搜索 */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="搜索错误消息..."
            className="pl-9 h-8 text-sm"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>

        {/* 错误类型过滤（受控：value 来自父组件 selectedErrorType）*/}
        <Select
          value={selectedErrorType || 'all'}
          onValueChange={(v) => {
            setSearchValue('') // 切换类型时清除搜索
            onErrorTypeChange(v === 'all' ? '' : v)
          }}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            {/* 注意：SelectTrigger 内用 <div> 而不是直接放 <SelectValue />，
                避免 [&>span]:line-clamp-1 导致选中文字竖向排列显示异常 */}
            <div><SelectValue /></div>
          </SelectTrigger>
          <SelectContent>
            {ERROR_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 总数提示 */}
        <span className="text-xs text-muted-foreground ml-auto">
          共 {total.toLocaleString('zh-CN')} 条
        </span>
      </div>

      {/* ── 表格主体 ──────────────────────────────────────────────────────── */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">错误类型</TableHead>
            <TableHead>错误信息</TableHead>
            <TableHead className="w-[180px]">来源页面</TableHead>
            <TableHead className="w-[130px]">时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            // 加载骨架屏
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-muted/60 animate-pulse" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </TableCell>
              </TableRow>
            ))
          ) : filtered.length === 0 ? (
            // 空状态
            <TableRow>
              <TableCell colSpan={4}>
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">
                    {searchValue ? '未找到匹配的错误' : '暂无错误数据'}
                  </p>
                  {searchValue && (
                    <p className="text-xs mt-1 opacity-60">
                      仅搜索当前页结果
                    </p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            // 数据行（key 用 trace_id + 索引，因为同一 session 可能有多条错误记录共享同一 trace_id）
            filtered.map((log, index) => (
              <TableRow
                key={`${log.trace_id}-${index}`}
                className="cursor-pointer"
                onClick={() => onRowClick(log)}
              >
                {/* 错误类型 Badge */}
                <TableCell>
                  <Badge variant={getErrorTypeBadgeVariant(log.error_type)}>
                    {log.error_type || 'unknown'}
                  </Badge>
                </TableCell>

                {/* 错误消息 + 文件位置 */}
                <TableCell>
                  <p className="text-sm text-foreground font-mono leading-snug truncate max-w-[380px]">
                    {log.message || '（无错误消息）'}
                  </p>
                  {log.filename && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-[380px]">
                      {log.filename}
                      {log.lineno ? `:${log.lineno}` : ''}
                      {log.colno ? `:${log.colno}` : ''}
                    </p>
                  )}
                </TableCell>

                {/* 来源页面 URL */}
                <TableCell>
                  <p
                    className="text-xs text-muted-foreground truncate max-w-[170px]"
                    title={log.page}
                  >
                    {log.page || '-'}
                  </p>
                </TableCell>

                {/* 发生时间 */}
                <TableCell>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </p>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* ── 分页控制 ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            第 {page} 页 / 共 {totalPages} 页
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
