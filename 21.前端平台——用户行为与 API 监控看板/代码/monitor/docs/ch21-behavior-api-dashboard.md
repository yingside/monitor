# 项目上下文文档 — 第 21 章新增部分

> 本文档在第 20 章 `ch20-performance-dashboard.md` 基础上**追加**第 21 章内容。
> 前章原始状态请查阅 `ch20-performance-dashboard.md`。

---

## 第 21 章变更摘要

### 新增文件清单

```
apps/frontend/monitor/src/
├── types/
│   ├── behavior.ts                    ← 用户行为监控数据类型定义
│   └── api-monitor.ts                 ← API 请求监控数据类型定义
│                                         （注意与 types/api.ts 区分：那个是前端调用后端的通用响应格式）
├── services/
│   ├── behavior.service.ts            ← 行为监控 API 调用封装
│   └── api-monitor.service.ts         ← API 监控 API 调用封装
├── hooks/
│   ├── useBehavior.ts                 ← useBehaviorLogs / useBehaviorStats TanStack Query hooks
│   └── useApiMonitor.ts               ← useApiMonitorLogs / useApiMonitorStats TanStack Query hooks
└── components/
    ├── behavior/
    │   ├── BehaviorSummaryCards.tsx   ← 行为统计摘要卡片（总 PV/UV/热门页面数）
    │   ├── PvUvTrendChart.tsx         ← PV/UV 双轴双线趋势折线图
    │   └── TopPagesTable.tsx          ← 热门页面 Top 10 表格（含 UV/PV 比率）
    ├── api-monitor/
    │   ├── ApiSummaryCards.tsx        ← API 统计摘要卡片（成功率/耗时/P95）
    │   ├── ApiTrendChart.tsx          ← 耗时与错误率双轴趋势折线图
    │   └── SlowApisTable.tsx          ← 慢接口 Top 10 表格（含 HTTP 方法 Badge）
    └── common/
        └── TimeRangeSelector.tsx      ← 可复用时间范围选择器（预设 + 自定义日期范围）
```

### 修改文件清单

| 文件 | 修改内容 |
|---|---|
| `pages/behaviors/BehaviorsPage.tsx` | 从第 17 章占位骨架改为完整的用户行为看板 |
| `pages/apis/ApisPage.tsx` | 从第 17 章占位骨架改为完整的 API 监控看板 |
| `vite.config.ts` | `server.warmup.clientFiles` 加入 BehaviorsPage 和 ApisPage |

### 新增依赖

本章**无新增 npm 依赖**（`recharts` 已在第 17 章预装，TimeRangeSelector 使用原生 HTML date input）。

---

## 架构：用户行为监控数据流

```
URL: /projects/:projectId/behaviors

  useProject(projectId)  ← 优先从 Zustand store 取

  → project.appId

  → useBehaviorStats({ appId, startTime, endTime })
  → GET /monitor/behaviors/stats
  → ClickHouse 2 个并行查询：
      ① toDate + count() + uniq(user_id)           → pvuvTrend（每日 PV/UV）
      ② GROUP BY page + count() ORDER BY pv DESC   → topPages（热门页面 Top 10）
  → { pvuvTrend, topPages }

  分发给 3 个组件：
    pvuvTrend + topPages → BehaviorSummaryCards（汇总计算）
    pvuvTrend            → PvUvTrendChart
    topPages             → TopPagesTable
```

## 架构：API 请求监控数据流

```
URL: /projects/:projectId/apis

  → project.appId

  → useApiMonitorStats({ appId, startTime, endTime })
  → GET /monitor/apis/stats
  → ClickHouse 3 个并行查询：
      ① count + countIf(success) + avg(duration) + quantile(0.95) → summary
      ② toDate + avg(duration) + countIf(success=false)/count()   → trend
      ③ GROUP BY url,method + p95(duration) ORDER BY p95 DESC     → slowApis
  → { summary, trend, slowApis }

  分发给 3 个组件：
    summary  → ApiSummaryCards
    trend    → ApiTrendChart
    slowApis → SlowApisTable
```

---

## 前端新增类型定义

### behavior.ts

```typescript
interface PvUvTrendPoint { date: string; pv: number; uv: number }
interface TopPage         { page: string; pv: number; uv: number }
interface BehaviorStats   { pvuvTrend: PvUvTrendPoint[]; topPages: TopPage[] }
```

### api-monitor.ts

```typescript
interface ApiSummary {
  total: number; successCount: number; errorCount: number
  successRate: number; avgDuration: number; p95Duration: number
}
interface ApiTrendPoint  { date: string; avgDuration: number; errorRate: number }
interface SlowApi         { url: string; method: string; avgDuration: number; p95Duration: number; total: number; errorRate: number }
interface ApiMonitorStats { summary: ApiSummary; trend: ApiTrendPoint[]; slowApis: SlowApi[] }
```

---

## TimeRangeSelector 组件设计

**文件**: `components/common/TimeRangeSelector.tsx`

**导出物**:
```typescript
// 类型
export interface DateRange { from: string | undefined; to: string | undefined }
export type TimeRangeMode = 'preset' | 'custom'
export type PresetRange = '24h' | '7d' | '30d'

// 工具函数（供 Page 层 useMemo 使用）
export function getPresetTimeRange(preset: PresetRange): { startTime: string; endTime: string }
export function getCustomTimeRange(range: DateRange): { startTime: string; endTime: string }

// 组件
export default function TimeRangeSelector(props: TimeRangeSelectorProps): JSX.Element
```

**关键决策**:
- 使用**原生 `<input type="date">`** 而非 react-day-picker，零额外依赖
- 完全受控：所有状态由父组件维护（mode / preset / customRange），组件只负责 UI
- `getPresetTimeRange` / `getCustomTimeRange` 工具函数须在 `useMemo` 内调用（与 getTimeRangeParams 相同规则）

**使用方（BehaviorsPage / ApisPage）**:
```tsx
const { startTime, endTime } = useMemo(() => {
  if (mode === 'custom' && (customRange.from || customRange.to)) {
    return getCustomTimeRange(customRange)
  }
  return getPresetTimeRange(preset)
}, [mode, preset, customRange])
```

---

## 图表设计规范

### PvUvTrendChart — 双 Y 轴说明

PV 和 UV 量级差异大（PV 通常远大于 UV），使用双 Y 轴：
- 左 Y 轴 (`yAxisId="pv"`)：PV 浏览量，折线颜色 `#6a5fc1`
- 右 Y 轴 (`yAxisId="uv"`)：UV 访客数，折线颜色 `#c2ef4e`

### ApiTrendChart — 错误率警戒线

当任意一天 `errorRate > 5%` 时，自动展示红色参考线（`y=5`）：
```tsx
{hasHighErrorRate && (
  <ReferenceLine yAxisId="errorRate" y={5} stroke="#fa7faa" strokeDasharray="4 4" />
)}
```

---

## 成功率颜色规则（ApiSummaryCards）

| 成功率 | 颜色 |
|--------|------|
| ≥ 99%  | `#4ade80`（绿色）|
| 95~99% | `#ffb287`（橙色）|
| < 95%  | `text-red-400`（红色）|

---

## 后端 API（第 21 章无变更）

所有后端接口在**第 16 章**时已完整实现：

```
GET /monitor/behaviors       → getBehaviorLogs（分页列表）
GET /monitor/behaviors/stats → getBehaviorStats（PV/UV 趋势 + 热门页面）
GET /monitor/apis            → getApiLogs（分页列表，支持 url 过滤 + onlyFailed）
GET /monitor/apis/stats      → getApiStats（摘要 + 趋势 + 慢接口 Top 10）
```

**关键 ClickHouse SQL 技术点**:
- `uniq(user_id)` — ClickHouse 的 HyperLogLog 近似去重，性能远优于 `COUNT(DISTINCT)`
- `quantile(0.95)(duration)` — 百分位数函数，P95 代表"尾部用户"体验
- `countIf(success = false) / count() * 100` — 条件聚合计算错误率

---

## 第 21 章章节特有设计原则

### 1. 组件复用优先
`TimeRangeSelector` 设计为完全受控的通用组件，供 BehaviorsPage 和 ApisPage 复用，
未来可推广到 ErrorsPage 和 PerformancePage（替换原有的简单预设按钮）。

### 2. 地域分布功能说明
课程大纲 21.3 提到"用户地域分布"。由于 ClickHouse `behavior_logs` 表中没有 IP 或地理位置字段，
第 21 章**暂不实现**此功能。课件中会说明需要集成 IP 地理位置库（如 MaxMind GeoIP2）才能实现。

### 3. 三层架构一致性
本章严格遵循第 18 章确立的三层架构：
```
页面组件（BehaviorsPage / ApisPage）
    ↓ 调用
自定义 Hook（useBehavior / useApiMonitor）← TanStack Query
    ↓ 调用
Service 函数（behavior.service / api-monitor.service）← axios
```
