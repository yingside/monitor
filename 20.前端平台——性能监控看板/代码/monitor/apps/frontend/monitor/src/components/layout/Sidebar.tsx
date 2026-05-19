import { NavLink, useParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Gauge,
  MousePointerClick,
  Globe,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ChevronDown,
  Plus,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project.store'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Sidebar —— 左侧导航栏（Sentry 暗紫风格）
 *
 * 布局结构：
 *  ┌──────────────────┐
 *  │  Logo + 平台名    │  ← Logo 区
 *  ├──────────────────┤
 *  │  项目切换器       │  ← 当前项目展示，点击跳到 /projects
 *  ├──────────────────┤
 *  │  OVERVIEW        │  ← 导航分组标题
 *  │    Dashboard     │
 *  ├──────────────────┤
 *  │  MONITORING      │
 *  │    Errors        │
 *  │    Performance   │
 *  │    Behaviors     │
 *  │    API Requests  │
 *  ├──────────────────┤
 *  │  MANAGE          │
 *  │    Projects      │
 *  │    Settings      │
 *  └──────────────────┘
 */

interface NavItem {
  label: string
  icon: React.ElementType
  to: string
  /** 为 true 时强制不高亮（例如无项目时 Monitoring 条目回退到 /projects，不应显示激活态）*/
  forceInactive?: boolean
  /** 是否精确匹配（等同于 NavLink end 属性）*/
  end?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

export default function Sidebar() {
  const { projectId } = useParams()
  const { currentProject } = useProjectStore()
  const navigate = useNavigate()

  // 根据是否有当前项目，决定监控导航的 to 路径
  const monitorBase = projectId ? `/projects/${projectId}` : ''

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        {
          label: 'Dashboard',
          icon: LayoutDashboard,
          to: '/dashboard',
        },
      ],
    },
    {
      title: 'Monitoring',
      items: [
        {
          label: 'Errors',
          icon: AlertTriangle,
          to: monitorBase ? `${monitorBase}/errors` : '/projects',
          forceInactive: !monitorBase,
        },
        {
          label: 'Performance',
          icon: Gauge,
          to: monitorBase ? `${monitorBase}/performance` : '/projects',
          forceInactive: !monitorBase,
        },
        {
          label: 'Behaviors',
          icon: MousePointerClick,
          to: monitorBase ? `${monitorBase}/behaviors` : '/projects',
          forceInactive: !monitorBase,
        },
        {
          label: 'API Requests',
          icon: Globe,
          to: monitorBase ? `${monitorBase}/apis` : '/projects',
          forceInactive: !monitorBase,
        },
      ],
    },
    {
      title: 'Manage',
      items: [
        {
          label: 'Projects',
          icon: FolderKanban,
          to: '/projects',
          end: true,
        },
        {
          label: 'Settings',
          icon: Settings,
          to: '/settings',
          forceInactive: true,
        },
      ],
    },
  ]

  return (
    <aside
      className="flex flex-col w-[var(--sidebar-width)] h-full bg-sidebar border-r border-border shrink-0"
      aria-label="主导航"
    >
      {/* ── Logo 区 ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#6a5fc1]">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold tracking-tight text-foreground">Monitor</span>
      </div>

      {/* ── 项目切换器 ─────────────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-b border-border shrink-0">
        <button
          onClick={() => navigate('/projects')}
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 rounded-lg',
            'text-sm text-foreground',
            'bg-muted/50 hover:bg-muted',
            'transition-colors duration-150',
            'group',
          )}
          aria-label="切换项目"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-[#6a5fc1]/30 shrink-0">
              <FolderKanban className="w-3 h-3 text-[#6a5fc1]" />
            </div>
            <span className="truncate text-sm font-medium">
              {currentProject?.name ?? '选择项目'}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
        </button>

        {/* 快速新建项目 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/projects')}
              className={cn(
                'flex items-center gap-1.5 w-full mt-1 px-3 py-1.5 rounded-md',
                'text-xs text-muted-foreground',
                'hover:text-foreground hover:bg-muted/50',
                'transition-colors duration-150',
              )}
            >
              <Plus className="w-3 h-3" />
              <span>新建项目</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">前往项目列表创建新项目</TooltipContent>
        </Tooltip>
      </div>

      {/* ── 导航区（可滚动）──────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {navSections.map((section, sectionIdx) => (
          <div key={section.title}>
            {sectionIdx > 0 && <Separator className="my-2" />}

            {/* 分组标题 */}
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.25px] text-muted-foreground">
              {section.title}
            </p>

            {/* 导航项 */}
            {section.items.map((item) => (
              <SidebarNavItem key={item.label} item={item} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

/** 单个导航项 —— 使用 NavLink 实现激活状态高亮 */
function SidebarNavItem({ item }: { item: NavItem }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg',
          'text-sm font-medium transition-all duration-150',
          'group',
          isActive && !item.forceInactive
            ? [
                // 激活态：Sentry Purple 背景 + lime 左侧指示条
                'bg-[#6a5fc1]/15 text-foreground',
                'relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2',
                'before:w-0.5 before:h-4 before:rounded-full before:bg-[#c2ef4e]',
              ]
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}
