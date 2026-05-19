/**
 * 项目相关类型定义
 *
 * 与 monitor-server /projects 接口响应结构对应。
 */

/** 项目平台类型（与后端 ProjectPlatform 保持一致）*/
export type ProjectPlatform = 'web' | 'ios' | 'android' | 'miniprogram' | 'react' | 'vue' | 'angular' | 'other'

/** 项目实体 */
export interface Project {
  id: string
  appId: string          // 唯一标识，用于 SDK 初始化和 ClickHouse 查询
  name: string
  description: string
  platform: ProjectPlatform
  ownerId: string
  createdAt: string
  updatedAt: string
}

/** 创建项目请求体 */
export interface CreateProjectDto {
  appId: string
  name: string
  description?: string
  platform?: ProjectPlatform
}

/** 更新项目请求体（appId 不可修改）*/
export interface UpdateProjectDto {
  name?: string
  description?: string
  platform?: ProjectPlatform
}
