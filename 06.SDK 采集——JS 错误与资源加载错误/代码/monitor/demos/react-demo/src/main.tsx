import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init, createErrorPlugin } from '@monitor/browser'
import App from './App'

init({
  dsn: 'http://localhost:3001/collect',
  appId: 'react-demo',
  debug: true,
  sampleRate: 1,
  plugins: [
    // 第 06 章：自动采集 JS 运行时错误 + 静态资源加载失败
    // 无需改动任何业务代码，插件通过捕获阶段监听全局 error 事件实现无痕采集
    createErrorPlugin(),
  ],
})

const container = document.getElementById('root')!
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
