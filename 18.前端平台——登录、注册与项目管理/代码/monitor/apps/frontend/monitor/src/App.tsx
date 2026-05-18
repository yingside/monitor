import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import { useThemeStore } from './stores/theme.store'

/**
 * App 根组件
 *
 * 第 17 章开始，App.tsx 只负责挂载 RouterProvider。
 * 路由表（认证守卫 + 布局嵌套 + 页面映射）集中在 router/index.tsx 中维护。
 *
 * 主题管理：
 *  从 useThemeStore 读取当前主题，同步到 <html> 元素的 class，
 *  触发 CSS 变量（html.light / 默认暗色）切换。
 */
export default function App() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  return <RouterProvider router={router} />
}
