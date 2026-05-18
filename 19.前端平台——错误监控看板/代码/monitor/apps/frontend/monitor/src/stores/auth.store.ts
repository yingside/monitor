import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/auth'

/**
 * Auth Store —— 全局认证状态
 *
 * 使用 zustand/middleware 的 persist 持久化到 localStorage，
 * 页面刷新后 token 和用户信息不丢失。
 *
 * 📌 persist 做了什么？
 *  - 自动将 state 序列化为 JSON 写入 localStorage（key: 'monitor-auth'）
 *  - 页面加载时自动从 localStorage 读取并恢复 state
 *  - 这样用户刷新页面后依然处于登录状态
 */

interface AuthState {
  /** JWT Token，null 表示未登录 */
  token: string | null
  /** 当前登录用户信息 */
  user: User | null

  // ── Actions ───────────────────────────────────────────────────────────────

  /** 登录成功后调用：同时保存 token 和 user */
  setAuth: (token: string, user: User) => void
  /** 更新用户信息（不改变 token）*/
  setUser: (user: User) => void
  /** 退出登录：清除所有认证状态 */
  logout: () => void
  /** 判断是否已认证 */
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => set({ token, user }),

      setUser: (user) => set({ user }),

      logout: () => set({ token: null, user: null }),

      isAuthenticated: () => get().token !== null,
    }),
    {
      name: 'monitor-auth',        // localStorage key
      partialize: (state) => ({    // 只持久化 token 和 user，不持久化 actions
        token: state.token,
        user: state.user,
      }),
    },
  ),
)
