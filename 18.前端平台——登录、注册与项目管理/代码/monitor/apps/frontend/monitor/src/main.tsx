import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'

/**
 * TanStack Query 全局配置
 *
 * QueryClient 是 TanStack Query 的核心实例，负责管理所有请求的缓存。
 * 创建时可配置全局默认行为：
 *  - retry: 1        请求失败后最多重试 1 次（默认 3 次，对监控数据来说太频繁）
 *  - staleTime: 0    数据立即视为"陈旧"，切换页面时会重新请求（具体 hook 可覆盖）
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, // 切换窗口不自动重新请求（避免干扰开发调试）
    },
  },
})

const container = document.getElementById('root')!
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
