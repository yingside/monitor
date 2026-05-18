import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge —— 状态徽标
 *
 * 用于显示：错误类型、项目平台、HTTP 状态码等状态信息。
 *
 * variants:
 *  - default：主色紫（一般性标签）
 *  - secondary：次色（普通信息）
 *  - destructive：红色（错误 / 失败）
 *  - success：绿色（成功 / 正常）
 *  - warning：橙色（警告）
 *  - outline：仅边框（弱化标签）
 */
const badgeVariants = cva(
  [
    'inline-flex items-center rounded-full px-2.5 py-0.5',
    'text-xs font-semibold uppercase tracking-[0.2px]',
    'transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary/20 text-primary border border-primary/30',
        secondary: 'bg-muted text-muted-foreground border border-border',
        destructive: 'bg-destructive/20 text-red-400 border border-destructive/30',
        success: 'bg-green-500/20 text-green-400 border border-green-500/30',
        warning: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        outline: 'border border-border text-foreground bg-transparent',
        // lime 强调色 —— 用于突出显示（如 NEW / HIGHLIGHT）
        accent: 'bg-accent text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
