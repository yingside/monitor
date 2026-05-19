import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { loginApi, registerApi } from '@/services/auth.service'
import type { LoginDto, RegisterDto } from '@/types/auth'

/**
 * useLogin —— 登录 Mutation
 *
 * 使用 TanStack Query 的 useMutation 封装登录逻辑。
 *
 * 📌 为什么用 useMutation 而不是 useState + fetch？
 *  - useMutation 自动管理 isPending（加载态）/ isError / error 状态
 *  - 内置 onSuccess / onError 回调，避免在组件里写 try/catch
 *  - 与 useQuery 一起使用时，可以通过 queryClient.invalidateQueries 自动刷新数据
 */
export function useLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (dto: LoginDto) => loginApi(dto),
    onSuccess: (data) => {
      setAuth(data.token, data.user)
      navigate('/projects', { replace: true })
    },
  })
}

/**
 * useRegister —— 注册 Mutation
 *
 * 注册成功后自动登录并跳转到 /projects，
 * 与登录行为一致，用户无需再次手动登录。
 */
export function useRegister() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (dto: RegisterDto) => registerApi(dto),
    onSuccess: (data) => {
      setAuth(data.token, data.user)
      navigate('/projects', { replace: true })
    },
  })
}
