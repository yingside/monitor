import {
  createBrowserRouter,
  Navigate,
  Outlet,
} from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import AppShell from '@/components/layout/AppShell'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ErrorsPage from '@/pages/errors/ErrorsPage'
import PerformancePage from '@/pages/performance/PerformancePage'
import BehaviorsPage from '@/pages/behaviors/BehaviorsPage'
import ApisPage from '@/pages/apis/ApisPage'
import NotFoundPage from '@/pages/NotFoundPage'

/**
 * AuthGuard —— 认证路由守卫
 *
 * 未登录时跳转 /login，已登录时渲染子路由（<Outlet />）。
 *
 * 📌 为什么在路由层做守卫而不是在组件内？
 *  - 路由层守卫是声明式的：在路由表中一眼看出哪些路由需要登录
 *  - 组件内做跳转需要 useEffect + navigate，存在闪烁问题
 *  - 路由层守卫在渲染前就决定走哪条分支，不会有视觉闪烁
 */
function AuthGuard() {
  const token = useAuthStore((s) => s.token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

/**
 * GuestGuard —— 访客路由守卫
 *
 * 已登录用户访问 /login 或 /register 时，直接跳到 /projects。
 */
function GuestGuard() {
  const token = useAuthStore((s) => s.token)
  if (token) {
    return <Navigate to="/projects" replace />
  }
  return <Outlet />
}

/**
 * 路由表设计说明：
 *
 * /                         → 重定向到 /projects（需登录）
 * /login                    → 登录页（未登录可访问，已登录跳 /projects）
 * /register                 → 注册页（同上）
 * /projects                 → 项目列表（需登录）
 * /projects/:projectId      → 重定向到 /projects/:projectId/errors（默认视图）
 * /projects/:projectId/errors      → 错误监控
 * /projects/:projectId/performance → 性能监控
 * /projects/:projectId/behaviors   → 用户行为
 * /projects/:projectId/apis        → API 监控
 * *                         → 404
 *
 * AppShell 作为嵌套布局：包含 Sidebar + Header + 内容区域
 * 所有需要登录且有侧边栏的页面都嵌套在 AppShell 之下
 */
const routes = [
  // ── 根路由：自动重定向 ───────────────────────────────────────────────────────
  {
    path: '/',
    element: <Navigate to="/projects" replace />,
  },

  // ── 访客路由（已登录跳转）──────────────────────────────────────────────────
  {
    element: <GuestGuard />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },

  // ── 受保护路由（需登录）──────────────────────────────────────────────────────
  {
    element: <AuthGuard />,
    children: [
      {
        // AppShell 作为嵌套布局容器（包含 Sidebar + Header）
        element: <AppShell />,
        children: [
          // 项目列表
          { path: '/projects', element: <ProjectsPage /> },

          // 项目看板 —— 默认重定向到错误监控
          {
            path: '/projects/:projectId',
            element: <Navigate to="errors" replace />,
          },

          // 各监控视图
          { path: '/projects/:projectId/errors', element: <ErrorsPage /> },
          { path: '/projects/:projectId/performance', element: <PerformancePage /> },
          { path: '/projects/:projectId/behaviors', element: <BehaviorsPage /> },
          { path: '/projects/:projectId/apis', element: <ApisPage /> },

          // 平台总览（跨项目汇总，第 19 章起实现）
          { path: '/dashboard', element: <DashboardPage /> },
        ],
      },
    ],
  },

  // ── 404 ─────────────────────────────────────────────────────────────────────
  { path: '*', element: <NotFoundPage /> },
]

const router = createBrowserRouter(routes)

export default router
