import { useNavigate } from 'react-router-dom'
import { LogOut, User, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import { useThemeStore } from '@/stores/theme.store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Header —— 顶部导航栏
 *
 * 布局（左→右）：
 *  面包屑 / 当前页标题 ──── 弹性填充 ──── 用户头像菜单
 *
 * 功能：
 *  - 显示当前登录用户的头像与姓名
 *  - 下拉菜单：查看个人资料 / 退出登录
 */
export default function Header() {
  const { user, logout } = useAuthStore()
  const { clearCurrentProject } = useProjectStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()

  /** 获取用户名首字母（用于 Avatar Fallback）*/
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  const handleLogout = () => {
    logout()
    clearCurrentProject()
    navigate('/login')
  }

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background shrink-0">
      {/* 左侧：页面标题占位（各页面通过 PageHeader 组件自行填充）*/}
      <div id="page-header-portal" className="flex items-center gap-2" />

      {/* 右侧：主题切换 + 用户菜单 */}
      <div className="flex items-center gap-1">
        {/* 主题切换按钮 */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到暗色模式'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
              aria-label="用户菜单"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                {user?.name ?? user?.email ?? 'Unknown'}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => navigate('/profile')}
              className="cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              <span>个人资料</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-400/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
