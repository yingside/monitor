# 项目上下文文档 — 第 20 章新增部分

> 本文档在第 19 章 `ch19-error-dashboard.md` 基础上**追加**第 20 章内容。
> 第 19 章原始状态请查阅 `ch19-error-dashboard.md`。

---

## 第 20 章变更摘要

### 新增文件清单

```
apps/frontend/monitor/src/
├── types/
│   └── performance.ts                 ← 性能监控数据类型定义
├── services/
│   └── performance.service.ts         ← 性能监控 API 调用封装
├── hooks/
│   └── usePerformance.ts              ← usePerformanceLogs / usePerformanceStats TanStack Query hooks
└── components/performance/
    ├── VitalsCards.tsx                ← Core Web Vitals 评分卡（6 个指标含进度条）
    ├── LcpTrendChart.tsx              ← LCP 趋势折线图（含 Good/Poor 阈值参考线）
    ├── MetricsQuantileChart.tsx       ← P50/P75/P95 分组柱状图（FCP/LCP/TTFB/Load）
    └── SlowPagesTable.tsx             ← 最慢页面 Top 10 表格（排名 + LCP 评级 badge）
```

### 修改文件清单

| 文件 | 修改内容 |
|---|---|
| `apps/backend/monitor-server/src/monitor-data/monitor-data.service.ts` | `getPerformanceStats` 由 2 个查询扩展为 4 个，新增 `quantiles`（P50/P75/P95）和 `topSlowPages` 返回字段 |
| `pages/performance/PerformancePage.tsx` | 从第 17 章占位骨架改为完整的性能监控看板 |
| `vite.config.ts` | `server.warmup.clientFiles` 加入 `PerformancePage.tsx` |

### 新增依赖

本章无新增 npm 依赖（`recharts` 已在第 17 章预装）。

---

## 架构：性能监控数据流

```
URL: /projects/:projectId/performance

  useProject(projectId)  ← 优先从 Zustand store 取（双层保障，同第 19 章）

  → project.appId

  → usePerformanceStats({ appId, startTime, endTime })
  → GET /monitor/performance/stats
  → ClickHouse 4 个并行查询：
      ① avgIf(fcp/lcp/fid/cls/ttfb/load_time)  → summary（均值摘要）
      ② toDate + avgIf(lcp)                     → lcpTrend（LCP 每日趋势）
      ③ quantileIf(0.5/0.75/0.95)(fcp/lcp/...) → quantiles（分位数）
      ④ GROUP BY page + avgIf(lcp) ORDER BY DESC → topSlowPages（最慢页面）
  → { summary, lcpTrend, quantiles, topSlowPages }

  分发给 4 个组件：
    summary      → VitalsCards
    lcpTrend     → LcpTrendChart
    quantiles    → MetricsQuantileChart
    topSlowPages → SlowPagesTable
```

---

## 后端 API 变更（monitor-data.service.ts）

### `getPerformanceStats` 返回结构（扩展后）

```typescript
// GET /monitor/performance/stats → 完整返回结构
{
  summary: {
    avgFcp: number      // FCP 均值（ms）
    avgLcp: number      // LCP 均值（ms）
    avgFid: number      // FID 均值（ms）
    avgCls: number      // CLS 均值（无单位，保留 4 位小数）
    avgTtfb: number     // TTFB 均值（ms）
    avgLoadTime: number // Load Time 均值（ms）
  },
  lcpTrend: [{ date: 'YYYY-MM-DD', avgLcp: number }],   // 每日 LCP 趋势
  quantiles: {
    fcp:      { p50: number, p75: number, p95: number }  // ms
    lcp:      { p50: number, p75: number, p95: number }  // ms
    ttfb:     { p50: number, p75: number, p95: number }  // ms
    loadTime: { p50: number, p75: number, p95: number }  // ms
  },
  topSlowPages: [
    { page: string, avgLcp: number, avgFcp: number, count: number }
  ]   // 按 avgLcp 降序，最多 10 条
}
```

### 关键 SQL 技术点

- `quantileIf(level)(expr, condition)` — ClickHouse 条件分位数函数，排除 0 值
- `HAVING avgLcp > 0` — 过滤掉没有 LCP 数据的页面（如非 HTML 页面请求）

---

## 类型系统（src/types/performance.ts）

```typescript
export type TimeRange = '24h' | '7d' | '30d'
export type VitalRating = 'good' | 'needs-improvement' | 'poor'

export interface MetricQuantile { p50: number; p75: number; p95: number }
export interface PerformanceQuantiles {
  fcp: MetricQuantile; lcp: MetricQuantile
  ttfb: MetricQuantile; loadTime: MetricQuantile
}
export interface PerformanceSummary {
  avgFcp: number; avgLcp: number; avgFid: number
  avgCls: number; avgTtfb: number; avgLoadTime: number
}
export interface LcpTrendPoint { date: string; avgLcp: number }
export interface SlowPage { page: string; avgLcp: number; avgFcp: number; count: number }
export interface PerformanceStats {
  summary: PerformanceSummary
  lcpTrend: LcpTrendPoint[]
  quantiles: PerformanceQuantiles
  topSlowPages: SlowPage[]
}
export interface PerformanceStatsParams { appId: string; startTime?: string; endTime?: string }
```

---

## 组件说明

### VitalsCards

- 6 张卡片：FCP / LCP / FID / CLS / TTFB / Load
- 每张卡片：均值显示 + 评级 badge（Good/Needs Improvement/Poor） + 三段式进度条
- 评级阈值来自 Google Core Web Vitals 官方标准：
  - FCP：Good ≤ 1800ms，Poor > 3000ms
  - LCP：Good ≤ 2500ms，Poor > 4000ms
  - FID：Good ≤ 100ms，Poor > 300ms
  - CLS：Good ≤ 0.1，Poor > 0.25（无单位）
  - TTFB：Good ≤ 800ms，Poor > 1800ms
  - Load：Good ≤ 2500ms，Poor > 5000ms（非官方 Web Vital，参考值）
- `value = 0` 时认为"无数据"，显示 `—`，不标 Poor

### LcpTrendChart

- Recharts `LineChart` + `ResponsiveContainer`（高度 208px）
- 折线：`stroke="#6a5fc1"`，高亮点：`fill="#c2ef4e"`
- 网格：`stroke="#362d59"`，轴标签：`fill="#79628c"`
- 两条 `ReferenceLine`：2500ms（绿色虚线，Good 上限）+ 4000ms（红色虚线，Poor 下限）
- X 轴格式：`YYYY-MM-DD` → `MM-DD`（截取 `date.slice(5)`）

### MetricsQuantileChart

- Recharts `BarChart` 分组柱状图
- 4 组：FCP / LCP / TTFB / Load，每组 3 柱：P50 / P75 / P95
- P50/P75：`fill="#6a5fc1"` 不同透明度；P95：`fill="#c2ef4e"`（Lime 强调色）
- 自定义 `CustomTooltip`（显示各分位数值 + ms 单位）

### SlowPagesTable

- 使用已有的 shadcn/ui `Table` 组件（第 19 章新增 `components/ui/table.tsx`）
- 列：排名 / 页面 URL / Avg LCP（含评级 badge）/ Avg FCP / 采集次数
- 前 3 名：金色 / 银色 / 铜色序号高亮
- LCP 评级复用同 VitalsCards 的阈值判断逻辑（Good ≤ 2500ms，Poor > 4000ms）

---

## 状态管理（PerformancePage）

| 状态 | 类型 | 说明 |
|---|---|---|
| `timeRange` | `'24h' \| '7d' \| '30d'` | 全局时间窗口，影响所有图表 |

> 本章无分页、无过滤器状态（所有数据聚合后一次性展示）。

---

## 第 21 章建议扩展方向

- **用户行为看板**：PV/UV 趋势折线图 + 热门页面 Top 10，接入 `GET /monitor/behaviors/stats`
- **API 监控看板**：请求成功率趋势 + 慢接口 Top 10 + 异常接口列表，接入 `GET /monitor/apis/stats`
- 两个看板均在同一章实现（第 21 章），路由已在第 17 章占位
- 对应占位页面：`BehaviorsPage.tsx` 和 `ApisPage.tsx`
- 建议将两类数据拆成两个 section，但共用同一个时间范围选择器（全局联动）
