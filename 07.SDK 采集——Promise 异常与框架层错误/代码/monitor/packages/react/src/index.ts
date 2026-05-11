// ─────────────────────────────────────────────────────────────────────────────
// @monitor/react — React 框架适配层
//
// 职责：提供 MonitorErrorBoundary 组件，捕获 React 渲染阶段的错误，
//       将其转换为 FrameworkErrorPayload 并交给 Monitor 核心数据管道处理。
//
// 为什么必须是 Class 组件？
// React 官方至今只在 Class 组件上提供了两个错误边界钩子：
//   - static getDerivedStateFromError()：用于更新 state，触发降级渲染
//   - componentDidCatch()：用于上报错误（副作用）
// 函数式组件目前无法实现 ErrorBoundary，这是 React 设计上的限制。
//
// 使用方式：
//   const monitor = init({ dsn: '...', appId: '...' })
//   <MonitorErrorBoundary monitor={monitor}>
//     <App />
//   </MonitorErrorBoundary>
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import type { FrameworkErrorPayload, MonitorInstance } from '@monitor/core'

// ─────────────────────────────────────────────────────────────────────────────
// Props & State
// ─────────────────────────────────────────────────────────────────────────────

export interface MonitorErrorBoundaryProps {
  /** Monitor 实例，由 init() 返回 */
  monitor: MonitorInstance

  /**
   * 降级 UI（可选）
   * 当子组件发生渲染错误时展示的 fallback 内容。
   * 不提供时使用内置的简单错误提示。
   */
  fallback?: React.ReactNode

  /** 需要被监控的子组件树 */
  children: React.ReactNode
}

interface MonitorErrorBoundaryState {
  /** 是否已捕获到错误 */
  hasError: boolean
  /** 捕获到的错误对象 */
  error: Error | null
}

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary 组件
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React 错误边界组件
 *
 * 捕获子组件树在**渲染阶段**抛出的错误，包括：
 * - render() 函数中的错误
 * - 生命周期方法（componentDidMount 等）中的错误
 * - 构造函数中的错误（类组件）
 *
 * 注意：以下错误 ErrorBoundary 捕获不到，需要其他手段处理：
 * - 事件处理器（onClick 等）中的错误 → 用 try-catch 或 createErrorPlugin
 * - 异步代码（setTimeout / Promise）中的错误 → 用 createErrorPlugin
 * - 服务端渲染（SSR）中的错误
 * - ErrorBoundary 组件自身的错误
 *
 * @example
 * ```tsx
 * import { init, createErrorPlugin } from '@monitor/browser'
 * import { MonitorErrorBoundary } from '@monitor/react'
 *
 * const monitor = init({
 *   dsn: 'http://localhost:3001/collect',
 *   appId: 'react-demo',
 *   plugins: [createErrorPlugin()],
 * })
 *
 * createRoot(document.getElementById('root')!).render(
 *   <MonitorErrorBoundary monitor={monitor}>
 *     <App />
 *   </MonitorErrorBoundary>
 * )
 * ```
 */
export class MonitorErrorBoundary extends React.Component<
  MonitorErrorBoundaryProps,
  MonitorErrorBoundaryState
> {
  constructor(props: MonitorErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  /**
   * 静态方法：从错误中派生新 state
   *
   * React 在渲染阶段捕获到错误时，先调用此方法更新 state（触发降级渲染），
   * 再调用 componentDidCatch（上报副作用）。
   * 两者分离是 React 设计的"纯函数优先"原则体现。
   */
  static getDerivedStateFromError(error: Error): MonitorErrorBoundaryState {
    return { hasError: true, error }
  }

  /**
   * 实例方法：处理错误副作用（上报）
   *
   * @param error - 渲染阶段抛出的错误
   * @param info  - React 提供的诊断信息，包含 componentStack（组件调用链）
   */
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const payload: FrameworkErrorPayload = {
      subType: 'react',
      message: error.message,
      stack: error.stack ?? '',
      // componentStack 格式示例：
      //   "\n    at BrokenComponent (App.tsx:12:5)\n    at App (App.tsx:25:3)\n    ..."
      componentInfo: info.componentStack ?? '',
    }

    this.props.monitor.capture('error', payload)

    // 保留控制台输出，方便开发时定位问题
    if (this.props.monitor.options.debug) {
      console.error(
        '[Monitor][React] ErrorBoundary caught:',
        error,
        '\nComponent stack:',
        info.componentStack,
      )
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // 优先使用用户自定义的 fallback
      if (this.props.fallback !== undefined) {
        return this.props.fallback
      }

      // 内置降级 UI（极简样式，避免依赖 Tailwind/CSS）
      return React.createElement(
        'div',
        {
          style: {
            padding: '1.5rem',
            margin: '1rem',
            border: '1px solid #ff3b30',
            borderRadius: 8,
            background: '#fff5f5',
            color: '#1d1d1f',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        },
        React.createElement(
          'h3',
          { style: { color: '#ff3b30', margin: '0 0 0.5rem', fontSize: '1rem' } },
          '组件渲染出错',
        ),
        React.createElement(
          'p',
          { style: { margin: 0, fontSize: '0.875rem', color: '#6e6e73' } },
          this.state.error?.message ?? '未知错误',
        ),
      )
    }

    return this.props.children
  }
}

