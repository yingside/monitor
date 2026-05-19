import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn —— Tailwind 类名合并工具函数
 *
 * 来源于 shadcn/ui 约定，统一用这一个函数处理：
 *  1. clsx：条件类名（支持对象 / 数组 / 三元表达式）
 *  2. twMerge：解决 Tailwind 类名冲突（如 p-4 和 p-8 共存时只保留后者）
 *
 * 用法示例：
 *   cn('px-4 py-2', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
