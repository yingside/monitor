import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Activity, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * RegisterPage —— 注册页
 *
 * 第 17 章：完整 UI，API 调用在第 18 章接入。
 */
export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO 第 18 章：调用 auth API 完成注册
    console.log('Register:', { name, email, password })
  }

  return (
    <div className="min-h-screen bg-[#1f1633] flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(106,95,193,0.25) 0%, transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#6a5fc1] mb-4">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Monitor</h1>
          <p className="text-sm text-[#a89ec9] mt-1">前端监控平台</p>
        </div>

        {/* 注册卡片 */}
        <div className="rounded-xl border border-[#362d59] bg-[#150f23] p-8 shadow-ambient">
          <h2 className="text-lg font-semibold text-white mb-1">创建账号</h2>
          <p className="text-sm text-[#a89ec9] mb-6">开始监控你的前端应用</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 姓名 */}
            <div className="space-y-1.5">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                type="text"
                placeholder="你的名字"
                value={name}
                onChange={(e) => setName(e.target.value)}
                variant="light"
                autoComplete="name"
                required
              />
            </div>

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
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="至少 8 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  variant="light"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 确认密码 */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                variant="light"
                autoComplete="new-password"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">两次密码不一致</p>
              )}
            </div>

            {/* 注册按钮 */}
            <Button
              type="submit"
              disabled={isLoading || (!!confirmPassword && password !== confirmPassword)}
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
                  注册中...
                </>
              ) : (
                <>
                  创建账号
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          {/* 登录链接 */}
          <p className="text-sm text-center text-[#a89ec9] mt-6">
            已有账号？{' '}
            <Link
              to="/login"
              className="text-[#6a5fc1] hover:text-[#c2ef4e] transition-colors font-medium"
            >
              立即登录
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[#362d59] mt-6">
          前端监控全栈实战 · Monitor Platform
        </p>
      </div>
    </div>
  )
}
