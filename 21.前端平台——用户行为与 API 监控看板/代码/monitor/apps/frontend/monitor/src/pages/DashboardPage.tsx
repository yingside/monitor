import { LayoutDashboard } from 'lucide-react'

/**
 * DashboardPage —— 平台总览（跨项目汇总数据）
 *
 * 第 17 章：占位页，第 19 章开始实现完整内容。
 */
export default function DashboardPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="w-6 h-6 text-[#6a5fc1]" />
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-16 text-center">
        <LayoutDashboard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">总览看板</p>
      </div>
    </div>
  )
}
