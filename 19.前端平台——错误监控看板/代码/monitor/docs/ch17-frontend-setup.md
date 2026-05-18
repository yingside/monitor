# 项目上下文文档

> 本文档描述**第 17 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。
> 
> 前置文档：原 `project-context.md`（第 16 章状态）保持不变，本文追加第 17 章的前端信息。

---

## 十二、前端平台状态（第 17 章新增）✅

### 应用概览

| 项目 | 值 |
|---|---|
| 包名 | `@monitor/frontend` |
| 端口 | 5173（Vite 开发服务器默认）|
| 框架 | Vite 6 + React 18 + TypeScript |
| 启动命令 | `pnpm frontend` 或 `pnpm --filter @monitor/frontend dev` |
| API 目标 | `http://localhost:3003`（monitor-server，第 16 章）|

### 依赖清单（新增）

| 依赖 | 版本 | 用途 |
|---|---|---|
| `react-router-dom` | ^6.26 | 路由（声明式，嵌套路由）|
| `zustand` | ^5.0 | 全局状态管理 |
| `axios` | ^1.7 | HTTP 请求封装 |
| `lucide-react` | ^0.469 | 图标库 |
| `recharts` | ^2.14 | 图表（第 19-21 章使用）|
| `class-variance-authority` | ^0.7 | shadcn/ui 组件变体系统 |
| `clsx` + `tailwind-merge` | | 类名合并（cn 函数）|
| `@radix-ui/react-*` | | shadcn/ui 无障碍原语 |
| `tailwindcss` | ^3.4 | 样式工具类 |
| `tailwindcss-animate` | ^1.0 | 动画工具类 |

### 目录结构

```
apps/frontend/monitor/
├── index.html                    ← 含 Rubik 字体 CDN
├── package.json
├── vite.config.ts                ← @/ → src/ 路径别名
├── tailwind.config.ts            ← Sentry 暗紫主题色系
├── postcss.config.js
├── components.json               ← shadcn/ui 配置
├── tsconfig.json                 ← declaration: false（前端应用无需生成 .d.ts）
└── src/
    ├── index.css                 ← Tailwind 指令 + CSS 变量（:root 暗色默认，html.light 覆盖浅色）
    ├── main.tsx                  ← 挂载 App + 导入 index.css
    ├── App.tsx                   ← RouterProvider + 同步主题类到 document.documentElement
    ├── vite-env.d.ts
    ├── types/
    │   ├── auth.ts               ← User / LoginDto / RegisterDto / AuthResponse
    │   ├── project.ts            ← Project / ProjectPlatform / CreateProjectDto / UpdateProjectDto
    │   └── api.ts                ← ApiResponse<T> / PaginatedData<T> / 分页参数类型
    ├── lib/
    │   └── utils.ts              ← cn(clsx + twMerge) 工具函数
    ├── utils/
    │   └── request.ts            ← Axios 封装实例（baseURL 3003，JWT 拦截器，401 自动退出）
    ├── stores/
    │   ├── auth.store.ts         ← Zustand + persist(localStorage key: monitor-auth)
    │   ├── project.store.ts      ← Zustand + persist(localStorage key: monitor-project)
    │   └── theme.store.ts        ← Zustand + persist(localStorage key: monitor-theme)，暗色/浅色主题
    ├── router/
    │   └── index.tsx             ← 路由表（AuthGuard / GuestGuard / AppShell 嵌套）
    ├── components/
    │   ├── ui/
    │   │   ├── button.tsx        ← shadcn/ui Button（default/secondary/destructive/outline/ghost/link）
    │   │   ├── input.tsx         ← Input（dark/light variant）
    │   │   ├── label.tsx         ← Label（uppercase + tracking）
    │   │   ├── card.tsx          ← Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter
    │   │   ├── badge.tsx         ← Badge（default/secondary/destructive/success/warning/outline/accent）
    │   │   ├── separator.tsx     ← Separator
    │   │   ├── tooltip.tsx       ← Tooltip / TooltipTrigger / TooltipContent / TooltipProvider
    │   │   ├── dropdown-menu.tsx ← DropdownMenu 系列
    │   │   └── avatar.tsx        ← Avatar / AvatarImage / AvatarFallback
    │   └── layout/
    │       ├── AppShell.tsx      ← 主布局壳（Sidebar + Header + Outlet）
    │       ├── Sidebar.tsx       ← 左侧导航（项目切换器 + 分组导航，支持 forceInactive/end）
    │       └── Header.tsx        ← 顶部导航（主题切换按镰 + 用户头像下拉菜单）
    └── pages/
        ├── auth/
        │   ├── LoginPage.tsx     ← 登录页 UI（API 对接在第 18 章）
        │   └── RegisterPage.tsx  ← 注册页 UI（API 对接在第 18 章）
        ├── ProjectsPage.tsx      ← 项目列表（Mock 数据，第 18 章接真实 API）
        ├── DashboardPage.tsx     ← 总览占位（第 19 章实现）
        ├── NotFoundPage.tsx      ← 404 页面
        ├── errors/
        │   └── ErrorsPage.tsx    ← 错误监控占位骨架（第 19 章实现）
        ├── performance/
        │   └── PerformancePage.tsx ← 性能监控占位骨架（第 20 章实现）
        ├── behaviors/
        │   └── BehaviorsPage.tsx   ← 行为监控占位骨架（第 21 章实现）
        └── apis/
            └── ApisPage.tsx        ← API 监控占位骨架（第 21 章实现）
```

---

## 十三、设计系统（第 17 章建立）

### CSS 变量主题系统

支持暗色（默认）和浅色（`html.light`）两套主题，通过 Header 的多主题切换按镰切换。

**暗色主题（`:root` 默认）**

| CSS 变量 | 对应 Hex | 说明 |
|---|---|---|
| `--background` | `#1f1633` | 主背景（深紫黑）|
| `--card` | `#150f23` | 卡片背景（更深）|
| `--sidebar` | `#0f0b1a` | 侧边栏背景（比卡片更深）|
| `--primary` | `#6a5fc1` | 主交互色（Sentry Purple）|
| `--secondary` | `#79628c` | 次级交互（Muted Purple）|
| `--muted` | `#362d59` | 边框 / 分割线 |
| `--accent` | `#c2ef4e` | 强调色（Lime）|
| `--destructive` | red-500 | 错误 / 危险 |
| `--border` | `#362d59` | 边框 |

**浅色主题（`html.light` 覆盖）**

| CSS 变量 | 对应 Hex | 说明 |
|---|---|---|
| `--background` | `#ece8f9` | 淡藰衣草白背景 |
| `--card` | `#ffffff` | 白色卡片 |
| `--sidebar` | `#e8e2f4` | 浅紫薄雾侧边栏 |
| `--foreground` | `#1a1138` | 深紫近黑文字 |
| `--muted` | `#e3ddf3` | 浅紫背景 |
| `--accent` | `#8db520` | 深版 Lime（浅色背景可读）|
| `--border` | `#d5cee9` | 淡紫边框 |

**主题切换机制：**
- `theme.store.ts` 持久化 `'dark' | 'light'` 到 `monitor-theme`
- `App.tsx` 的 `useEffect` 监听 theme，同步 `html.light` class
- `index.html` 内联脚本：页面加载时立即从 localStorage 恢复主题（防止 FOUC）
- `index.css`：全局 `*` 选择器对 `background-color / color / border-color` 添加 250ms 过渡动画

### 自定义 Tailwind 工具类

| 类名 | 效果 |
|---|---|
| `.glass-panel` | 毛玻璃效果（backdrop-filter blur 18px）|
| `.btn-inset` | 触感按钮阴影（inset shadow）|
| `.animate-fade-in` | 淡入动画（0.2s ease-out）|

### shadcn/ui 组件变体设计决策

**Button variants:**
- `default`：主色 `#6a5fc1` + inset 阴影
- `secondary`：Sentry 标志性 `#79628c` + 边框 `#584674`
- 所有按钮：`uppercase` + `letter-spacing: 0.2px`（Sentry 风格标签系统）

**Badge variants 扩展：**
- `success`：绿色（API 200/正常）
- `warning`：橙色（API 4xx/警告）
- `accent`： Lime 绿（高亮标签）

---

## 十四、路由架构（第 17 章建立）

```
/                               → Navigate to /projects
/login                          → GuestGuard → LoginPage（已登录跳 /projects）
/register                       → GuestGuard → RegisterPage
/projects                       → AuthGuard → AppShell → ProjectsPage
/projects/:projectId            → AuthGuard → Navigate to errors
/projects/:projectId/errors     → AuthGuard → AppShell → ErrorsPage
/projects/:projectId/performance → AuthGuard → AppShell → PerformancePage
/projects/:projectId/behaviors  → AuthGuard → AppShell → BehaviorsPage
/projects/:projectId/apis       → AuthGuard → AppShell → ApisPage
/dashboard                      → AuthGuard → AppShell → DashboardPage
*                               → NotFoundPage
```

**路由守卫设计：**
- `AuthGuard`：检查 `useAuthStore.token`，为 null 则 Navigate 到 /login
- `GuestGuard`：检查 token，不为 null 则 Navigate 到 /projects

---

## 十五、状态管理（第 17 章建立）

### auth.store.ts（LocalStorage: `monitor-auth`）

```typescript
{
  token: string | null,      // JWT Token
  user: User | null,         // 登录用户信息
  setAuth(token, user),      // 登录成功调用
  setUser(user),             // 更新用户信息
  logout(),                  // 清除认证
  isAuthenticated()          // 判断登录状态
}
```

### project.store.ts（LocalStorage: `monitor-project`）

```typescript
{
  currentProject: Project | null,      // 当前项目完整信息
  currentProjectId: string | null,     // 当前项目 ID（持久化）
  setCurrentProject(project),          // 设置项目（含详情）
  setCurrentProjectId(id),             // 仅设置 ID（触发页面重载详情）
  clearCurrentProject()                // 清除项目（退出登录时调用）
}
```

### theme.store.ts（LocalStorage: `monitor-theme`）

```typescript
{
  theme: 'dark' | 'light',   // 当前主题，默认 'dark'
  toggleTheme(),             // 切换主题
}
```

> 使用注意：`App.tsx` 内 `useEffect(…, [theme])` 监听 theme 变化，将 `html.light` class 添加/移除到 `document.documentElement`。
> 不要在组件内直接操作 DOM，统一由 App.tsx 处理。

---

## 十六、Sidebar 导航项激活规则

`NavItem` 接口支持两个主题属性：

| 属性 | 类型 | 说明 |
|---|---|---|
| `forceInactive` | `boolean?` | 强制不高亮，即使 URL 匹配。用于无项目时 Monitoring 条目指向 /projects 的备用路径 |
| `end` | `boolean?` | 传递给 NavLink `end` 属性，启用精确匹配（防止前缀匹配导致子路由也高亮）|

**当前各导航项配置：**
- Dashboard：普通 NavLink
- Errors / Performance / Behaviors / API Requests：有项目时路径为 `/projects/:id/xxx`，无项目时指向 `/projects` 且 `forceInactive: true`
- Projects：`end: true`（进入具体项目子路由后不高亮）
- Settings：`to: '/settings'` + `forceInactive: true`（未实现页，暂不激活）

---

## 十七、环境变量（第 17 章新增）

前端使用 Vite 环境变量（`import.meta.env.VITE_*`）：

| 变量名 | 默认值（代码内 fallback）| 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3003` | monitor-server API 地址 |

---

## 十七、更新后的数据流

```
React 前端平台（Vite, localhost:5173）      ← ✅ 第 17 章工程基础建立
  ↕ Axios（JWT Bearer Token）
monitor-server (localhost:3003)               ← ✅ 第 16 章
  ├─ /auth/register, /auth/login             ← 第 18 章对接
  ├─ /projects                               ← 第 18 章对接
  └─ /monitor/errors|performance|...        ← 第 19-21 章对接
  ↕ PostgreSQL（用户/项目）+ ClickHouse（监控数据）← ✅ 已建立
```

---

## 十八、常用命令（含第 17 章新增）

```bash
# 启动前端开发服务器（端口 5173）
pnpm frontend

# 启动全部后端（三个服务同时，在不同终端分别运行）
pnpm dsn-server        # 端口 3000 — 数据上报
pnpm consumer-server   # 端口 3001 — Kafka 消费
pnpm monitor-server    # 端口 3003 — 平台 API

# 启动基础设施
pnpm infra:start

# 前端类型检查
pnpm --filter @monitor/frontend type-check
```

---

## 十九、第 18 章代办事项

第 18 章（登录、注册与项目管理）需要完成：

1. **LoginPage**：连接 `POST /auth/login` → `useAuthStore.setAuth()` → 跳转 /projects
2. **RegisterPage**：连接 `POST /auth/register` → 自动登录
3. **ProjectsPage**：连接 `GET /projects` 替换 Mock 数据，实现 CRUD 弹窗
4. **新建项目 Dialog**：表单 + `POST /projects`
5. **编辑/删除项目**：`PATCH /projects/:id` / `DELETE /projects/:id`
6. **Header 中的 Profile 页**（可选）
