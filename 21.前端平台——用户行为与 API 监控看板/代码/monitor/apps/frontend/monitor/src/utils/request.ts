import axios from 'axios'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Axios 封装实例
 *
 * 职责：
 *  1. 统一 baseURL 指向 monitor-server（端口 3003）
 *  2. 请求拦截器：自动从 auth store 取 JWT token，附加到 Authorization 头
 *  3. 响应拦截器：统一处理 401（token 过期 → 自动退出登录）
 *
 * 📌 为什么不直接用 axios？
 *  组件里直接调用 axios 会导致：
 *   - baseURL 散落各处
 *   - 每次都要手动写 Authorization 头
 *   - 401 处理逻辑重复
 *  封装一个实例，这些都自动处理，组件只关心业务逻辑。
 */
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3003',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── 请求拦截器 —— 注入 JWT Token ─────────────────────────────────────────────
request.interceptors.request.use(
  (config) => {
    // 从 Zustand store 的 localStorage 持久化层中读取 token
    // 注意：这里用 getState() 而不是 Hook，因为拦截器不在 React 组件内
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── 响应拦截器 —— 统一错误处理 ───────────────────────────────────────────────
request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 注意：登录 / 注册接口本身也会返回 401（邮箱或密码错误）。
      // 对这两个接口，401 是正常的业务错误，应让组件自行处理（展示错误提示），
      // 不应触发全局退出 + 页面跳转。
      const url: string = error.config?.url ?? ''
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')

      if (!isAuthEndpoint) {
        // Token 过期或无效（非登录/注册接口）→ 清除认证状态并跳转到登录页
        useAuthStore.getState().logout()
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  },
)

export default request
