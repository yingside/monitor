import type {
  JsErrorPayload,
  MonitorInstance,
  Plugin,
  PromiseErrorPayload,
  ResourceErrorPayload,
} from '@monitor/core'

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

  /**
   * 是否采集 Promise 未捕获异常（默认 true）
   * 对应 window 的 unhandledrejection 事件：
   * Promise reject 后没有 .catch() / try-catch 处理时触发
   */
  promise?: boolean

  /**
   * 错误去重时间窗口（毫秒，默认 1000）
   * 同一条错误（相同指纹）在此时间窗口内只上报一次，
   * 防止同一错误被循环触发时刷爆上报队列
   * 设为 0 表示关闭去重
   */
  dedupWindow?: number
}

/**
 * 需要监控的资源标签名集合
 *
 * 只监控这几类标签，过滤掉其他元素（如 <div> 的 error 事件，
 * 某些第三方库可能在 div 上 dispatch 自定义 error 事件）。
 */
const MONITORED_TAGS = new Set(['IMG', 'SCRIPT', 'LINK', 'AUDIO', 'VIDEO'])

/**
 * 计算错误指纹
 *
 * 指纹用于去重：同一个错误通常具有相同的 message + filename + lineno 组合。
 * 使用竖线分隔，避免不同字段拼接时产生碰撞（如 "a" + "|b" vs "a|" + "b"）。
 */
function computeFingerprint(message: string, filename: string, lineno: number | string): string {
  return `${message}|${filename}|${lineno}`
}

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
 *     createErrorPlugin(),                              // 默认全部开启
 *     createErrorPlugin({ resource: false }),           // 只采集 JS + Promise 错误
 *     createErrorPlugin({ dedupWindow: 5000 }),         // 5 秒内相同错误只上报一次
 *   ],
 * })
 * ```
 */
export function createErrorPlugin(options: ErrorPluginOptions = {}): Plugin {
  const { js = true, resource = true, promise = true, dedupWindow = 1000 } = options

  // 持有监听器引用，teardown() 时用于精确移除
  let errorHandler: ((e: ErrorEvent) => void) | null = null
  let rejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null

  /**
   * 错误去重表
   * key：错误指纹（message|filename|lineno）
   * value：上次上报时间戳（Date.now()）
   *
   * 用 Map 而不是 Set：Map 可以存储"上次上报时间"，
   * 支持"时间窗口"去重（超过窗口期的相同错误重新上报），
   * 而不是永久去重（否则短暂修复后引入的新错误可能被误去重）。
   */
  const dedupMap = new Map<string, number>()

  /**
   * 检查是否应该去重（跳过本次上报）
   * @returns true 表示应去重（跳过），false 表示正常上报
   */
  function shouldDeduplicate(fingerprint: string): boolean {
    if (dedupWindow <= 0) return false
    const lastTime = dedupMap.get(fingerprint)
    const now = Date.now()
    if (lastTime !== undefined && now - lastTime < dedupWindow) {
      return true // 在去重窗口内，跳过
    }
    dedupMap.set(fingerprint, now)
    return false
  }

  return {
    name: 'error',

    setup(monitor: MonitorInstance): void {
      // ── 监听器 1：JS 运行时错误 + 资源加载错误 ────────────────────────────
      errorHandler = (e: ErrorEvent) => {
        const target = e.target as EventTarget

        // ── 资源加载错误 ──────────────────────────────────────────────────
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

          // 资源错误指纹：标签名 + 资源地址
          const fingerprint = computeFingerprint(`resource:${tagName}`, src, 0)
          if (shouldDeduplicate(fingerprint)) return

          const payload: ResourceErrorPayload = {
            subType: 'resource',
            tagName,
            src,
          }
          monitor.capture('error', payload)
          return
        }

        // ── JS 运行时错误 ─────────────────────────────────────────────────
        // target === window（或 null），说明是 JS 运行时抛出的错误
        if (!js) return

        const fingerprint = computeFingerprint(e.message, e.filename, e.lineno)
        if (shouldDeduplicate(fingerprint)) return

        const payload: JsErrorPayload = {
          subType: 'js',
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error instanceof Error ? (e.error.stack ?? '') : '',
          errorType: e.error instanceof Error ? e.error.constructor.name : 'Error',
        }
        monitor.capture('error', payload)
      }

      window.addEventListener('error', errorHandler, true)

      // ── 监听器 2：Promise 未捕获异常 ──────────────────────────────────────
      if (promise) {
        rejectionHandler = (e: PromiseRejectionEvent) => {
          const reason: unknown = e.reason
          const isError = reason instanceof Error

          const message = isError ? reason.message : String(reason)
          const stack = isError ? (reason.stack ?? '') : ''

          // Promise 错误通常没有文件名和行号，用 'promise' 作为 filename 占位
          const fingerprint = computeFingerprint(message, 'promise', 0)
          if (shouldDeduplicate(fingerprint)) return

          const payload: PromiseErrorPayload = {
            subType: 'promise',
            message,
            stack,
            reason,
          }
          monitor.capture('error', payload)
        }

        window.addEventListener('unhandledrejection', rejectionHandler)
      }
    },

    teardown(): void {
      if (errorHandler) {
        window.removeEventListener('error', errorHandler, true)
        errorHandler = null
      }
      if (rejectionHandler) {
        window.removeEventListener('unhandledrejection', rejectionHandler)
        rejectionHandler = null
      }
      // 清空去重表，释放内存
      dedupMap.clear()
    },
  }
}
