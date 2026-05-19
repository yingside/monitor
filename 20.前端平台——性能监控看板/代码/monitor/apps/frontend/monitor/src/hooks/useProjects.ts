import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProjectsApi,
  getProjectByIdApi,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
} from '@/services/project.service'
import type { CreateProjectDto, UpdateProjectDto } from '@/types/project'

/**
 * Query Key 常量
 *
 * 📌 为什么要统一管理 Query Key？
 *  TanStack Query 用 key 标识每一条缓存条目。
 *  如果 key 写散了（组件 A 用 ['projects']，组件 B 用 ['project-list']），
 *  修改数据后 invalidateQueries 就无法精准清除正确的缓存。
 *  统一定义 QUERY_KEYS，所有地方都引用同一个常量，保证一致性。
 */
export const QUERY_KEYS = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
}

/**
 * useProjects —— 获取项目列表（useQuery）
 *
 * 自动缓存结果，多个组件同时使用时只发一次请求。
 * 失焦重新聚焦窗口时自动 refetch（默认行为，staleTime 控制频率）。
 */
export function useProjects() {
  return useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: getProjectsApi,
    staleTime: 1000 * 60 * 5, // 5 分钟内不重新请求
  })
}

/**
 * useProject —— 获取单个项目（useQuery）
 */
export function useProject(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.project(id),
    queryFn: () => getProjectByIdApi(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * useCreateProject —— 创建项目（useMutation）
 *
 * 创建成功后调用 invalidateQueries 使项目列表缓存失效，
 * 触发列表自动重新请求，展示最新数据。
 */
export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: CreateProjectDto) => createProjectApi(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
    },
  })
}

/**
 * useUpdateProject —— 更新项目（useMutation）
 */
export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProjectDto }) =>
      updateProjectApi(id, dto),
    onSuccess: (_, { id }) => {
      // 同时使列表缓存和单项缓存失效
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(id) })
    },
  })
}

/**
 * useDeleteProject —— 删除项目（useMutation）
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProjectApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
    },
  })
}
