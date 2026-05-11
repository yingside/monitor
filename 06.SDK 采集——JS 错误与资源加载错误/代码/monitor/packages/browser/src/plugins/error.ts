import type { JsErrorPayload, MonitorInstance, Plugin, ResourceErrorPayload } from '@monitor/core'

// ─────────────────────────────────────────────────────────────────────────────
// 错误采集插件
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createErrorPlugin 的配置项
 *
 * 每类采集能力都可以独立开关，方便按项目需求灵活启用。
 * 默认全部开启。
 */
export interface ErrorPluginOptions {
  /**
   * 是否采集 JS 运行时错误（默认 true）
   * 包括：ReferenceError / TypeError / RangeError 等同步抛出的错误
   */
  js?: boolean

  /**
   * 是否采集静态资源加载失败（默认 true）
   * 包括：<img> / <script> / <link> / <audio> / <video> 加载 404 等错误
   */
  resource?: boolean
}

/**
 * 需要监控的资源标签名集合
 *
 * 只监控这几类标签，过滤掉其他元素（如 <div> 的 error 事件，
 * 某些第三方库可能在 div 上 dispatch 自定义 error 事件）。
 */
const MONITORED_TAGS = new Set(['IMG', 'SCRIPT', 'LINK', 'AUDIO', 'VIDEO'])

/**
 * 创建错误采集插件
 *
 * 使用捕获阶段监听（useCapture = true），原因：
 * - JS 运行时错误直接在 window 上派发，冒泡/捕获都可以捕获
 * - 资源加载错误（img/script/link）只在元素本身派发，且不会冒泡
 *   只有捕获阶段（从 window 向下遍历）才能在 window 级别截获
 *
 * 无痕采集：只需注册插件，无需修改任何业务代码
 * 手动埋点：通过 capture('error', payload) 上报自定义业务异常
 *
 * @example
 * ```ts
 * import { init } from '@monitor/browser'
 * import { createErrorPlugin } from '@monitor/browser/plugins/error'
 *
 * init({
 *   dsn: 'http://localhost:3001/collect',
 *   appId: 'my-app',
 *   plugins: [
 *     createErrorPlugin(),                    // 默认全部开启
 *     createErrorPlugin({ resource: false }), // 只采集 JS 错误
 *   ],
 * })
 * ```
 */
export function createErrorPlugin(options: ErrorPluginOptions = {}): Plugin {
  const { js = true, resource = true } = options

  // 持有监听器引用，teardown() 时用于精确移除
  let errorHandler: ((e: ErrorEvent) => void) | null = null

  return {
    name: 'error',

    setup(monitor: MonitorInstance): void {
      errorHandler = (e: ErrorEvent) => {
        const target = e.target as EventTarget

        // ── 资源加载错误 ────────────────────────────────────────────────────
        // 当 e.target 是 HTML 元素（非 window）时，说明是资源加载失败
        if (target instanceof HTMLElement) {
          if (!resource) return
          const tagName = (target as HTMLElement).tagName
          if (!MONITORED_TAGS.has(tagName)) return

          const src =
            (target as HTMLImageElement).src ||
            (target as HTMLScriptElement).src ||
            (target as HTMLLinkElement).href ||
            ''

          const payload: ResourceErrorPayload = {
            subType: 'resource',
            tagName,
            src,
          }
          monitor.capture('error', payload)
          return
        }

        // ── JS 运行时错误 ───────────────────────────────────────────────────
        // target === window（或 null），说明是 JS 运行时抛出的错误
        if (!js) return

        const payload: JsErrorPayload = {
          subType: 'js',
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          // e.error 是 Error 实例，.stack 是调用栈字符串
          // 若没有 Error 实例（如某些跨域脚本 "Script error."），stack 为空字符串
          stack: e.error instanceof Error ? (e.error.stack ?? '') : '',
          // 记录 Error 的具体子类型，便于后端按错误类型聚合统计
          errorType: e.error instanceof Error ? e.error.constructor.name : 'Error',
        }
        monitor.capture('error', payload)
      }

      window.addEventListener('error', errorHandler, true)
    },

    teardown(): void {
      if (errorHandler) {
        window.removeEventListener('error', errorHandler, true)
        errorHandler = null
      }
    },
  }
}
