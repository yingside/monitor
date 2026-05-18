import { Copy, Globe, User, Monitor, Clock, Hash, FileCode } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { ErrorLog } from '@/types/error-log'

/**
 * ErrorDetailDialog —— 错误详情弹窗
 *
 * 点击错误日志列表中的某一行时打开，展示该条错误的完整信息：
 *
 * 1. 错误元数据
 *    - 错误类型（Badge 颜色区分）
 *    - 错误消息
 *    - 文件位置（filename:lineno:colno）
 *    - 来源页面 URL
 *    - 用户 ID
 *    - 浏览器 User-Agent
 *    - Trace ID（会话追踪用）
 *    - 发生时间
 *
 * 2. Stack Trace（等宽字体代码块，支持复制）
 *    Stack 来自 SDK 采集的原始 Error.stack 字符串。
 *    生产环境中应通过 SourceMap 还原为可读的源码行号
 *    （本课程 SourceMap 功能预留到第 22 章）。
 *
 * Props：
 *  log          — 当前展示的错误日志（null 时不渲染内容）
 *  open         — 弹窗开关状态
 *  onOpenChange — 状态变更回调（点击关闭按钮或遮罩时触发）
 */

interface ErrorDetailDialogProps {
  log: ErrorLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

export default function ErrorDetailDialog({
  log,
  open,
  onOpenChange,
}: ErrorDetailDialogProps) {
  // log 为 null 时不渲染内容，弹窗关闭后不会闪烁旧内容
  if (!log) return null

  const handleCopyStack = () => {
    if (log.stack) {
      // clipboard API 只在 HTTPS 或 localhost 环境下可用
      navigator.clipboard.writeText(log.stack).catch(() => {
        // 降级：创建临时文本区域手动复制
        const textarea = document.createElement('textarea')
        textarea.value = log.stack
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-w-2xl：弹窗宽度；max-h-[85vh] + overflow-y-auto：内容超长时可滚动 */}
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* ── 弹窗标题 ──────────────────────────────────────────────────────── */}
        <DialogHeader>
          <div className="flex items-start gap-2 flex-wrap">
            <Badge variant={getErrorTypeBadgeVariant(log.error_type)} className="mt-0.5 shrink-0">
              {log.error_type || 'unknown'}
            </Badge>
            <DialogTitle className="text-base leading-snug break-all">
              {log.message || '（未知错误）'}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            错误详细信息：{log.error_type} 类型错误
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── 元数据网格 ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            {/* 文件位置 */}
            {log.filename && (
              <div className="col-span-2 rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-[0.2px] mb-1">
                  <FileCode className="w-3 h-3" />
                  位置
                </div>
                <p className="font-mono text-xs text-foreground break-all">
                  {log.filename}
                  {log.lineno ? `:${log.lineno}` : ''}
                  {log.colno ? `:${log.colno}` : ''}
                </p>
              </div>
            )}

            {/* 来源页面 */}
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-[0.2px] mb-1">
                <Globe className="w-3 h-3" />
                页面
              </div>
              <p className="text-xs text-foreground break-all">{log.page || '-'}</p>
            </div>

            {/* 用户 ID */}
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-[0.2px] mb-1">
                <User className="w-3 h-3" />
                用户 ID
              </div>
              <p className="text-xs text-foreground font-mono">
                {log.user_id || '（匿名）'}
              </p>
            </div>

            {/* Trace ID */}
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-[0.2px] mb-1">
                <Hash className="w-3 h-3" />
                Trace ID
              </div>
              <p className="text-xs text-foreground font-mono break-all">
                {log.trace_id}
              </p>
            </div>

            {/* 发生时间 */}
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-[0.2px] mb-1">
                <Clock className="w-3 h-3" />
                发生时间
              </div>
              <p className="text-xs text-foreground">
                {new Date(log.created_at).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </p>
            </div>

            {/* 设备信息（User-Agent）—— 横跨两列 */}
            {log.ua && (
              <div className="col-span-2 rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-[0.2px] mb-1">
                  <Monitor className="w-3 h-3" />
                  User-Agent
                </div>
                <p className="text-xs text-muted-foreground break-all leading-relaxed">
                  {log.ua}
                </p>
              </div>
            )}
          </div>

          {/* ── Stack Trace ──────────────────────────────────────────────────── */}
          {log.stack && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-[0.2px]">
                  Stack Trace
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 px-2"
                  onClick={handleCopyStack}
                >
                  <Copy className="w-3 h-3" />
                  复制
                </Button>
              </div>

              {/*
               * 等宽字体代码块，背景使用 Sentry 最深背景色 #150f23。
               * max-h-64 + overflow-y-auto：堆栈过长时可以在弹窗内独立滚动。
               * whitespace-pre-wrap：保留缩进换行，但允许超长行自动折行。
               *
               * ⚠️ 注意：
               * 此处展示的是原始 Error.stack 字符串，通常包含压缩后的路径。
               * 生产环境需要通过 SourceMap 还原为实际源码行号，
               * 这部分功能在第 22 章的端到端联调环节中预留接入点。
               */}
              <pre className="text-xs text-[#c2ef4e]/80 font-mono bg-[#150f23] border border-border rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-72 overflow-y-auto">
                {log.stack}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
