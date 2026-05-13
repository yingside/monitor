import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  init,
  createErrorPlugin,
  createWebVitalsPlugin,
  createBehaviorPlugin,
  createApiPlugin,
} from '@monitor/browser'
import { MonitorErrorBoundary } from '@monitor/react'
import App from './App'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'react-demo',
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
      // DSN 地址 http://localhost:3001/collect 会被自动过滤，无需手动填写
      filterUrls: [],
    }),
  ],
})

const container = document.getElementById('root')!
createRoot(container).render(
  // MonitorErrorBoundary 放在 StrictMode 外层：
  // StrictMode 在开发模式下会双重调用某些生命周期，
  // 如果放在内层，ErrorBoundary 的 componentDidCatch 可能被调用两次
  <MonitorErrorBoundary monitor={monitor}>
    <StrictMode>
      <App />
    </StrictMode>
  </MonitorErrorBoundary>,
)

