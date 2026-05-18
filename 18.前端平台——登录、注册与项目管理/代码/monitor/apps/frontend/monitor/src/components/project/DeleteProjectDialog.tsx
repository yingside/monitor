import { Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDeleteProject } from '@/hooks/useProjects'
import { useProjectStore } from '@/stores/project.store'
import type { Project } from '@/types/project'

interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
}

/**
 * DeleteProjectDialog —— 删除项目确认弹窗
 *
 * 删除是不可逆操作，需要二次确认。
 * 如果删除的是当前选中项目，同时清除 projectStore 中的 currentProject。
 */
export default function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
}: DeleteProjectDialogProps) {
  const deleteProject = useDeleteProject()
  const { currentProjectId, clearCurrentProject } = useProjectStore()

  const handleDelete = () => {
    if (!project) return
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        // 如果删除的是当前选中项目，清除 store
        if (currentProjectId === project.id) {
          clearCurrentProject()
        }
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/15 shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <DialogTitle>删除项目</DialogTitle>
          </div>
          <DialogDescription>
            确定要删除项目{' '}
            <span className="font-semibold text-foreground">{project?.name}</span> 吗？
            <br />
            此操作不可撤销，项目关联的监控数据不会一并删除。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={deleteProject.isPending}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProject.isPending}
          >
            {deleteProject.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                删除中...
              </>
            ) : (
              '确认删除'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
