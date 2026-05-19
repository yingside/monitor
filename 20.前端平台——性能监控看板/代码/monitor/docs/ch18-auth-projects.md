# 项目上下文文档 — 第 18 章新增部分

> 本文档在第 17 章 `ch17-frontend-setup.md` 基础上**追加**第 18 章内容。
> 第 17 章原始状态请查阅 `ch17-frontend-setup.md`。

---

## 二十、第 18 章变更摘要

### 新增依赖

| 依赖 | 版本 | 用途 |
|---|---|---|
| `@tanstack/react-query` | ^5.64.2 | 数据请求状态管理（useQuery / useMutation）|

### 新增文件清单

```
apps/frontend/monitor/src/
├── services/
│   ├── auth.service.ts         ← /auth/* API 调用封装
│   └── project.service.ts      ← /projects/* API 调用封装
├── hooks/
│   ├── useAuth.ts              ← useLogin / useRegister（useMutation）
│   └── useProjects.ts          ← useProjects / useProject / useCreateProject / useUpdateProject / useDeleteProject
└── components/
    └── project/
        ├── ProjectFormDialog.tsx   ← 新建/编辑项目弹窗（双模式）
        └── DeleteProjectDialog.tsx ← 删除确认弹窗
```

### 新增 shadcn/ui 组件

| 文件 | 说明 |
|---|---|
| `components/ui/dialog.tsx` | 基于 `@radix-ui/react-dialog`（依赖已在第 17 章预装）|
| `components/ui/select.tsx` | 基于 `@radix-ui/react-select`（依赖已在第 17 章预装）|

### 修改文件清单

| 文件 | 修改内容 |
|---|---|
| `main.tsx` | 新增 `QueryClientProvider` 包裹 `App` |
| `pages/auth/LoginPage.tsx` | 接入 `useLogin` hook，`isPending` 控制加载态，错误显示 |
| `pages/auth/RegisterPage.tsx` | 接入 `useRegister` hook，密码一致性校验，错误显示 |
| `pages/ProjectsPage.tsx` | 全量重写：Mock 替换为 `useProjects`，新增 CRUD 弹窗逻辑 |

---

## 二十一、架构设计：服务分层

```
UI 层（pages/components）
    ↓ 调用 hooks
hooks 层（useQuery / useMutation）
    ↓ 调用 services
services 层（封装 axios + 解包 ApiResponse）
    ↓ HTTP 请求
utils/request.ts（Axios 实例，注入 JWT，处理 401）
    ↓
monitor-server（localhost:3003）
```

**分层职责：**
- **services/**：只负责"发请求 + 解包响应"，不包含任何状态逻辑
- **hooks/**：只负责"缓存管理 + 副作用（store 更新 / 路由跳转）"
- **pages/components**：只负责"渲染 + 用户交互事件"

---

## 二十二、TanStack Query 全局配置（main.tsx）

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

| 配置项 | 值 | 原因 |
|---|---|---|
| `retry` | 1 | 失败重试 1 次（默认 3 次太频繁）|
| `refetchOnWindowFocus` | false | 切换窗口不自动重请求（避免干扰调试）|

---

## 二十三、Query Key 规范

统一在 `hooks/useProjects.ts` 的 `QUERY_KEYS` 常量中管理：

```typescript
export const QUERY_KEYS = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
}
```

**为什么要集中管理 Query Key：**
- 修改数据后调用 `queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })`，精准清除缓存
- 避免散落的字符串 key 导致缓存失效失效

---

## 二十四、认证流程

```
POST /auth/login
  → 后端返回 { token, user }
  → useAuthStore.setAuth(token, user)   （写入 Zustand，persist 到 localStorage）
  → navigate('/projects', { replace: true })
```

```
POST /auth/register
  → 后端返回 { token, user }
  → useAuthStore.setAuth(token, user)   （注册即登录）
  → navigate('/projects', { replace: true })
```

---

## 二十五、项目 CRUD 流程

| 操作 | Hook | 成功后 |
|---|---|---|
| 查询列表 | `useProjects()` | 自动缓存 5 分钟 |
| 新建 | `useCreateProject()` | `invalidateQueries(['projects'])` → 列表刷新 |
| 编辑 | `useUpdateProject()` | `invalidateQueries(['projects'])` + `invalidateQueries(['projects', id])` |
| 删除 | `useDeleteProject()` | `invalidateQueries(['projects'])`；若删除的是当前项目，同时调用 `clearCurrentProject()` |

---

## 二十六、与 demos 项目的关联（重要）

第 10 章以来，`demos/vue3-demo` 和 `demos/react-demo` 的 SDK 初始化 appId 分别为：

```typescript
// demos/vue3-demo/src/main.ts
MonitorBrowser.init({ appId: 'vue3-demo', ... })

// demos/react-demo/src/main.tsx
MonitorBrowser.init({ appId: 'react-demo', ... })
```

**在监控平台中建立对应项目：**
1. 注册账号并登录监控平台（`http://localhost:5173`）
2. 在"新建项目"弹窗中，**App ID 必须填写 `vue3-demo`**，平台选择 Vue
3. 再新建一个 App ID 为 `react-demo` 的项目，平台选择 React
4. 此时 `demos/vue3-demo` 运行后触发的所有监控事件（上报到 `http://localhost:3000/report`）会被写入 ClickHouse
5. 监控平台通过 `appId = 'vue3-demo'` 查询 ClickHouse 数据，展示该项目的错误 / 性能 / 行为数据

> ⚠️ appId 在项目创建后不可修改，若填写错误需删除重建。

---

## 二十七、第 18 章完成后的路由状态（无变化）

路由结构与第 17 章相同，第 18 章只做了 API 对接，未新增路由。

---

## 二十八、第 19 章代办事项

1. **ErrorsPage**：使用 `useQuery` 接入 `GET /monitor/errors`，实现错误列表展示
2. **Recharts**：错误趋势折线图（按时间聚合）
3. **错误详情弹窗**：堆栈信息、用户信息、设备信息
4. **ErrorsPage 过滤器**：按时间范围、错误类型筛选
