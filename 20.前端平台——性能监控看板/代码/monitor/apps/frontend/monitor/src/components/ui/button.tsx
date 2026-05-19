import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Button —— shadcn/ui 风格，适配 Sentry 暗紫主题
 *
 * variants:
 *  - default：主色按钮（Sentry Purple #6a5fc1）
 *  - secondary：次级按钮（Muted Purple #79628c，带 inset 阴影）
 *  - destructive：危险按钮（红色）
 *  - outline：线框按钮（#362d59 边框）
 *  - ghost：无背景按钮
 *  - link：链接样式
 *
 * asChild：将样式渲染到子元素上（例如 <Link> 组件），
 *          通过 Radix Slot 实现，不包一层额外 <button>。
 */
const buttonVariants = cva(
  // 基础样式：所有按钮共有
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'text-sm font-medium uppercase tracking-[0.2px]',
    'rounded-lg transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // 主色 —— Sentry Purple，带 inset 阴影营造触感
        default: [
          'bg-primary text-primary-foreground',
          'shadow-inset-sm',
          'hover:shadow-hover-lg hover:brightness-110',
          'active:brightness-90',
        ],
        // 次级 —— Muted Purple，Sentry 标志性触感按钮
        secondary: [
          'bg-[#79628c] text-white border border-[#584674]',
          'shadow-inset-sm',
          'hover:shadow-hover-lg',
        ],
        // 危险 —— 删除 / 不可逆操作
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:brightness-110',
        ],
        // 线框 —— 边框用 sentry-border 颜色
        outline: [
          'border border-border bg-transparent text-foreground',
          'hover:bg-muted hover:text-foreground',
        ],
        // 幽灵 —— 完全透明背景
        ghost: [
          'bg-transparent text-foreground',
          'hover:bg-muted',
        ],
        // 链接样式
        link: [
          'text-primary underline-offset-4 hover:underline',
          'h-auto px-0',
        ],
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
