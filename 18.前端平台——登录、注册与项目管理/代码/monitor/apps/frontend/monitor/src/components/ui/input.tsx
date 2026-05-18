import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Input —— 表单输入框
 *
 * 在 Sentry 设计中，输入框使用白色背景（便于在暗色表单区分），
 * 或者在完全暗色上下文中使用深色输入框。
 * 这里提供两种通过 variant 控制的样式（默认暗色风格，适配平台内使用）。
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** dark（默认）：深色背景，适合表单页 | light：白底，适合明亮区域 */
  variant?: 'dark' | 'light'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = 'dark', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // 通用样式
          'flex h-9 w-full rounded-md px-3 py-1 text-sm transition-colors',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // 暗色变体（默认）
          variant === 'dark' && [
            'bg-muted border border-border text-foreground',
            'focus-visible:border-primary',
          ],
          // 白色变体（登录页等浅色区域）
          variant === 'light' && [
            'bg-white border border-[#cfcfdb] text-[#1f1633]',
            'placeholder:text-gray-400',
            'focus-visible:shadow-[rgba(0,0,0,0.15)_0px_2px_10px_inset]',
            'focus-visible:ring-[#6a5fc1]',
          ],
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
