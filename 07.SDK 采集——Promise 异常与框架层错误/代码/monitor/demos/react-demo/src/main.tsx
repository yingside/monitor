import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init, createErrorPlugin } from '@monitor/browser'
import { MonitorErrorBoundary } from '@monitor/react'
import App from './App'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'react-demo',
  debug: true,
  sampleRate: 1,
  plugins: [
    // 自动采集：JS 运行时错误 + 资源加载失败 + Promise 未捕获异常
    createErrorPlugin(),
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

