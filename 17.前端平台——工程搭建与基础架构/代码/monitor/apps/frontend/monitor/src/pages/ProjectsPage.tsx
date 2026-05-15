import { FolderKanban, Plus, ArrowRight, Globe, Code2, Blocks } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * ProjectsPage —— 项目列表页
 *
 * 第 17 章：展示 UI 骨架与静态 mock 数据，第 18 章接入真实 API。
 *
 * 功能：
 *  - 展示用户所有项目
 *  - 点击项目 → 进入该项目的监控视图
 *  - 创建新项目入口
 */

// Mock 数据（第 18 章替换为 API 数据）
const MOCK_PROJECTS = [
  {
    id: 'proj-001',
    appId: 'vue3-demo',
    name: 'Vue3 Demo',
    description: 'Vue3 接入 SDK 的演示项目',
    platform: 'vue' as const,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'proj-002',
    appId: 'react-demo',
    name: 'React Demo',
    description: 'React 接入 SDK 的演示项目',
    platform: 'react' as const,
    createdAt: '2025-01-02T00:00:00Z',
  },
]

const PLATFORM_ICON = {
  vue: Globe,
  react: Code2,
  web: Blocks,
  angular: Blocks,
  other: Blocks,
}

const PLATFORM_LABEL: Record<string, string> = {
  vue: 'Vue',
  react: 'React',
  web: 'Web',
  angular: 'Angular',
  other: 'Other',
}

export default function ProjectsPage() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">我的项目</h1>
          <p className="text-sm text-muted-foreground mt-1">
            选择一个项目查看监控数据，或创建新项目
          </p>
        </div>
        <Button variant="default" className="gap-2">
          <Plus className="w-4 h-4" />
          新建项目
        </Button>
      </div>

      {/* 项目网格 */}
      {MOCK_PROJECTS.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_PROJECTS.map((project) => {
            const PlatformIcon = PLATFORM_ICON[project.platform] ?? Blocks
            return (
              <button
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}/errors`)}
                className="group text-left rounded-xl border border-border bg-card p-5 hover:border-[#6a5fc1] hover:bg-[#6a5fc1]/5 transition-all duration-200 shadow-card"
              >
                {/* 项目头部 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#6a5fc1]/15 group-hover:bg-[#6a5fc1]/25 transition-colors">
                    <PlatformIcon className="w-5 h-5 text-[#6a5fc1]" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#6a5fc1] group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* 项目名 */}
                <h3 className="font-semibold text-foreground text-base mb-1">{project.name}</h3>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {project.description}
                </p>

                {/* 元数据 */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {PLATFORM_LABEL[project.platform]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {project.appId}
                  </span>
                </div>
              </button>
            )
          })}

          {/* 添加项目卡片 */}
          <button className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-border hover:border-[#6a5fc1] bg-transparent p-5 transition-all duration-200 min-h-[150px]">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted group-hover:bg-[#6a5fc1]/15 transition-colors mb-3">
              <Plus className="w-5 h-5 text-muted-foreground group-hover:text-[#6a5fc1] transition-colors" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              添加项目
            </span>
          </button>
        </div>
      ) : (
        /* 空状态 */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
          <FolderKanban className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">还没有项目</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
            创建你的第一个项目，开始接入 SDK，实时监控前端应用
          </p>
          <Button variant="default" className="gap-2">
            <Plus className="w-4 h-4" />
            创建第一个项目
          </Button>
        </div>
      )}
    </div>
  )
}
