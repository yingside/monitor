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

  // future={{ v7_startTransition: true }}：消除 React Router v6 的 Future Flag 警告
  // createBrowserRouter 的 future 选项控制路由内部行为；
  // RouterProvider 的 future prop 控制组件渲染阶段的 startTransition 包裹
  // 两处都需要配置，缺一会继续出现警告
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />
}
