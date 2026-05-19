import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Activity, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/hooks/useAuth'

/**
 * LoginPage —— 登录页（第 18 章：接入真实 API）
 *
 * 第 17 章：UI 骨架
 * 第 18 章：引入 useLogin Hook（TanStack Query useMutation），
 *           接入 POST /auth/login，登录成功后跳转 /projects
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // useLogin 封装了：请求发送 → 成功后写 store → 路由跳转
  const { mutate: login, isPending, error } = useLogin()

  // 从 axios error 中提取后端返回的错误消息
  const errorMessage = (() => {
    if (!error) return null
    const axiosError = error as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message ?? '登录失败，请检查邮箱或密码'
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login({ email, password })
  }

  return (
    <div className="min-h-screen bg-[#1f1633] flex items-center justify-center p-4">
      {/* 背景装饰：渐变光晕 */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(106,95,193,0.25) 0%, transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo 区 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#6a5fc1] mb-4">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Monitor</h1>
          <p className="text-sm text-[#a89ec9] mt-1">前端监控平台</p>
        </div>

        {/* 登录卡片 */}
        <div className="rounded-xl border border-[#362d59] bg-[#150f23] p-8 shadow-ambient">
          <h2 className="text-lg font-semibold text-white mb-1">欢迎回来</h2>
          <p className="text-sm text-[#a89ec9] mb-6">登录到你的监控工作台</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 错误提示 */}
            {errorMessage && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {errorMessage}
              </div>
            )}

            {/* 邮箱 */}
            <div className="space-y-1.5">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="light"
                autoComplete="email"
                required
              />
            </div>

            {/* 密码 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
                <button
                  type="button"
                  className="text-xs text-[#6a5fc1] hover:text-[#c2ef4e] transition-colors"
                >
                  忘记密码？
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  variant="light"
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              disabled={isPending}
              className={[
                'w-full mt-2 h-10',
                'bg-[#c2ef4e] text-[#1f1633] border-0',
                'hover:bg-[#d4f56a] hover:shadow-hover-lg',
                'font-bold text-sm',
                'disabled:opacity-60',
              ].join(' ')}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  登录中...
                </>
              ) : (
                <>
                  登录
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          {/* 注册链接 */}
          <p className="text-sm text-center text-[#a89ec9] mt-6">
            还没有账号？{' '}
            <Link
              to="/register"
              className="text-[#6a5fc1] hover:text-[#c2ef4e] transition-colors font-medium"
            >
              立即注册
            </Link>
          </p>
        </div>

        {/* 底部版本信息 */}
        <p className="text-center text-xs text-[#362d59] mt-6">
          前端监控全栈实战 · Monitor Platform
        </p>
      </div>
    </div>
  )
}