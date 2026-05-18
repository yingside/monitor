import { useState } from 'react'
import { FolderKanban, Plus, ArrowRight, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProjects } from '@/hooks/useProjects'
import { useProjectStore } from '@/stores/project.store'
import { PLATFORM_CONFIG } from '@/lib/platform-config'
import ProjectFormDialog from '@/components/project/ProjectFormDialog'
import DeleteProjectDialog from '@/components/project/DeleteProjectDialog'
import type { Project } from '@/types/project'

/**
 * ProjectsPage —— 项目列表页（第 18 章：接入真实 API + 完整 CRUD）
 *
 * 第 17 章：展示 UI 骨架与静态 Mock 数据
 * 第 18 章：
 *  - 使用 useProjects（TanStack Query useQuery）替换 Mock 数据
 *  - 新建项目：点击"新建项目"或空状态按钮，弹出 ProjectFormDialog
 *  - 编辑项目：每个项目卡片右上角 ⋯ 菜单 → 编辑
 *  - 删除项目：⋯ 菜单 → 删除，触发 DeleteProjectDialog 二次确认
 */

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { setCurrentProject } = useProjectStore()

  // TanStack Query：获取项目列表，自动缓存 5 分钟
  const { data: projects, isLoading, isError } = useProjects()

  // 弹窗状态
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project)
    navigate(`/projects/${project.id}/errors`)
  }

  const handleEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setEditingProject(project)
    setFormDialogOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setDeletingProject(project)
    setDeleteDialogOpen(true)
  }

  const handleNewProject = () => {
    setEditingProject(undefined)
    setFormDialogOpen(true)
  }

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
        <Button variant="default" className="gap-2" onClick={handleNewProject}>
          <Plus className="w-4 h-4" />
          新建项目
        </Button>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 错误状态 */}
      {isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 py-12">
          <p className="text-sm text-red-400 mb-4">加载项目列表失败，请检查后端服务是否正常运行</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            重试
          </Button>
        </div>
      )}

      {/* 项目网格 */}
      {!isLoading && !isError && projects && (
        projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const { icon: PlatformIcon, label: platformLabel } =
                PLATFORM_CONFIG[project.platform] ?? PLATFORM_CONFIG.other
              return (
                <div
                  key={project.id}
                  className="group relative text-left rounded-xl border border-border bg-card hover:border-[#6a5fc1] hover:bg-[#6a5fc1]/5 transition-all duration-200 shadow-card"
                >
                  {/* 点击整张卡片进入项目 */}
                  <button
                    className="w-full text-left p-5"
                    onClick={() => handleOpenProject(project)}
                  >
                    {/* 项目头部 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#6a5fc1]/15 group-hover:bg-[#6a5fc1]/25 transition-colors">
                        <PlatformIcon className="w-5 h-5 text-[#6a5fc1]" />
                      </div>
                    </div>

                    {/* 项目名 */}
                    <h3 className="font-semibold text-foreground text-base mb-1">{project.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[32px]">
                      {project.description || '暂无描述'}
                    </p>

                    {/* 元数据 + 进入展示 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge variant="secondary" className="text-[10px] shrink-0 gap-1 pl-1.5">
                          <PlatformIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                          {platformLabel}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          {project.appId}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#6a5fc1] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </button>

                  {/* 操作菜单（悬浮时显示）*/}
                  <div className="absolute top-3 right-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center justify-center w-7 h-7 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="项目操作"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          onClick={(e) => handleEdit(e, project)}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleDelete(e, project)}
                          className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}

            {/* 添加项目卡片 */}
            <button
              onClick={handleNewProject}
              className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-border hover:border-[#6a5fc1] bg-transparent p-5 transition-all duration-200 min-h-[150px]"
            >
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
            <Button variant="default" className="gap-2" onClick={handleNewProject}>
              <Plus className="w-4 h-4" />
              创建第一个项目
            </Button>
          </div>
        )
      )}

      {/* 新建/编辑项目弹窗 */}
      <ProjectFormDialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          setFormDialogOpen(open)
          if (!open) setEditingProject(undefined)
        }}
        project={editingProject}
      />

      {/* 删除确认弹窗 */}
      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeletingProject(null)
        }}
        project={deletingProject}
      />
    </div>
  )
}