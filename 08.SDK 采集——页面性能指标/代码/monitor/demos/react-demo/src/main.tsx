import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init, createErrorPlugin, createWebVitalsPlugin } from '@monitor/browser'
import { MonitorErrorBoundary } from '@monitor/react'
import App from './App'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'react-demo',
  debug: true,
  sampleRate: 1,
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

