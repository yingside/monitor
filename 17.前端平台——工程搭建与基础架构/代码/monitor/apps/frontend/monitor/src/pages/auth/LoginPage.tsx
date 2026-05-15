import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Activity, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * LoginPage —— 登录页
 *
 * 第 17 章：完整 UI 实现，暂时无 API 调用（第 18 章接入）。
 *
 * 设计参考：Sentry 登录页风格
 *  - 全屏深紫黑背景 (#1f1633)
 *  - 居中白色卡片（在暗色背景上反差突出）
 *  - Lime 色强调登录按钮
 *  - 品牌 Logo 展示区
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading] = useState(false)   // 第 18 章改为真实 loading 状态

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO 第 18 章：调用 auth API 完成登录
    console.log('Login:', { email, password })
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
              disabled={isLoading}
              className={[
                'w-full mt-2 h-10',
                'bg-[#c2ef4e] text-[#1f1633] border-0',
                'hover:bg-[#d4f56a] hover:shadow-hover-lg',
                'font-bold text-sm',
                'disabled:opacity-60',
              ].join(' ')}
            >
              {isLoading ? (
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
