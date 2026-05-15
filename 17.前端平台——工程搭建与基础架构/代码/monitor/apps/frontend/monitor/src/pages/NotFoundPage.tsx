import { Link } from 'react-router-dom'
import { Activity, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * NotFoundPage —— 404 页面
 *
 * Sentry 风格的 404 界面：暗色背景 + 大号错误码 + 导航引导
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#1f1633] flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(106,95,193,0.15) 0%, transparent 70%)',
        }}
      />

      <div className="relative text-center">
        {/* Logo */}
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#6a5fc1]">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Monitor</span>
        </div>

        {/* 404 大号文字 */}
        <div className="mb-4">
          <span
            className="text-[120px] font-bold leading-none"
            style={{
              background: 'linear-gradient(135deg, #6a5fc1 0%, #c2ef4e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">页面不存在</h1>
        <p className="text-[#a89ec9] text-sm mb-8 max-w-xs mx-auto">
          你访问的页面已被移除或不存在，请检查链接是否正确
        </p>

        <Button asChild variant="default" className="gap-2">
          <Link to="/projects">
            <ArrowLeft className="w-4 h-4" />
            返回项目列表
          </Link>
        </Button>
      </div>
    </div>
  )
}
