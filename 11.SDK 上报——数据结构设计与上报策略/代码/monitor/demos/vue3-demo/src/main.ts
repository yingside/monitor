import { createApp } from 'vue'
import {
  init,
  createErrorPlugin,
  createWebVitalsPlugin,
  createBehaviorPlugin,
  createApiPlugin,
} from '@monitor/browser'
import { createMonitorVue } from '@monitor/vue'
import App from './App.vue'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'vue3-demo',
  debug: true,
  sampleRate: 1,

  // ── 第 11 章新增：上报策略配置 ──────────────────────────────────────────
  // 每 5 秒触发一次定时批量上报（默认值，这里显式写出方便对照课件）
  flushInterval: 5000,
  // 队列满 10 条时立即触发上报，不等定时器
  maxBatchSize: 10,

  plugins: [
    // 第 06-07 章：自动采集 JS 错误 + 资源错误 + Promise 未捕获异常
    createErrorPlugin(),

    // 第 08 章：性能指标采集 — 两种实现，接口相同，可以直接互换
    //
    // ① web-vitals 库实现（应该优先使用，Google 官方算法，代码简洁）
    createWebVitalsPlugin(),
    //
    // ② 原生 PerformanceObserver 实现（无代价依赖，深度可定制）
    // createPerformancePlugin(),

    // 第 09 章：用户行为采集 — PV / 点击 / SPA 路由跳转
    createBehaviorPlugin({
      pv: true,           // 自动上报 PV
      click: true,        // 自动采集点击行为（只记录可交互元素）
      routeChange: true,  // 监听 SPA 路由跳转
      maxBreadcrumbs: 20, // 行为栈最多保留 20 条
    }),

    // 第 10 章：API 请求监控 — 自动采集 XHR / Fetch 请求
    createApiPlugin({
      // filterUrls 用于排除不需要监控的接口（如第三方统计、内部健康检查等）
      // DSN 地址 http://localhost:3001/collect 会被自动过滤，无需手动填写
      filterUrls: [],
    }),
  ],
})

createApp(App)
  // 接入 Vue 框架层错误捕获，捕获组件内部（setup/生命周期/渲染）的错误
  .use(createMonitorVue(monitor))
  .mount('#app')
