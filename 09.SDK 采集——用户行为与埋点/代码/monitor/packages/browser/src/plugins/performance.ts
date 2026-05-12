import type {
  MonitorInstance,
  NavigationTimingPayload,
  PerformanceMetricPayload,
  Plugin,
} from '@monitor/core'

// ─────────────────────────────────────────────────────────────────────────────
// 配置项
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createPerformancePlugin 的配置项
 *
 * 分为两大类采集能力：
 * - vitals：Core Web Vitals（FCP / LCP / CLS / INP / TTFB）
 * - navigation：页面导航时序（DNS / TCP / TTFB / DOM 解析 / 加载完成等阶段耗时）
 *
 * 两者可独立开关，默认都开启。
 */
export interface PerformancePluginOptions {
  /**
   * 是否采集 Core Web Vitals（默认 true）
   * 包含：FCP / LCP / CLS / INP / TTFB
   */
  vitals?: boolean

  /**
   * 是否采集导航时序（默认 true）
   * 将 PerformanceNavigationTiming 各阶段计算后上报，
   * 可直观看出哪个阶段最耗时（DNS 慢 / 服务端慢 / DOM 解析慢等）
   */
  navigation?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Vitals 官方阈值（Google 2024 版本）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 每个指标的 [good 上限, needs-improvement 上限]
 *
 * 超出 needs-improvement 上限即为 poor。
 * CLS 为无单位比值，其余单位为毫秒（ms）。
 *
 * 来源：https://web.dev/articles/vitals
 */
const VITALS_THRESHOLDS: Record<string, [number, number]> = {
  FCP: [1800, 3000],
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  TTFB: [800, 1800],
}

type Rating = 'good' | 'needs-improvement' | 'poor'

/**
 * 根据指标名和测量值，返回 Google 官方评级
 */
function getRating(metric: string, value: number): Rating {
  const thresholds = VITALS_THRESHOLDS[metric]
  if (!thresholds) return 'good'
  if (value <= thresholds[0]) return 'good'
  if (value <= thresholds[1]) return 'needs-improvement'
  return 'poor'
}

/**
 * 获取当前页面的导航类型（navigate / reload / back_forward / prerender）
 *
 * 在上报 Core Web Vitals 时一并记录，方便后续按导航类型过滤数据。
 * 例如：reload 时的 LCP 通常比 navigate 更快（有缓存），
 * 混在一起会影响真实首屏性能分析。
 */
function getNavigationType(): string {
  const nav = performance.getEntriesByType(
    'navigation',
  )[0] as PerformanceNavigationTiming | undefined
  return nav?.type ?? 'navigate'
}

// ─────────────────────────────────────────────────────────────────────────────
// 插件工厂
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建性能采集插件
 *
 * 使用浏览器原生 PerformanceObserver API 进行采集，无需额外依赖。
 *
 * 采集时机说明：
 * - FCP：页面绘制完成时立即上报（通常在页面加载后几百毫秒）
 * - LCP：等待首次用户交互或页面隐藏时上报（LCP 可能随用户滚动更新）
 * - CLS：页面隐藏时上报最终累积值（使用 Session Window 算法）
 * - INP：页面隐藏时上报最大交互延迟
 * - TTFB：DOM Ready 后立即从 NavigationTiming 读取
 * - Navigation Timing：页面 load 事件触发后读取完整时序数据
 *
 * @example
 * ```ts
 * import { init } from '@monitor/browser'
 * import { createPerformancePlugin } from '@monitor/browser'
 *
 * init({
 *   dsn: 'http://localhost:3001/collect',
 *   appId: 'my-app',
 *   debug: true,
 *   plugins: [
 *     createPerformancePlugin(),                          // 全部开启
 *     createPerformancePlugin({ navigation: false }),     // 只采集 Web Vitals
 *   ],
 * })
 * ```
 */
export function createPerformancePlugin(options: PerformancePluginOptions = {}): Plugin {
  const { vitals = true, navigation = true } = options

  // 持有所有 PerformanceObserver 实例，teardown() 时统一断开
  const observers: PerformanceObserver[] = []

  return {
    name: 'performance',

    setup(monitor: MonitorInstance): void {
      // PerformanceObserver 不支持的旧版浏览器直接跳过，不报错
      if (typeof PerformanceObserver === 'undefined') return

      // ── Core Web Vitals ────────────────────────────────────────────────────
      if (vitals) {
        // ① FCP — First Contentful Paint（首次内容绘制）
        //    页面从白屏到出现任何文字/图片的时间
        //    paint entry 包含 first-paint 和 first-contentful-paint 两条记录
        _observeSafely(
          () => {
            const obs = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                  const payload: PerformanceMetricPayload = {
                    subType: 'web-vital',
                    metric: 'FCP',
                    value: Math.round(entry.startTime),
                    rating: getRating('FCP', entry.startTime),
                    navigationType: getNavigationType(),
                  }
                  monitor.capture('performance', payload)
                  obs.disconnect()
                }
              }
            })
            obs.observe({ type: 'paint', buffered: true })
            observers.push(obs)
          },
        )

        // ② LCP — Largest Contentful Paint（最大内容绘制）
        //    LCP 的值随着页面渲染持续更新（新的大图/标题可能替换旧值），
        //    必须等到用户第一次交互或页面隐藏时才能确定最终值。
        _observeSafely(
          () => {
            let latestLCPValue: number | null = null
            const lcpObs = new PerformanceObserver((list) => {
              const entries = list.getEntries()
              const last = entries[entries.length - 1]
              if (last) latestLCPValue = last.startTime
            })
            lcpObs.observe({ type: 'largest-contentful-paint', buffered: true })
            observers.push(lcpObs)

            const reportLCP = () => {
              if (latestLCPValue === null) return
              const payload: PerformanceMetricPayload = {
                subType: 'web-vital',
                metric: 'LCP',
                value: Math.round(latestLCPValue),
                rating: getRating('LCP', latestLCPValue),
                navigationType: getNavigationType(),
              }
              monitor.capture('performance', payload)
              latestLCPValue = null
              lcpObs.disconnect()
            }

            // 用户点击 / 键盘 / 页面隐藏 → 锁定 LCP 最终值
            addEventListener('click', reportLCP, { once: true, capture: true })
            addEventListener('keydown', reportLCP, { once: true, capture: true })
            addEventListener(
              'visibilitychange',
              () => { if (document.visibilityState === 'hidden') reportLCP() },
              { once: true },
            )
          },
        )

        // ③ CLS — Cumulative Layout Shift（累积布局偏移）
        //    使用 Session Window 算法：间隔 >= 1000ms 或总时长 > 5000ms 时开新窗口；
        //    取所有窗口中最大值作为 CLS。
        _observeSafely(
          () => {
            let clsValue = 0
            let sessionValue = 0
            let sessionEntries: PerformanceEntry[] = []

            const clsObs = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                // layout-shift entry 的类型扩展
                const ls = entry as PerformanceEntry & {
                  hadRecentInput: boolean
                  value: number
                }
                // hadRecentInput = true 表示 500ms 内有用户输入，排除此类布局偏移
                if (ls.hadRecentInput) continue

                const firstEntry = sessionEntries[0]
                const lastEntry = sessionEntries[sessionEntries.length - 1]
                if (
                  sessionEntries.length === 0 ||
                  (lastEntry && entry.startTime - lastEntry.startTime < 1000) &&
                  (firstEntry && entry.startTime - firstEntry.startTime < 5000)
                ) {
                  // 当前偏移加入当前会话窗口
                  sessionValue += ls.value
                  sessionEntries.push(entry)
                } else {
                  // 开启新的会话窗口
                  sessionValue = ls.value
                  sessionEntries = [entry]
                }
                clsValue = Math.max(clsValue, sessionValue)
              }
            })
            clsObs.observe({ type: 'layout-shift', buffered: true })
            observers.push(clsObs)

            addEventListener(
              'visibilitychange',
              () => {
                if (document.visibilityState === 'hidden') {
                  const payload: PerformanceMetricPayload = {
                    subType: 'web-vital',
                    metric: 'CLS',
                    // 保留 4 位小数，CLS 通常是 0.xxx 的小数
                    value: Math.round(clsValue * 10000) / 10000,
                    rating: getRating('CLS', clsValue),
                    navigationType: getNavigationType(),
                  }
                  monitor.capture('performance', payload)
                }
              },
              { once: true },
            )
          },
        )

        // ④ INP — Interaction to Next Paint（交互响应延迟）
        //    INP 是 FID 的继任者（2024 年正式成为 Core Web Vitals）
        //    测量用户每次交互（点击/键盘/触摸）从输入到下一帧绘制的延迟
        //    取所有交互中的 p98（简化实现：取最大值）
        _observeSafely(
          () => {
            let maxINP = 0

            const inpObs = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                // event-timing entry 类型扩展
                const ev = entry as PerformanceEntry & {
                  processingStart: number
                  duration: number
                  interactionId?: number
                }
                // interactionId > 0 说明是用户主动触发的交互（而非合成事件）
                if ((ev.interactionId ?? 0) > 0) {
                  // INP = 输入延迟 + 处理时间 + 展示延迟 ≈ entry.duration
                  maxINP = Math.max(maxINP, ev.duration)
                }
              }
            })
            // durationThreshold: 16 → 仅采集超过一帧（约 16ms）的事件
            // 注意：Event Timing API 扩展了 PerformanceObserverInit，TypeScript 标准
            // lib 尚未包含 durationThreshold，需要通过类型断言绕过检查
            inpObs.observe({
              type: 'event',
              durationThreshold: 16,
              buffered: true,
            } as PerformanceObserverInit)
            observers.push(inpObs)

            addEventListener(
              'visibilitychange',
              () => {
                if (document.visibilityState === 'hidden' && maxINP > 0) {
                  const payload: PerformanceMetricPayload = {
                    subType: 'web-vital',
                    metric: 'INP',
                    value: Math.round(maxINP),
                    rating: getRating('INP', maxINP),
                    navigationType: getNavigationType(),
                  }
                  monitor.capture('performance', payload)
                }
              },
              { once: true },
            )
          },
        )

        // ⑤ TTFB — Time to First Byte（首字节时间）
        //    直接从 NavigationTiming 读取，等 DOM 就绪后上报
        //    TTFB = responseStart - fetchStart（含重定向时间）
        const reportTTFB = () => {
          const navEntry = performance.getEntriesByType(
            'navigation',
          )[0] as PerformanceNavigationTiming | undefined
          if (!navEntry) return

          // responseStart < 1 说明数据还未就绪（某些浏览器 bug）
          if (navEntry.responseStart < 1) return

          const ttfb = navEntry.responseStart - navEntry.fetchStart
          const payload: PerformanceMetricPayload = {
            subType: 'web-vital',
            metric: 'TTFB',
            value: Math.round(ttfb),
            rating: getRating('TTFB', ttfb),
            navigationType: navEntry.type ?? 'navigate',
          }
          monitor.capture('performance', payload)
        }

        if (document.readyState === 'complete') {
          reportTTFB()
        } else {
          addEventListener('load', reportTTFB, { once: true })
        }
      }

      // ── Navigation Timing ─────────────────────────────────────────────────
      if (navigation) {
        const reportNavTiming = () => {
          const navEntry = performance.getEntriesByType(
            'navigation',
          )[0] as PerformanceNavigationTiming | undefined
          if (!navEntry) return

          const payload: NavigationTimingPayload = {
            subType: 'navigation-timing',
            dns: Math.round(navEntry.domainLookupEnd - navEntry.domainLookupStart),
            tcp: Math.round(navEntry.connectEnd - navEntry.connectStart),
            // secureConnectionStart 为 0 表示非 HTTPS
            ssl:
              navEntry.secureConnectionStart > 0
                ? Math.round(navEntry.connectEnd - navEntry.secureConnectionStart)
                : 0,
            ttfb: Math.round(navEntry.responseStart - navEntry.fetchStart),
            download: Math.round(navEntry.responseEnd - navEntry.responseStart),
            domInteractive: Math.round(navEntry.domInteractive - navEntry.fetchStart),
            domComplete: Math.round(navEntry.domComplete - navEntry.fetchStart),
            loadTime: Math.round(navEntry.loadEventEnd - navEntry.fetchStart),
          }
          monitor.capture('performance', payload)
        }

        if (document.readyState === 'complete') {
          reportNavTiming()
        } else {
          addEventListener('load', reportNavTiming, { once: true })
        }
      }
    },

    teardown(): void {
      for (const obs of observers) {
        obs.disconnect()
      }
      observers.length = 0
    },
  }
}

/**
 * 安全执行 PerformanceObserver 注册
 *
 * 部分旧版浏览器虽然有 PerformanceObserver 但不支持某些 entry type，
 * observe() 会抛出 DOMException。用 try-catch 静默处理，
 * 不影响其他 observer 的注册。
 */
function _observeSafely(fn: () => void): void {
  try {
    fn()
  } catch {
    // 浏览器不支持该 entry type，静默忽略
  }
}
