import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useCreateProject, useUpdateProject } from '@/hooks/useProjects'
import { PLATFORM_CONFIG } from '@/lib/platform-config'
import type { Project, ProjectPlatform } from '@/types/project'

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑模式时传入，新建时不传 */
  project?: Project
}

/**
 * ProjectFormDialog —— 创建 / 编辑项目弹窗
 *
 * 同时承担两个场景：
 *  - open + !project  → 新建模式：标题"新建项目"，提交后调用 createProject
 *  - open + project   → 编辑模式：标题"编辑项目"，appId 只读，提交后调用 updateProject
 *
 * 📌 为什么用一个组件承担新建和编辑两种模式？
 *  - 表单字段完全相同（除 appId 在编辑时只读）
 *  - 统一的 onSuccess 关闭弹窗逻辑
 *  - 减少重复的 UI 代码
 */
export default function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: ProjectFormDialogProps) {
  const isEditMode = Boolean(project)

  const [appId, setAppId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState<ProjectPlatform>('web')

  // 编辑模式时，用 project 数据填充表单
  useEffect(() => {
    if (project) {
      setAppId(project.appId)
      setName(project.name)
      setDescription(project.description ?? '')
      setPlatform(project.platform)
    } else {
      setAppId('')
      setName('')
      setDescription('')
      setPlatform('web')
    }
  }, [project, open])

  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const isPending = createProject.isPending || updateProject.isPending

  // 从 axios error 中提取后端返回的错误消息
  const rawError = createProject.error ?? updateProject.error
  const errorMessage = (() => {
    if (!rawError) return null
    const e = rawError as { response?: { data?: { message?: string | string[] } } }
    const msg = e.response?.data?.message
    if (Array.isArray(msg)) return msg.join('；')
    return msg ?? '操作失败，请稍后重试'
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEditMode && project) {
      updateProject.mutate(
        { id: project.id, dto: { name, description, platform } },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createProject.mutate(
        { appId, name, description, platform },
        { onSuccess: () => onOpenChange(false) },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? '编辑项目' : '新建项目'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? '修改项目基本信息，appId 创建后不可更改。'
              : '创建一个新的监控项目，appId 需与 SDK 初始化时的 appId 保持一致。'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 错误提示 */}
          {errorMessage && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* appId（新建时可编辑，编辑时只读）*/}
          <div className="space-y-1.5">
            <Label htmlFor="appId">
              App ID
              {isEditMode && (
                <span className="ml-2 text-xs text-muted-foreground normal-case font-normal">
                  （创建后不可修改）
                </span>
              )}
            </Label>
            <Input
              id="appId"
              type="text"
              placeholder="my-app（与 SDK appId 保持一致）"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              disabled={isEditMode}
              required={!isEditMode}
              pattern="[a-zA-Z0-9_-]+"
              title="只允许英文字母、数字、短横线和下划线"
            />
            {!isEditMode && (
              <p className="text-xs text-muted-foreground">
                建议格式：<code className="font-mono text-accent">vue3-demo</code>、
                <code className="font-mono text-accent">react-demo</code>，与 SDK 初始化 appId 完全一致
              </p>
            )}
          </div>

          {/* 项目名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="projectName">项目名称</Label>
            <Input
              id="projectName"
              type="text"
              placeholder="Vue3 Demo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* 项目描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="description">
              描述
              <span className="ml-2 text-xs text-muted-foreground normal-case font-normal">
                （可选）
              </span>
            </Label>
            <Input
              id="description"
              type="text"
              placeholder="简短描述项目用途"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 平台 */}
          <div className="space-y-1.5">
            <Label>平台</Label>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as ProjectPlatform)}
            >
              {/* 触发器：显示当前平台的图标 + 名称（受控 Select，不需要 SelectValue） */}
              <SelectTrigger>
                {(() => {
                  const { icon: Icon, label } = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.other
                  return (
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </div>
                  )
                })()}
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PLATFORM_CONFIG) as ProjectPlatform[]).map((value) => {
                  const { icon: Icon, label } = PLATFORM_CONFIG[value]
                  return (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isEditMode ? '保存中...' : '创建中...'}
                </>
              ) : isEditMode ? (
                '保存修改'
              ) : (
                '创建项目'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
