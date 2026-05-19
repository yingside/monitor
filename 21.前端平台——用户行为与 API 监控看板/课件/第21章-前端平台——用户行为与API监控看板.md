# 第 21 章：前端平台——用户行为与 API 监控看板

---

## 本章目标

> **一句话说清楚要做什么：**  
> 沿用前两章（错误/性能看板）确立的"Service → Hook → Page + 组件"套路，  
> 把**用户行为数据（PV/UV）**和**API 请求监控数据**变成两个完整的可视化看板；  
> 同时实现一个支持"自定义日期范围"的通用时间选择器，替代之前只能选 24h/7d/30d 的简单按钮。

**本章结束后，两个占位页将变为完整看板：**

| 页面 | 路由 | 核心内容 |
|------|------|----------|
| 用户行为看板 | `/projects/:id/behaviors` | PV/UV 趋势图 + 热门页面 Top 10 |
| API 监控看板 | `/projects/:id/apis` | 成功率/耗时卡片 + 趋势折线图 + 慢接口表格 |

**本章涉及的改动文件：**

```
# 后端（无改动）
# 行为/API 相关接口在第 16 章已完整实现

# 前端（新增）
apps/frontend/monitor/src/
├── types/
│   ├── behavior.ts                    ← 用户行为数据类型
│   └── api-monitor.ts                 ← API 监控数据类型
├── services/
│   ├── behavior.service.ts            ← 行为监控 HTTP 封装
│   └── api-monitor.service.ts         ← API 监控 HTTP 封装
├── hooks/
│   ├── useBehavior.ts                 ← TanStack Query hooks（行为）
│   └── useApiMonitor.ts               ← TanStack Query hooks（API）
└── components/
    ├── behavior/
    │   ├── BehaviorSummaryCards.tsx   ← 统计摘要卡片
    │   ├── PvUvTrendChart.tsx         ← PV/UV 双轴折线图
    │   └── TopPagesTable.tsx          ← 热门页面表格
    ├── api-monitor/
    │   ├── ApiSummaryCards.tsx        ← API 统计摘要卡片
    │   ├── ApiTrendChart.tsx          ← 耗时与错误率趋势图
    │   └── SlowApisTable.tsx          ← 慢接口 Top 10 表格
    └── common/
        └── TimeRangeSelector.tsx      ← 通用时间范围选择器（新特性）

# 前端（修改）
apps/frontend/monitor/src/pages/behaviors/BehaviorsPage.tsx  ← 替换占位骨架
apps/frontend/monitor/src/pages/apis/ApisPage.tsx            ← 替换占位骨架
apps/frontend/monitor/vite.config.ts                         ← warmup 新增两个页面
```

---

## 前置回顾

第 17 章为两个看板页建立了**占位骨架**（全是 `animate-pulse` 加载动画）；  
第 16 章的后端 `monitor-server` 已经有了全部四类数据的统计接口：

```
GET /monitor/behaviors/stats  → { pvuvTrend, topPages }
GET /monitor/apis/stats       → { summary, trend, slowApis }
```

本章的工作重心在**前端**：把骨架页替换为真正能展示数据的看板。

---

## 前置准备

### 启动完整开发环境

```bash
# 终端 1：基础设施（Kafka + ClickHouse + PostgreSQL）
pnpm infra:start

# 终端 2：DSN Server（接收 SDK 上报数据，端口 3000）
pnpm dsn-server

# 终端 3：Consumer Server（Kafka → ClickHouse）
pnpm consumer-server

# 终端 4：monitor-server（平台 API，端口 3003）
pnpm monitor-server

# 终端 5：前端（端口 5173）
pnpm frontend
```

### 注入测试数据（可选）

如果 ClickHouse 的 `behavior_logs` 和 `api_logs` 表中还没有数据，用下面的 SQL 向 ClickHouse 控制台（`http://localhost:8123/play`）插入：

**行为数据：**

```sql
-- 将 'your-app-id' 替换为项目的真实 appId
INSERT INTO monitor.behavior_logs
  (trace_id, app_id, user_id, page, action_type, element, extra, ua, created_at)
VALUES
  (generateUUIDv4(), 'your-app-id', 'u001', 'https://example.com/',         'page_view', '', '', 'Chrome/120', now() - INTERVAL 1 DAY),
  (generateUUIDv4(), 'your-app-id', 'u002', 'https://example.com/',         'page_view', '', '', 'Safari/17',  now() - INTERVAL 1 DAY),
  (generateUUIDv4(), 'your-app-id', 'u001', 'https://example.com/about',    'page_view', '', '', 'Chrome/120', now() - INTERVAL 2 DAY),
  (generateUUIDv4(), 'your-app-id', 'u003', 'https://example.com/products', 'page_view', '', '', 'Firefox/121',now() - INTERVAL 2 DAY),
  (generateUUIDv4(), 'your-app-id', 'u001', 'https://example.com/',         'click', '#btn-cta', '', 'Chrome/120', now() - INTERVAL 3 DAY),
  (generateUUIDv4(), 'your-app-id', 'u004', 'https://example.com/',         'page_view', '', '', 'Chrome/120', now() - INTERVAL 3 DAY),
  (generateUUIDv4(), 'your-app-id', 'u005', 'https://example.com/contact',  'page_view', '', '', 'Chrome/120', now() - INTERVAL 4 DAY)
```

**API 数据：**

```sql
INSERT INTO monitor.api_logs
  (trace_id, app_id, user_id, page, method, url, status, duration, request_size, response_size, success, ua, created_at)
VALUES
  (generateUUIDv4(), 'your-app-id', 'u001', '/', 'GET',  '/api/products',      200, 120.5,  0,    1024,  true,  'Chrome/120', now() - INTERVAL 1 DAY),
  (generateUUIDv4(), 'your-app-id', 'u002', '/', 'POST', '/api/cart',          201, 85.3,   512,  256,   true,  'Safari/17',  now() - INTERVAL 1 DAY),
  (generateUUIDv4(), 'your-app-id', 'u003', '/', 'GET',  '/api/recommendations',200, 3200.0, 0,   4096,  true,  'Chrome/120', now() - INTERVAL 2 DAY),
  (generateUUIDv4(), 'your-app-id', 'u001', '/', 'GET',  '/api/user/profile',  401, 22.1,   0,    128,   false, 'Chrome/120', now() - INTERVAL 2 DAY),
  (generateUUIDv4(), 'your-app-id', 'u004', '/', 'POST', '/api/order',         500, 1850.0, 2048, 0,     false, 'Firefox/121',now() - INTERVAL 3 DAY),
  (generateUUIDv4(), 'your-app-id', 'u002', '/', 'GET',  '/api/products',      200, 145.2,  0,    1024,  true,  'Safari/17',  now() - INTERVAL 3 DAY),
  (generateUUIDv4(), 'your-app-id', 'u005', '/', 'GET',  '/api/recommendations',200, 4800.0, 0,   4096,  true,  'Chrome/120', now() - INTERVAL 4 DAY)
```

---

## 21.1 PV 和 UV 是什么

> 📖 **术语：PV（Page View，页面浏览量）**  
> 白话：每次有人打开（或刷新）一个页面，就计 1 次 PV。  
> 同一个人打开 5 次，就是 5 PV。  
> 术语：衡量内容被浏览的总次数。

> 📖 **术语：UV（Unique Visitor，唯一访客数）**  
> 白话：同一个用户不管访问多少次，都只算 1 个 UV。  
> 术语：在统计周期内不重复的独立用户数量。

**两个指标联合分析有什么用？**

| 场景 | PV | UV | 结论 |
|------|----|----|------|
| 推广活动 Day 1 | 10000 | 5000 | 每人平均看 2 页，效果不错 |
| 推广活动 Day 2 | 10000 | 500 | 每人平均看 20 页，可能是爬虫！ |
| 核心功能页 | 低 | 高 | 用户进来就离开，需要优化内容 |

> 🏗️ **架构思考：UV 为什么用 `uniq(user_id)` 而不是 `COUNT(DISTINCT user_id)`？**
>
> ClickHouse 的 `uniq()` 使用 **HyperLogLog 算法**，对亿级数据做近似去重，误差率约 2.3%，但速度比精确的 `COUNT(DISTINCT)` 快 5~10 倍。
> 对于监控看板，UV "大约 500" 和 "精确 497" 没有实质差别，用近似值完全够用。
> 只有在需要"精确按用户计费"的场景才用 `COUNT(DISTINCT)`。
> **选择近似去重 = 用可接受的精度换取不可接受的性能代价。**

---

## 21.2 执行步骤概览

```
Step 1  新增类型定义（behavior.ts / api-monitor.ts）
Step 2  新增服务层（behavior.service.ts / api-monitor.service.ts）
Step 3  新增 Hooks（useBehavior.ts / useApiMonitor.ts）
Step 4  实现通用时间范围选择器（TimeRangeSelector.tsx）
Step 5  实现用户行为组件（3 个）
Step 6  实现 API 监控组件（3 个）
Step 7  完整实现 BehaviorsPage.tsx
Step 8  完整实现 ApisPage.tsx
Step 9  更新 vite.config.ts
```

---

## 21.3 Step 1：新增类型定义

> 📖 **术语：类型先行（Type-First）**  
> 白话：写代码前先把"数据长什么样"用 TypeScript 类型写清楚，  
> 这样 IDE 能帮你自动补全，也能在编译阶段发现前后端数据结构不一致的问题。

新增两个类型文件，**严格按照后端接口的实际返回结构定义**（这是第 13 章确立的强制规则）。

### 新建 `src/types/behavior.ts`

```typescript
/** PV/UV 每日趋势数据点（用于折线图） */
export interface PvUvTrendPoint {
  date: string  // 'YYYY-MM-DD'
  pv: number    // 当日页面浏览量
  uv: number    // 当日唯一访客数
}

/** 热门页面数据项（按 PV 降序，Top 10） */
export interface TopPage {
  page: string  // 页面 URL
  pv: number
  uv: number
}

/**
 * GET /monitor/behaviors/stats 响应结构
 */
export interface BehaviorStats {
  pvuvTrend: PvUvTrendPoint[]
  topPages: TopPage[]
}
```

### 新建 `src/types/api-monitor.ts`

> ⚠️ **注意命名**：文件名是 `api-monitor.ts`，不是 `api.ts`。  
> `src/types/api.ts` 已经存在，定义的是"前端调用后端的通用响应包装格式 `{ code, data, message }`"，  
> 两者职责完全不同，不能合并。

```typescript
/** API 整体统计摘要 */
export interface ApiSummary {
  total: number
  successCount: number
  errorCount: number
  successRate: number    // 0 ~ 100（百分比）
  avgDuration: number    // ms
  p95Duration: number    // ms
}

/** API 每日趋势数据点 */
export interface ApiTrendPoint {
  date: string         // 'YYYY-MM-DD'
  avgDuration: number  // ms
  errorRate: number    // 0 ~ 100（百分比）
}

/** 慢接口数据项（Top 10） */
export interface SlowApi {
  url: string
  method: string
  avgDuration: number  // ms
  p95Duration: number  // ms
  total: number
  errorRate: number    // %
}

/** GET /monitor/apis/stats 响应结构 */
export interface ApiMonitorStats {
  summary: ApiSummary
  trend: ApiTrendPoint[]
  slowApis: SlowApi[]
}
```

> 📖 **术语：P95 耗时（95th Percentile Duration）**  
> 白话：把所有请求的耗时从快到慢排列，P95 是第 95% 位置那个值。  
> 意思是：95% 的请求比这个快，只有最慢的 5% 比这个慢。  
> 比均值更能反映"尾部用户"（那些网络差或服务器压力大时段的用户）的真实体验。  
> 互联网公司通常以 P99 作为 SLO（服务级别目标），我们这里用 P95 作为参考。

---

## 21.4 Step 2：新增服务层

服务层负责：**封装 HTTP 请求，解包响应，屏蔽 axios 细节**。  
每个模块对应一个 `services/xxx.service.ts` 文件（三层架构第三层）。

### 新建 `src/services/behavior.service.ts`

```typescript
import request from '@/utils/request'
import type { ApiResponse, PaginatedData } from '@/types/api'
import type { BehaviorLog, BehaviorStats, BehaviorQueryParams, BehaviorStatsParams } from '@/types/behavior'

/** GET /monitor/behaviors — 行为日志列表（分页） */
export async function getBehaviorLogsApi(params: BehaviorQueryParams): Promise<PaginatedData<BehaviorLog>> {
  const { data } = await request.get<ApiResponse<PaginatedData<BehaviorLog>>>(
    '/monitor/behaviors', { params }
  )
  return data.data
}

/** GET /monitor/behaviors/stats — PV/UV 趋势 + 热门页面 Top 10 */
export async function getBehaviorStatsApi(params: BehaviorStatsParams): Promise<BehaviorStats> {
  const { data } = await request.get<ApiResponse<BehaviorStats>>(
    '/monitor/behaviors/stats', { params }
  )
  return data.data
}
```

### 新建 `src/services/api-monitor.service.ts`

```typescript
import request from '@/utils/request'
import type { ApiResponse, PaginatedData } from '@/types/api'
import type { ApiLog, ApiMonitorStats, ApiQueryParams, ApiStatsParams } from '@/types/api-monitor'

/** GET /monitor/apis — API 日志列表（分页） */
export async function getApiMonitorLogsApi(params: ApiQueryParams): Promise<PaginatedData<ApiLog>> {
  const { data } = await request.get<ApiResponse<PaginatedData<ApiLog>>>(
    '/monitor/apis', { params }
  )
  return data.data
}

/** GET /monitor/apis/stats — 摘要 + 趋势 + 慢接口 Top 10 */
export async function getApiMonitorStatsApi(params: ApiStatsParams): Promise<ApiMonitorStats> {
  const { data } = await request.get<ApiResponse<ApiMonitorStats>>(
    '/monitor/apis/stats', { params }
  )
  return data.data
}
```

---

## 21.5 Step 3：新增 Hooks

Hooks 负责：**调用 Service 函数，用 TanStack Query 管理缓存和加载状态**。  
一个 Hook 对应一个查询场景，Page 层直接调用 Hook。

### 新建 `src/hooks/useBehavior.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { getBehaviorLogsApi, getBehaviorStatsApi } from '@/services/behavior.service'
import type { BehaviorQueryParams, BehaviorStatsParams } from '@/types/behavior'

export const BEHAVIOR_QUERY_KEYS = {
  list: (params: BehaviorQueryParams) => ['monitor', 'behavior', 'list', params] as const,
  stats: (params: BehaviorStatsParams) => ['monitor', 'behavior', 'stats', params] as const,
}

export function useBehaviorLogs(params: BehaviorQueryParams) {
  return useQuery({
    queryKey: BEHAVIOR_QUERY_KEYS.list(params),
    queryFn: () => getBehaviorLogsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 30,
  })
}

export function useBehaviorStats(params: BehaviorStatsParams) {
  return useQuery({
    queryKey: BEHAVIOR_QUERY_KEYS.stats(params),
    queryFn: () => getBehaviorStatsApi(params),
    enabled: Boolean(params.appId),
    staleTime: 1000 * 60,
  })
}
```

### 新建 `src/hooks/useApiMonitor.ts`

同上模式，`queryFn` 换为 `getApiMonitorLogsApi` / `getApiMonitorStatsApi`。

---

## 21.6 Step 4：通用时间范围选择器（本章新特性）

> 🏗️ **架构思考：为什么要把时间选择器独立成通用组件？**
>
> 第 19、20 章的时间选择器（24h/7d/30d 按钮）是直接写在 ErrorsPage 和 PerformancePage 里的，
> 如果本章继续复制一遍，四个看板页就有四份完全相同的代码。
> 而且本章需要新增"自定义日期范围"功能，改动点只有一处逻辑，应该放在同一个地方维护。
>
> **单一数据源（Single Source of Truth）原则**：
> 相同逻辑只写一次，改一处所有用到的地方都跟着变。
> 这就是提取 `TimeRangeSelector` 的核心动机。

### 功能设计

`components/common/TimeRangeSelector.tsx` 支持两种模式：

| 模式 | 触发方式 | 说明 |
|------|----------|------|
| `preset` | 点击 24H / 7D / 30D 按钮 | 快捷预设，与前两章一致 |
| `custom` | 点击"自定义"按钮展开 | 选择具体的开始/结束日期 |

**关键设计决策：**
- 使用**原生 `<input type="date">`** 而非 `react-day-picker` 等三方日历库 → 零额外依赖
- 完全**受控组件**（所有状态由父组件 Page 维护）→ 更易测试和调试
- 工具函数（`getPresetTimeRange` / `getCustomTimeRange`）单独导出 → 供 Page 层在 `useMemo` 中调用

**⚠️ 重要：延续 queryKey 稳定性规则**

第 19 章曾遇到过这个 bug：`getTimeRangeParams()` 在每次渲染时都调用 `new Date()`，  
导致 queryKey 每次都是新字符串 → TanStack Query 认为是新查询 → 无限 isLoading。

**解决方案**：在 Page 里用 `useMemo` 包裹时间范围计算：

```tsx
// BehaviorsPage.tsx
const { startTime, endTime } = useMemo(() => {
  if (mode === 'custom' && (customRange.from || customRange.to)) {
    return getCustomTimeRange(customRange)
  }
  return getPresetTimeRange(preset)
}, [mode, preset, customRange])  // ← 依赖项稳定才触发重算
```

### 组件对外 API

```typescript
// 导出的类型
export interface DateRange { from: string | undefined; to: string | undefined }
export type TimeRangeMode = 'preset' | 'custom'
export type PresetRange = '24h' | '7d' | '30d'

// 导出的工具函数
export function getPresetTimeRange(preset: PresetRange): { startTime: string; endTime: string }
export function getCustomTimeRange(range: DateRange): { startTime: string; endTime: string }

// 组件 Props
interface TimeRangeSelectorProps {
  mode: TimeRangeMode;        onModeChange: (m: TimeRangeMode) => void
  preset: PresetRange;        onPresetChange: (p: PresetRange) => void
  customRange: DateRange;     onCustomChange: (r: DateRange) => void
}
```

---

## 21.7 Step 5：实现用户行为组件

### `BehaviorSummaryCards.tsx` — 统计摘要卡片

4 张卡片，**汇总计算来自 `pvuvTrend` 数组**（不是后端单独返回，而是前端计算）：

```typescript
// 汇总计算（在组件内）
const totalPv = stats.pvuvTrend.reduce((sum, d) => sum + d.pv, 0)
const totalUv = stats.pvuvTrend.reduce((sum, d) => sum + d.uv, 0)
const lastDay = stats.pvuvTrend[stats.pvuvTrend.length - 1]
const todayPv = lastDay?.pv ?? 0
```

| 卡片 | 值 | 图标色 |
|------|----|--------|
| Total PV | 汇总 pv | `#6a5fc1` |
| Total UV | 汇总 uv | `#c2ef4e` |
| Last Day PV | 最后一天 pv | `#fa7faa` |
| Hot Pages | topPages.length | `#ffb287` |

> 🏗️ **架构思考：为什么在前端计算汇总，而不是让后端直接返回？**
>
> 后端已经返回了 `pvuvTrend`（每天的 PV/UV），前端汇总只是简单的 `reduce`。
> 如果再加一个后端字段，就需要改 DTO → Service → Controller → 接口文档，改动范围大。
> 而且前端自己算能保证汇总的时间范围与图表展示的时间范围**绝对一致**（都来自同一份数据）。
> **原则：能在前端算的就在前端算，避免为简单聚合修改后端接口。**

### `PvUvTrendChart.tsx` — 双轴折线图

> 📖 **术语：双 Y 轴（Dual Y-Axis）**  
> 白话：同一张图里，左边有一把刻度尺，右边也有一把刻度尺，两条线各用自己那把。  
> 用途：当两条数据线的量级差异很大时，共用一把刻度尺会让其中一条线"贴底"看不清趋势。

**关键实现**：每条 `<Line>` 必须通过 `yAxisId` 属性和对应 `<YAxis>` 绑定：

```tsx
<YAxis yAxisId="pv" orientation="left"  />    {/* 左轴：PV */}
<YAxis yAxisId="uv" orientation="right" />    {/* 右轴：UV */}
<Line yAxisId="pv" dataKey="pv" stroke="#6a5fc1" />
<Line yAxisId="uv" dataKey="uv" stroke="#c2ef4e" />
```

如果漏写 `yAxisId`，Recharts 会把两条线都挂到第一个 `<YAxis>`，双轴失效。

### `TopPagesTable.tsx` — 热门页面表格

表格列：排名 / 页面 URL / PV / UV / **UV/PV 比率**

**UV/PV 比率的含义**：
- 比率高（接近 100%）→ 大量新用户首次访问，推广效果好
- 比率低（如 10%）→ 大量用户反复访问同一页面，内容吸引力强（或用户迷路了）

---

## 21.8 Step 6：实现 API 监控组件

### `ApiSummaryCards.tsx` — 统计摘要卡片

4 张卡片，数据来自 `stats.summary`：

| 卡片 | 值 | 特别逻辑 |
|------|----|----------|
| Total Requests | summary.total | — |
| Success Rate | summary.successRate% | ≥99% 绿 / 95-99% 橙 / <95% 红 |
| Avg Duration | summary.avgDuration ms | — |
| P95 Duration | summary.p95Duration ms | — |

**成功率颜色判断：**

```typescript
function getSuccessRateColor(rate: number): string {
  if (rate >= 99) return 'text-[#4ade80]'  // 绿
  if (rate >= 95) return 'text-[#ffb287]'  // 橙
  return 'text-red-400'                    // 红
}
```

> 🏗️ **架构思考：为什么用 99% 和 95% 作为阈值？**
>
> - **99%**：业界 SLA（服务级别协议）常用标准，99% 意味着全天最多 ~14 分钟不可用
> - **95%**：介于警告和正常之间，提醒开发者关注但未达严重级别
> - **< 95%**：意味着每 20 次请求里就有 1 次失败，用户体验已受到明显影响
> 
> 这些数字不是绝对的，每个业务根据实际 SLA 调整即可。

### `ApiTrendChart.tsx` — 双轴趋势折线图

与 PvUvTrendChart 结构相同，但内容不同：
- 左轴：平均耗时（ms），折线色 `#6a5fc1`
- 右轴：错误率（%），折线色 `#fa7faa`

**额外特性：错误率警戒线**

```tsx
// 当任意一天错误率 > 5% 时，展示水平参考线
const hasHighErrorRate = data.some(d => d.errorRate > 5)

{hasHighErrorRate && (
  <ReferenceLine
    yAxisId="errorRate"
    y={5}
    stroke="#fa7faa"
    strokeDasharray="4 4"
    label={{ value: '5%', position: 'insideTopRight', fill: '#fa7faa', fontSize: 10 }}
  />
)}
```

### `SlowApisTable.tsx` — 慢接口表格

**关键细节：HTTP 方法 Badge 配色**

| 方法 | 颜色 | 语义 |
|------|------|------|
| GET | 绿色 `#4ade80` | 只读，安全 |
| POST | 紫色 `#6a5fc1` | 创建/提交 |
| PUT | 橙色 `#ffb287` | 更新 |
| PATCH | 黄绿 `#c2ef4e` | 部分更新 |
| DELETE | 红色 `text-red-400` | 危险操作 |

**耗时格式化（`formatDuration`）**：

```typescript
function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`  // ≥ 1s 转成秒
  return `${ms.toFixed(0)}ms`
}
```

---

## 21.9 Step 7 & 8：实现完整页面

BehaviorsPage 和 ApisPage 的结构完全一致（模板化开发），关键点如下：

### 项目数据获取（双层保障，与 ErrorsPage 完全相同）

```tsx
// ① 优先从 Zustand store 读
const { currentProject } = useProjectStore()
const storeHasProject = currentProject?.id === projectId

// ② 仅在 store 未命中时（刷新、直链）才发 API 请求
const { data: fetchedProject, isLoading: projectLoading } = useProject(
  storeHasProject ? '' : (projectId ?? '')
)

const project = storeHasProject ? currentProject : fetchedProject
```

### 时间范围状态（新增 mode + customRange）

```tsx
const [mode, setMode] = useState<TimeRangeMode>('preset')
const [preset, setPreset] = useState<PresetRange>('7d')
const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined })

// ⚠️ useMemo：避免 queryKey 每次渲染都变 → 无限请求
const { startTime, endTime } = useMemo(() => {
  if (mode === 'custom' && (customRange.from || customRange.to)) {
    return getCustomTimeRange(customRange)
  }
  return getPresetTimeRange(preset)
}, [mode, preset, customRange])
```

---

## 21.10 Step 9：更新 `vite.config.ts`

在 `server.warmup.clientFiles` 中添加新页面，加快 Vite 开发服务器首次访问速度：

```ts
// vite.config.ts（追加到现有 warmup 列表末尾）
warmup: {
  clientFiles: [
    // ...已有文件...
    './src/pages/performance/PerformancePage.tsx',
    // 第 21 章新增
    './src/pages/behaviors/BehaviorsPage.tsx',
    './src/pages/apis/ApisPage.tsx',
  ],
},
```

---

## 21.11 关于"用户地域分布"（21.3）的说明

课程大纲 21.3 提到"用户地域分布"。  
要实现它，需要知道每个请求来自哪个城市/国家。通常有两种方案：

**方案一：服务端 IP 解析（推荐）**  
在 DSN Server 接收上报数据时，从请求的 IP 地址反查地理位置（使用 MaxMind GeoIP2 数据库），  
将 `city` / `country` 字段写入 `behavior_logs` 表。

**方案二：客户端采集（不推荐）**  
在 SDK 上报时附带 GPS 坐标或 IP，但浏览器 `navigator.geolocation` 需要用户授权，  
且用户 IP 不能在前端获取（前端只能看到自己的 IP，无法知道请求来源 IP）。

由于当前 `behavior_logs` 表结构**没有地理位置字段**，本章暂不实现此功能。  
如需加入，改动点为：DSN Server 解析 IP → 建表加字段 → 后端统计接口 → 前端展示。

> ⚠️ **课程深度说明**：地域分布需要集成 IP 地理位置数据库（MaxMind GeoLite2 免费版），属于扩展功能，本课程不展开，感兴趣的同学可以自行查阅 [MaxMind 官方文档](https://dev.maxmind.com/)。

---

## 21.12 本章完成后的验证清单

| 验证项 | 操作步骤 | 预期结果 |
|--------|----------|----------|
| 用户行为卡片显示数据 | 打开浏览器访问 `/projects/:id/behaviors` | 4 张卡片显示 PV/UV 数值，不是 0 |
| PV/UV 趋势图双轴正常 | 查看图表 | 两条折线高度都撑满，不出现一条线贴底 |
| 热门页面表格加载 | 查看表格 | Top 10 页面按 PV 降序排列 |
| API 监控卡片 | 访问 `/projects/:id/apis` | 成功率卡片颜色根据数值自动变化 |
| 慢接口 P95 排序 | 查看慢接口表格 | 耗时最长的接口排在第一行 |
| 自定义日期选择 | 点击"自定义"按钮 → 选择日期 → 观察图表 | 图表数据随日期范围联动更新 |
| 清除自定义范围 | 点击 ✕ 按钮 | 回到预设模式（7D） |

---

## 本章小结

| 模块 | 要点 |
|------|------|
| **PV/UV 指标** | PV 是总量，UV 是去重用户数；联合分析比单看一个更有意义 |
| **uniq() 近似去重** | ClickHouse HyperLogLog 算法，误差 2.3%，比 COUNT(DISTINCT) 快 5-10 倍 |
| **P95 耗时** | 比均值更能反映"尾部用户"真实体验，互联网公司 SLO 常用指标 |
| **TimeRangeSelector 设计** | 完全受控 + 工具函数 + 零依赖；useMemo 包裹防止 queryKey 不稳定 |
| **双 Y 轴** | 量级差异大的两条线需要各自的刻度轴，Recharts 通过 `yAxisId` 实现 |
| **地域分布的暂缓** | 需 DSN Server 解析 IP，当前 ClickHouse 表无此字段，本章不实现 |

至此，前端平台的**四大看板**全部完成：  
错误监控（第 19 章）→ 性能监控（第 20 章）→ 用户行为 + API 监控（第 21 章）。

下一章（第 22 章）将进行**端到端联调与测试**——  
用 demos 项目连接完整的真实数据链路，验证从 SDK 上报到平台展示的全流程是否打通。
