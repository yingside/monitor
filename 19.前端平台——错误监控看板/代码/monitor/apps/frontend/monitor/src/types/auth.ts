/**
 * 认证相关类型定义
 *
 * 与后端 monitor-server（第 16 章）的响应结构完全对应。
 */

/** 当前登录用户信息（来自 /auth/profile 或登录响应）*/
export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  updatedAt: string
}

/** 登录请求体 */
export interface LoginDto {
  email: string
  password: string
}

/** 注册请求体 */
export interface RegisterDto {
  email: string
  password: string
  name: string
}

/** 登录 / 注册成功响应的 data 字段 */
export interface AuthResponse {
  token: string
  user: User
}
