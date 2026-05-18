import { useEffect } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import Sidebar from './Sidebar'
import Header from './Header'
import { useProjectStore } from '@/stores/project.store'

/**
 * AppShell —— 应用主布局壳
 *
 * 视觉结构：
 * ┌──────────┬─────────────────────────────────────┐
 * │          │          Header (h-14)               │
 * │          ├─────────────────────────────────────┤
 * │ Sidebar  │                                      │
 * │ (240px)  │          <Outlet /> (内容区)         │
 * │          │                                      │
 * └──────────┴─────────────────────────────────────┘
 *
 * - Sidebar 固定宽度 240px，高度 100vh
 * - 右侧内容区 flex-1，overflow-auto（允许内容滚动）
 * - TooltipProvider 包裹全局（Radix Tooltip 需要 Provider 在树上层）
 *
 * projectId 同步：
 *  当 URL 中有 :projectId 时，同步到 project store，
 *  确保 Sidebar 的项目切换器能显示正确状态。
 */
export default function AppShell() {
  const { projectId } = useParams()
  const { currentProjectId, setCurrentProjectId } = useProjectStore()

  // URL 参数与 store 同步：URL 优先
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      setCurrentProjectId(projectId)
    }
  }, [projectId, currentProjectId, setCurrentProjectId])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full bg-background">
        {/* 侧边栏 */}
        <Sidebar />

        {/* 右侧主区域 */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* 顶部导航 */}
          <Header />

          {/* 内容区 */}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
