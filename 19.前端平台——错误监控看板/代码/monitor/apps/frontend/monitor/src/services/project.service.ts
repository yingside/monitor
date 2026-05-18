import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'
import type { Project, CreateProjectDto, UpdateProjectDto } from '@/types/project'

/**
 * Project API 服务层
 *
 * 封装所有与 /projects 相关的后端接口调用。
 * 均返回解包后的业务数据，不暴露 axios response 结构。
 */

/** 获取当前用户的项目列表 */
export async function getProjectsApi(): Promise<Project[]> {
  const { data } = await request.get<ApiResponse<Project[]>>('/projects')
  return data.data
}

/** 根据 ID 获取单个项目 */
export async function getProjectByIdApi(id: string): Promise<Project> {
  const { data } = await request.get<ApiResponse<Project>>(`/projects/${id}`)
  return data.data
}

/** 创建项目 */
export async function createProjectApi(dto: CreateProjectDto): Promise<Project> {
  const { data } = await request.post<ApiResponse<Project>>('/projects', dto)
  return data.data
}

/** 更新项目 */
export async function updateProjectApi(id: string, dto: UpdateProjectDto): Promise<Project> {
  const { data } = await request.patch<ApiResponse<Project>>(`/projects/${id}`, dto)
  return data.data
}

/** 删除项目 */
export async function deleteProjectApi(id: string): Promise<void> {
  await request.delete(`/projects/${id}`)
}
