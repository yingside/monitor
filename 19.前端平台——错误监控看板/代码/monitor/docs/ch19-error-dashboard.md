# 项目上下文文档 — 第 19 章新增部分

> 本文档在第 18 章 `ch18-auth-projects.md` 基础上**追加**第 19 章内容。
> 第 17-18 章原始状态请查阅 `ch17-frontend-setup.md` 和 `ch18-auth-projects.md`。

---

## 第 19 章变更摘要

### 新增文件清单

```
apps/frontend/monitor/src/
├── types/
│   └── error-log.ts                   ← 错误监控数据类型定义
├── services/
│   └── error.service.ts               ← 错误监控 API 调用封装
├── hooks/
│   └── useErrors.ts                   ← useErrors / useErrorStats TanStack Query hooks
├── components/
│   ├── ui/
│   │   └── table.tsx                  ← 新增 Table shadcn/ui 基础组件
│   └── errors/
│       ├── ErrorStatsCards.tsx        ← 4 个统计卡片（总/JS/资源/Promise错误数）
│       ├── ErrorTrendChart.tsx        ← Recharts 折线图（错误趋势）
│       ├── TopErrorsTable.tsx         ← 高频错误 TOP 10 表格
│       ├── ErrorTable.tsx             ← 分页错误日志列表（类型过滤 + 关键词搜索）
│       └── ErrorDetailDialog.tsx      ← 单条错误日志详情弹窗
└── pages/
    └── errors/
        └── ErrorsPage.tsx             ← 错误监控看板页面（完整重写，Ch17 占位替换）
```

### 修改文件清单

| 文件 | 修改内容 |
|---|---|
| `pages/errors/ErrorsPage.tsx` | 从 Ch17 占位骨架改为完整的错误监控看板 |
| `vite.config.ts` | `optimizeDeps.include` 加入 `recharts`；`server.warmup.clientFiles` 加入 `ErrorsPage.tsx` |

### 新增依赖

本章无新增 npm 依赖（`recharts` 已在第 17 章预装）。

---

## 架构：错误监控数据流

```
URL :projectId（UUID）
  → useProject(projectId)          ← src/hooks/useProjects.ts（第 18 章已有）
  → project.appId（ClickHouse 查询键）

  → useErrorStats({ appId, startTime, endTime })
  → GET /monitor/errors/stats
  → { trend, typeDistribution, topErrors }
  → ErrorStatsCards + ErrorTrendChart + TopErrorsTable

  → useErrors({ appId, startTime, endTime, errorType, page, pageSize })
  → GET /monitor/errors
  → { list: ErrorLog[], total, page, pageSize }
  → ErrorTable → 行点击 → ErrorDetailDialog
```

**关键设计决策**：URL 使用 `projectId`（PostgreSQL UUID），但后端 ClickHouse 查询需要 `appId`（自定义唯一标识符）。必须先用 `useProject` 加载项目，再取 `project.appId` 发起监控数据请求。

---

## 类型系统（src/types/error-log.ts）

```typescript
export type ErrorType = 'js' | 'resource' | 'promise' | 'framework'
export type TimeRange = '24h' | '7d' | '30d'

export interface ErrorLog {
  trace_id: string
  app_id: string
  user_id: string
  page: string
  error_type: ErrorType
  message: string
  stack: string
  filename: string
  lineno: number
  colno: number
  ua: string
  created_at: string
}

export interface ErrorStats {
  trend: ErrorTrendPoint[]          // 折线图数据
  typeDistribution: ErrorTypeItem[] // 各类型总数（卡片用）
  topErrors: TopErrorItem[]         // 高频错误 TOP 10
}

export interface ErrorQueryParams extends BaseMonitorQueryParams {
  errorType?: string
  page?: number
  pageSize?: number
}
```

---

## 后端 API 对接（src/services/error.service.ts）

| 端点 | 方法 | 用途 |
|---|---|---|
| `GET /monitor/errors` | `getErrorsApi(params)` | 获取分页错误日志 |
| `GET /monitor/errors/stats` | `getErrorStatsApi(params)` | 获取统计数据（趋势+分布+TOP10）|

**关键实现**：服务层在发请求前清理空字符串参数，避免 `errorType=` 出现在 query string 中干扰后端查询。

---

## 组件说明

### ErrorStatsCards
- 从 `typeDistribution` 中按 `errorType` 过滤统计各类型数量
- 4 个卡片：总数（红）/ JS 错误（橙）/ 资源错误（黄）/ Promise 错误（紫）
- 加载中显示 pulse skeleton

### ErrorTrendChart
- 使用 `recharts` `LineChart` + `ResponsiveContainer`（高度 200px）
- 主题色：线 `#6a5fc1`，高亮点 `#c2ef4e`，网格 `#362d59`，文字 `#79628c`
- 自定义 Tooltip 组件，日期格式 MM/DD

### TopErrorsTable
- 数据来自 `stats.topErrors`（按 message 聚合，count 降序）
- 前 3 名用金/橙/黄色序号高亮
- 使用新增的 `Table` shadcn/ui 组件

### ErrorTable
- 分页（服务端）：每页 20 条，上一页/下一页按钮
- errorType 下拉过滤（SelectTrigger 内部用 `<div>` 而非 `<span>`，规避 `[&>span]:line-clamp-1` 导致的竖排问题）
- 关键词搜索：前端过滤当前页数据（后端不支持全文检索）
- 行点击触发详情弹窗

### ErrorDetailDialog
- 基于已有的 `Dialog` shadcn/ui 组件
- 显示：错误类型 badge + 消息（头部），元数据网格（filename/page/user_id/trace_id/时间/UA），Stack Trace 代码块（含复制按钮）
- Stack Trace 样式：lime 文字 + 深色背景 + 最大高度 18rem 可滚动

---

## 状态管理（ErrorsPage）

| 状态 | 类型 | 说明 |
|---|---|---|
| `timeRange` | `'24h' \| '7d' \| '30d'` | 全局时间窗口，影响 stats + list |
| `currentPage` | `number` | 错误日志分页，切换 timeRange 或 errorType 时重置为 1 |
| `errorType` | `string` | 类型过滤，空字符串表示全部 |
| `selectedLog` | `ErrorLog \| null` | 当前打开详情的日志条目 |
| `detailOpen` | `boolean` | 详情弹窗显隐 |

---

## 第 20 章建议扩展方向

- **性能监控看板**：复用本章的三层架构（service → hook → page），接入 `GET /monitor/performance` 端点，展示 FCP / LCP / CLS 等核心 Web 指标趋势
- **用户行为分析**：基于 `GET /monitor/behavior` 接入点击、PV/UV 数据
- **Source Map 解析**：为 JS 错误的 stack trace 提供更友好的源码位置展示
- **告警规则配置**：基于错误阈值发送通知（需后端支持）
