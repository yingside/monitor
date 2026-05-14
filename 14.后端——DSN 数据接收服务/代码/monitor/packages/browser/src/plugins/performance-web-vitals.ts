import { onFCP, onLCP, onCLS, onINP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'
import type { MonitorInstance, NavigationTimingPayload, PerformanceMetricPayload, Plugin } from '@monitor/core'

// ─────────────────────────────────────────────────────────────────────────────
// 配置项（与原生实现保持相同的接口，做到无缝替换）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createWebVitalsPlugin 的配置项
 *
 * 与 createPerformancePlugin 接口一致，可以直接互换：
 * - createPerformancePlugin()  → 原生 PerformanceObserver 实现
 * - createWebVitalsPlugin()    → web-vitals 库实现
 *
 * 插件对外表现完全相同（相同的事件类型、相同的 payload 结构）。
 */
export interface WebVitalsPluginOptions {
  /**
   * 是否采集 Core Web Vitals（默认 true）
   * 包含：FCP / LCP / CLS / INP / TTFB
   */
  vitals?: boolean

  /**
   * 是否采集导航时序（默认 true）
   * 基于 Navigation Timing Level 2 读取各阶段耗时
   * 注意：web-vitals 库本身不提供导航时序，此项仍用原生 API 读取
   */
  navigation?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Rating 转换
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 将 web-vitals 的 rating 字段映射到 SDK 的 rating 类型
 *
 * web-vitals 的 rating 已经是 'good' | 'needs-improvement' | 'poor'，
 * 与 SDK 类型完全一致，此处做显式转换保留类型安全。
 */
function toRating(rating: Metric['rating']): 'good' | 'needs-improvement' | 'poor' {
  return rating
}

// ─────────────────────────────────────────────────────────────────────────────
// 插件工厂
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 使用 web-vitals 库创建性能采集插件
 *
 * web-vitals 是 Google 官方维护的 Core Web Vitals 采集库，提供：
 * - 与 Chrome UX Report 一致的指标计算逻辑
 * - 严格的 INP p98 百分位算法（比原生实现更精准）
 * - 自动处理各种边界情况（prefetch、bfcache 等）
 *
 * 与 createPerformancePlugin 的区别：
 * | 对比项     | createPerformancePlugin | createWebVitalsPlugin  |
 * |-----------|------------------------|------------------------|
 * | 外部依赖   | 无                     | web-vitals (~2.6KB gz) |
 * | 代码量     | ~250 行                | ~40 行                 |
 * | INP 精度   | 简化（取最大值）         | 严格 p98 算法           |
 * | 边界处理   | 需自行维护              | Google 官方维护         |
 * | 适合场景   | 教学 / 深度定制         | 生产环境首选            |
 *
 * @example
 * ```ts
 * import { init } from '@monitor/browser'
 * import { createWebVitalsPlugin } from '@monitor/browser'
 *
 * // 直接替换 createPerformancePlugin，接入方无需改动任何其他代码
 * init({
 *   dsn: 'http://localhost:3001/collect',
 *   appId: 'my-app',
 *   debug: true,
 *   plugins: [
 *     createWebVitalsPlugin(),
 *   ],
 * })
 * ```
 */
export function createWebVitalsPlugin(options: WebVitalsPluginOptions = {}): Plugin {
  const { vitals = true, navigation = true } = options

  return {
    name: 'performance',   // 与原生插件同名，体现"相同能力，不同实现"

    setup(monitor: MonitorInstance): void {
      // ── Core Web Vitals（由 web-vitals 库处理所有边界情况）────────────────
      if (vitals) {
        // web-vitals 的每个 on*() 函数：
        // - 在指标首次就绪时回调
        // - 内部已处理 buffered / visibilitychange / bfcache 等时机
        // - metric.navigationType 与 Navigation Timing Level 2 的 type 对应

        onFCP((metric) => {
          const payload: PerformanceMetricPayload = {
            subType: 'web-vital',
            metric: 'FCP',
            value: Math.round(metric.value),
            rating: toRating(metric.rating),
            navigationType: metric.navigationType,
          }
          monitor.capture('performance', payload)
        })

        onLCP((metric) => {
          const payload: PerformanceMetricPayload = {
            subType: 'web-vital',
            metric: 'LCP',
            value: Math.round(metric.value),
            rating: toRating(metric.rating),
            navigationType: metric.navigationType,
          }
          monitor.capture('performance', payload)
        })

        onCLS((metric) => {
          const payload: PerformanceMetricPayload = {
            subType: 'web-vital',
            metric: 'CLS',
            // CLS 保留 4 位小数
            value: Math.round(metric.value * 10000) / 10000,
            rating: toRating(metric.rating),
            navigationType: metric.navigationType,
          }
          monitor.capture('performance', payload)
        })

        onINP((metric) => {
          const payload: PerformanceMetricPayload = {
            subType: 'web-vital',
            metric: 'INP',
            value: Math.round(metric.value),
            rating: toRating(metric.rating),
            navigationType: metric.navigationType,
          }
          monitor.capture('performance', payload)
        })

        onTTFB((metric) => {
          const payload: PerformanceMetricPayload = {
            subType: 'web-vital',
            metric: 'TTFB',
            value: Math.round(metric.value),
            rating: toRating(metric.rating),
            navigationType: metric.navigationType,
          }
          monitor.capture('performance', payload)
        })
      }

      // ── Navigation Timing（web-vitals 不提供，仍用原生 API）───────────────
      if (navigation) {
        const reportNavTiming = () => {
          const nav = performance.getEntriesByType(
            'navigation',
          )[0] as PerformanceNavigationTiming | undefined
          if (!nav) return

          const payload: NavigationTimingPayload = {
            subType: 'navigation-timing',
            dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            tcp: Math.round(nav.connectEnd - nav.connectStart),
            ssl:
              nav.secureConnectionStart > 0
                ? Math.round(nav.connectEnd - nav.secureConnectionStart)
                : 0,
            ttfb: Math.round(nav.responseStart - nav.fetchStart),
            download: Math.round(nav.responseEnd - nav.responseStart),
            domInteractive: Math.round(nav.domInteractive - nav.fetchStart),
            domComplete: Math.round(nav.domComplete - nav.fetchStart),
            loadTime: Math.round(nav.loadEventEnd - nav.fetchStart),
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

    // web-vitals 的 on*() 回调注册后无法取消，teardown 不处理 vitals
    // 在 SPA 中如果需要按页面采集，建议使用 web-vitals 的 reportAllChanges 选项
    teardown(): void {
      // navigation timing 使用了一次性 addEventListener，无需手动清理
    },
  }
}
