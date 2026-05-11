// ─────────────────────────────────────────────────────────────────────────────
// @monitor/vue — Vue3 框架适配层
//
// 职责：通过 app.config.errorHandler 捕获 Vue 组件内部抛出的错误，
//       将其转换为 FrameworkErrorPayload 并交给 Monitor 核心数据管道处理。
//
// 使用方式：
//   const monitor = init({ dsn: '...', appId: '...' })
//   createApp(App).use(createMonitorVue(monitor)).mount('#app')
// ─────────────────────────────────────────────────────────────────────────────

import type { App, ComponentPublicInstance } from 'vue'
import type { FrameworkErrorPayload, MonitorInstance } from '@monitor/core'

/**
 * Vue3 插件接口（最小定义）
 *
 * 只需要 install 方法，与 Vue3 的 Plugin 接口兼容。
 * 不直接 import Vue 的 Plugin 类型，减少对 vue 类型版本的耦合。
 */
interface VuePlugin {
  install(app: App): void
}

/**
 * 创建 Vue3 框架错误捕获插件
 *
 * 通过 Vue 的 app.config.errorHandler 捕获所有组件内部错误，包括：
 * - setup() / 生命周期钩子（mounted、updated 等）中抛出的错误
 * - 模板渲染（render 函数）中的错误
 * - 事件处理器（@click 等）中的错误（Vue 3.0+ 支持）
 *
 * 注意：此 handler 会接管 Vue 的默认错误处理，
 * Vue 不会再将错误打印到控制台（已在 handler 内保留 console.error 输出）。
 *
 * @param monitor - Monitor 实例，由 init() 返回
 *
 * @example
 * ```ts
 * import { init, createErrorPlugin } from '@monitor/browser'
 * import { createMonitorVue } from '@monitor/vue'
 * import { createApp } from 'vue'
 * import App from './App.vue'
 *
 * const monitor = init({
 *   dsn: 'http://localhost:3001/collect',
 *   appId: 'vue3-demo',
 *   plugins: [createErrorPlugin()],
 * })
 *
 * createApp(App).use(createMonitorVue(monitor)).mount('#app')
 * ```
 */
export function createMonitorVue(monitor: MonitorInstance): VuePlugin {
  return {
    install(app: App): void {
      app.config.errorHandler = (
        err: unknown,
        instance: ComponentPublicInstance | null,
        info: string,
      ): void => {
        const error = err instanceof Error ? err : new Error(String(err))

        // 尝试获取组件名称，优先级：
        // 1. Options API 的 name 选项
        // 2. <script setup> 中 vite-plugin-vue 注入的 __name
        // 3. 回退到 Vue 提供的 info 字符串（如 "mounted hook"）
        const componentName: string =
          (instance?.$options?.name as string | undefined) ??
          ((instance?.$.type as Record<string, unknown>)?.__name as string | undefined) ??
          info

        const payload: FrameworkErrorPayload = {
          subType: 'vue',
          message: error.message,
          stack: error.stack ?? '',
          componentInfo: componentName,
        }

        monitor.capture('error', payload)

        // 保留控制台输出，方便开发时定位问题
        if (monitor.options.debug) {
          console.error('[Monitor][Vue] Component error captured:', error, '\nComponent:', componentName, '\nInfo:', info)
        }
      }
    },
  }
}

