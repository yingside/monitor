# 项目上下文文档

> 本文档描述**第 11 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `11.SDK 上报——数据结构设计与上报策略/代码/monitor/` |
| **包管理器** | pnpm 10.33.0 |
| **构建工具** | Turborepo v2 |
| **Node.js** | v25.x |
| **语言** | 全量 TypeScript，禁用 `any`，SDK 边界处用 `unknown` |
| **模块规范** | 全量 ES Module |
| **代码风格** | 2 空格缩进 / 单引号 / 不加分号（Prettier 管理）|

---

## 二、Monorepo 目录结构

```
monitor/
├── packages/
│   ├── core/            @monitor/core — 框架无关核心逻辑
│   ├── browser/         @monitor/browser — 浏览器入口包 + 采集插件
│   ├── browser-utils/   @monitor/browser-utils — 纯工具函数
│   ├── vue/             @monitor/vue — Vue3 框架错误适配层（第 07 章实现）
│   └── react/           @monitor/react — React 框架错误适配层（第 07 章实现）
├── apps/backend/
│   ├── dsn-server/      数据接收服务（骨架）
│   └── monitor-server/  平台 API 服务（骨架）
├── demos/
│   ├── vue3-demo/       Vue3 接入演示
│   ├── react-demo/      React 接入演示
│   ├── mock-server/     本地 Mock API 服务器（第 10 章新增，端口 3002）
│   └── collect-server/  本地上报接收服务器（第 11 章新增，端口 3001）
├── docker/
├── docs/project-context.md
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 三、各包职责与状态

### @monitor/core（`packages/core/`）

**已实现**：`types.ts` / `monitor.ts` / `transport.ts`（第 11 章新增）/ `index.ts`

**第 11 章新增 `transport.ts`**：

```typescript
export class Transport {
  constructor(config: TransportConfig)
  enqueue(event: MonitorEvent): void   // 入队，满批立发
  flush(): void                        // 手动立即上报
  destroy(): void                      // 停止定时器+sendBeacon最后一批
}

export interface TransportConfig {
  dsn: string
  flushInterval: number    // 定时间隔（ms）
  maxBatchSize: number     // 每批最多条数
  debug: boolean
}
```

**`monitor.ts` 第 11 章变更**：
- 删除 `private queue: MonitorEvent[]`（旧内存缓冲）和 `_flush()` TODO 方法
- 新增 `private _transport: Transport | null = null`
- 新增 `private preInitQueue: MonitorEvent[]`（init 前的防御性缓冲）
- `init()` 中创建 Transport 实例，并把 preInitQueue 转交
- `capture()` 第 [3] 步改为 `this._transport?.enqueue(event)`
- 新增公开方法 `flush(): void`（调用 `this._transport?.flush()`）
- `destroy()` 中调用 `this._transport?.destroy()`

**`types.ts` 第 11 章变更**：
- `MonitorOptions` 新增：`flushInterval?: number`（默认 5000）、`maxBatchSize?: number`（默认 10）
- `ResolvedOptions` 同步新增：`flushInterval: number`、`maxBatchSize: number`
- DEFAULT_OPTIONS 新增对应默认值

**对外暴露（第 11 章新增）**：
```typescript
export { Transport }
export type { TransportConfig }
```

---

### @monitor/browser（`packages/browser/`）

**第 11 章变更**：`src/index.ts` 新增导出 `flush()` 函数

```typescript
export function flush(): void  // 手动触发立即上报（第 11 章新增）
```

完整对外 API：
```typescript
export function init(options: MonitorOptions): Monitor
export function getMonitor(): Monitor | null
export function capture(type: EventType, payload: unknown): void
export function use(plugin: Plugin): void
export function destroy(): void
export function flush(): void                          // 第 11 章新增
export function trackBehavior(name: string, extra?: Record<string, unknown>): void
export function getBreadcrumbs(): readonly BehaviorPayload[]

export { createErrorPlugin, createPerformancePlugin, createWebVitalsPlugin }
export { createBehaviorPlugin, getBreadcrumbs, createApiPlugin }
export { MONITOR_VERSION }
```

---

### @monitor/browser-utils / @monitor/vue / @monitor/react

**状态**：同第 10 章，本章无改动。

---

### demos/collect-server（第 11 章新增）

**位置**：`demos/collect-server/`

**职责**：本地接收 SDK 上报数据，模拟第 14 章将实现的 `dsn-server`（NestJS）。

**运行**：
```bash
# 从根目录
pnpm collect-server
# 或
pnpm --filter @monitor/collect-server dev
```

**端口**：3001（与 demos 中 `dsn: 'http://localhost:3001/collect'` 对齐）

**接口**：
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/collect` | 接收 `MonitorEvent[]` 批量数据，打印并返回 `{ code: 0 }` |
| GET | `/health` | 健康检查，返回 `{ status: 'ok', totalReceived }` |

---

### demos/mock-server（第 10 章已完成）

**位置**：`demos/mock-server/`，**端口**：3002，本章无改动。

---

## 四、核心类型定义（`packages/core/src/types.ts`）

### MonitorOptions（第 11 章新增字段）

```typescript
interface MonitorOptions {
  dsn: string           // 必填
  appId: string         // 必填
  userId?: string
  sampleRate?: number   // 默认 1
  plugins?: Plugin[]
  debug?: boolean       // 默认 false
  maxQueueSize?: number // 默认 20（预初始化缓冲上限）
  // 第 11 章新增：
  flushInterval?: number  // 定时刷新间隔（ms），默认 5000
  maxBatchSize?: number   // 每批最多事件数，默认 10
}
```

### MonitorEvent（上报信封，未变更）

```typescript
interface MonitorEvent {
  traceId: string      // 会话 ID（一次页面访问共享）
  appId: string        // 项目标识
  userId?: string      // 用户标识
  type: EventType      // 'error' | 'performance' | 'behavior' | 'api'
  payload: unknown     // 具体数据（各章定义的 XxxPayload）
  timestamp: number    // 毫秒级时间戳
  page: string         // 当前页面 URL
  ua: string           // User-Agent
}
```

### Payload 类型汇总（第 06-10 章，未变更）

```typescript
// 错误（第 06-07 章）
interface JsErrorPayload { subType: 'js'; message: string; filename: string; lineno: number; colno: number; stack: string; errorType: string }
interface ResourceErrorPayload { subType: 'resource'; tagName: string; src: string }
interface PromiseErrorPayload { subType: 'promise'; message: string; stack: string; reason: unknown }
interface FrameworkErrorPayload { subType: 'vue' | 'react'; message: string; stack: string; componentInfo?: string }

// 性能（第 08 章）
interface PerformanceMetricPayload { subType: 'web-vital'; metric: 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB'; value: number; rating: 'good' | 'needs-improvement' | 'poor' }
interface NavigationTimingPayload { subType: 'navigation-timing'; dns: number; tcp: number; ssl: number; ttfb: number; download: number; domInteractive: number; domComplete: number; loadTime: number }

// 行为（第 09 章）
interface PVPayload { subType: 'pv'; page: string; referrer: string }
interface ClickPayload { subType: 'click'; elementPath: string; elementText: string; page: string }
interface RouteChangePayload { subType: 'route-change'; from: string; to: string }
interface CustomPayload { subType: 'custom'; name: string; extra?: Record<string, unknown> }

// API（第 10 章）
interface ApiPayload { subType: 'xhr' | 'fetch'; method: string; url: string; status: number; duration: number; success: boolean }
```

---

## 五、Transport 实现要点（`packages/core/src/transport.ts`）

### 三种触发上报时机

| 时机 | 条件 | 方法 |
|---|---|---|
| 定时刷新 | 每 `flushInterval` ms | `_sendFetch()` |
| 满批立发 | `queue.length >= maxBatchSize` | `_sendFetch()` |
| 页面卸载 | `visibilitychange(hidden)` / `beforeunload` | `_sendBeacon()` |

### sendBeacon 的关键实现

```typescript
// 用 Blob 包裹 JSON，强制指定 Content-Type: application/json
const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' })
const queued = navigator.sendBeacon(this.config.dsn, blob)
// queued=false → body 超 64KB → 降级到 fetch + keepalive
```

### 故障降级策略

```
sendBeacon 可用？
  → 是 → queued=true → 成功
  → 是 → queued=false（body 过大）→ _fallbackFetch(batch)
  → 否（老浏览器）→ _fallbackFetch(batch)

fetch 失败？
  → 丢弃（简单策略）
  → 生产级预留：写入 IndexedDB，下次重试
```

---

## 六、demos 更新（第 11 章变更）

### vue3-demo / react-demo `main.ts/tsx`

```typescript
init({
  dsn: 'http://localhost:3001/collect',
  flushInterval: 5000,   // 第 11 章新增
  maxBatchSize: 10,      // 第 11 章新增
  // ... 其他配置不变
})
```

### vue3-demo `App.vue` / react-demo `App.tsx`

新增"🔵 第 11 章——上报策略演示"区块，包含三个按钮：
- **立即上报（手动 flush）**：调用 `flush()`，把队列立刻发出去
- **填满批次（连发 10 条）**：触发 10 次 `capture()`，达到 maxBatchSize 立即上报
- **检查 collect-server 健康状态**：调用 `GET /health` 验证服务可达

---

## 七、根目录 package.json 脚本

```json
{
  "scripts": {
    "mock-server": "node --experimental-strip-types demos/mock-server/server.ts",
    "collect-server": "node --experimental-strip-types demos/collect-server/server.ts"
  }
}
```

---

## 八、端到端验证命令

```bash
cd '11.SDK 上报——数据结构设计与上报策略/代码/monitor'

# 构建
pnpm build

# 端到端验证（三个终端并行）
pnpm collect-server                         # 终端 1：启动接收服务器
pnpm --filter @monitor/vue3-demo dev        # 终端 2：启动 Vue3 demo
pnpm --filter @monitor/react-demo dev       # 终端 3：启动 React demo
```

---

## 九、数据流完整闭环（第 11 章完成后）

```
用户操作
  → 插件采集（第 06-10 章）
  → monitor.capture(type, payload)
    ↓
  [采样过滤] sampleRate
    ↓
  [规范化] → MonitorEvent（traceId + appId + userId + type + payload + timestamp + page + ua）
    ↓
  transport.enqueue(event)
    ↓
  内部队列 queue[]
    ↓
  三种触发上报时机：
    A. setInterval(5000ms)     → fetch POST   → http://localhost:3001/collect
    B. queue.length >= 10      → fetch POST   → http://localhost:3001/collect
    C. visibilitychange/unload → sendBeacon   → http://localhost:3001/collect
    ↓
  collect-server（本地验证，第 11 章）
    ↓
  dsn-server NestJS（第 14 章实现）→ Kafka → Doris
```

---

## 十、下一章（第 12 章）需要的前置知识

第 12 章将用 Docker 在本地启动 Kafka + Apache Doris + PostgreSQL 基础设施。

**不需要修改本章代码**，只需要了解：
- demos 中 `dsn: 'http://localhost:3001/collect'` 当前指向 `collect-server`
- 第 14 章实现 `dsn-server`（NestJS）后，dsn 将指向真实后端服务
- demos 届时只需改 `dsn` 配置，其他代码**无需修改**（这正是 DSN 设计的价值）
