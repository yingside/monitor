import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '@/types/project'

/**
 * Project Store —— 当前选中项目状态
 *
 * 监控平台的核心概念：用户选中一个项目后，
 * 所有监控数据（错误 / 性能 / 行为 / API）均以该项目的 appId 为维度查询。
 *
 * 使用 persist 保存当前项目 ID，下次进入平台时自动恢复上次选中的项目。
 */

interface ProjectState {
  /** 当前选中项目的完整信息（从 /projects/:id 加载后缓存）*/
  currentProject: Project | null
  /** 当前选中项目 ID（主要用于路由跳转和数据查询）*/
  currentProjectId: string | null

  // ── Actions ───────────────────────────────────────────────────────────────

  /** 切换当前项目（设置完整项目信息）*/
  setCurrentProject: (project: Project | null) => void
  /** 仅设置项目 ID（详情由页面组件按需加载）*/
  setCurrentProjectId: (id: string | null) => void
  /** 清除当前项目（退出项目视图）*/
  clearCurrentProject: () => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      currentProjectId: null,

      setCurrentProject: (project) =>
        set({
          currentProject: project,
          currentProjectId: project?.id ?? null,
        }),

      setCurrentProjectId: (id) =>
        set({
          currentProjectId: id,
          // 切换 ID 时清空详情，待页面重新加载
          currentProject: null,
        }),

      clearCurrentProject: () =>
        set({ currentProject: null, currentProjectId: null }),
    }),
    {
      name: 'monitor-project',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
      }),
    },
  ),
)
