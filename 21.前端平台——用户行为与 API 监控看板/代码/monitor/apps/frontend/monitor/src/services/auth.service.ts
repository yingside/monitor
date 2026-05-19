import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'
import type { AuthResponse, LoginDto, RegisterDto, User } from '@/types/auth'

/**
 * Auth API 服务层
 *
 * 封装所有与 /auth 相关的后端接口调用。
 * 调用方（TanStack Query hooks）只需 await 函数，不需要关心 axios 细节。
 */

/** 登录 */
export async function loginApi(dto: LoginDto): Promise<AuthResponse> {
  const { data } = await request.post<ApiResponse<AuthResponse>>('/auth/login', dto)
  return data.data
}

/** 注册 */
export async function registerApi(dto: RegisterDto): Promise<AuthResponse> {
  const { data } = await request.post<ApiResponse<AuthResponse>>('/auth/register', dto)
  return data.data
}

/** 获取当前用户 Profile */
export async function getProfileApi(): Promise<User> {
  const { data } = await request.get<ApiResponse<User>>('/auth/profile')
  return data.data
}
