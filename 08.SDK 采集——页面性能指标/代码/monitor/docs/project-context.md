# 项目上下文文档

> 本文档描述**第 08 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `08.SDK 采集——页面性能指标/代码/monitor/` |
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
│   └── react-demo/      React 接入演示
├── docker/
├── docs/project-context.md
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 三、各包职责与状态

### @monitor/core（`packages/core/`）

**已实现**：`types.ts` / `monitor.ts` / `index.ts`

**对外暴露**：
```typescript
export { Monitor }
export type {
  EventType, MonitorOptions, ResolvedOptions, MonitorEvent, MonitorInstance, Plugin,
  JsErrorPayload, ResourceErrorPayload,
  PromiseErrorPayload, FrameworkErrorPayload,
  ErrorPayload,
  // 性能类型（第 08 章新增）
  PerformanceMetricPayload, NavigationTimingPayload, PerformancePayload,
}
export const MONITOR_VERSION = '0.1.0'
```

---

### @monitor/browser（`packages/browser/`）

**已实现**：`src/index.ts` + `src/plugins/error.ts` + `src/plugins/performance.ts`（第 08 章新增）

**对外暑露**：
```typescript
export function init(options: MonitorOptions): Monitor
export function getMonitor(): Monitor | null
export function capture(type: EventType, payload: unknown): void
export function use(plugin: Plugin): void
export function destroy(): void

export type { MonitorOptions, Plugin, EventType }
export type {
  JsErrorPayload, ResourceErrorPayload,
  PromiseErrorPayload, FrameworkErrorPayload,
  ErrorPayload,
  // 第 08 章新增
  PerformanceMetricPayload, NavigationTimingPayload, PerformancePayload,
}
export { MONITOR_VERSION }
export { createErrorPlugin }
export type { ErrorPluginOptions }
// 第 08 章新增
export { createPerformancePlugin }
export type { PerformancePluginOptions }
```

---

### @monitor/browser-utils（`packages/browser-utils/`）

**已实现**：`generateUUID()` / `getDeviceInfo()`（无改动）

---

### @monitor/vue（`packages/vue/`）

**状态**：第 07 章已完整实现。

**对外暴露**：
```typescript
export function createMonitorVue(monitor: MonitorInstance): VuePlugin
// VuePlugin = { install(app: App): void }
```

**实现要点**：
- 接受 `MonitorInstance` 参数（依赖注入）
- `install(app)` 中设置 `app.config.errorHandler`
- 组件名获取：`$options.name` → `$.type.__name` → Vue 的 `info` 字符串
- 只依赖 `@monitor/core`（不依赖 `@monitor/browser`，保留 SSR 兼容性）

---

### @monitor/react（`packages/react/`）

**状态**：第 07 章已完整实现。

**对外暴露**：
```typescript
export class MonitorErrorBoundary extends React.Component<
  MonitorErrorBoundaryProps,
  MonitorErrorBoundaryState
>

export interface MonitorErrorBoundaryProps {
  monitor: MonitorInstance
  fallback?: React.ReactNode
  children: React.ReactNode
}
```

**实现要点**：
- Class 组件（React ErrorBoundary 只能用 Class 实现）
- `getDerivedStateFromError`：更新 state，触发降级渲染（纯函数）
- `componentDidCatch`：构造 `FrameworkErrorPayload` 上报（副作用）
- 内置降级 UI（无外部 CSS 依赖，使用 `React.createElement`）

---

### demos

**vue3-demo** `demos/vue3-demo/`（第 08 章变更）：
- `main.ts`：新增 `createPerformancePlugin()` 插件
- `App.vue`：新增"🟢 自动采集——Core Web Vitals & 导航时序"区域；新增 `triggerLayoutShift()` / `triggerLongTask()`；移除旧的 `sendPerf()` 手动按鈕

**react-demo** `demos/react-demo/`（第 08 章变更）：
- `main.tsx`：新增 `createPerformancePlugin()` 插件
- `App.tsx`：同上变更，新增绿色按鈕样式 `greenBtn`

---

## 四、核心类型定义（`packages/core/src/types.ts`）

```typescript
type EventType = 'error' | 'performance' | 'behavior' | 'api'

interface MonitorOptions {
  dsn: string; appId: string; userId?: string
  sampleRate?: number; plugins?: Plugin[]
  debug?: boolean; maxQueueSize?: number
}

interface ResolvedOptions {
  dsn: string; appId: string; userId: string | undefined
  sampleRate: number; plugins: Plugin[]
  debug: boolean; maxQueueSize: number
}

interface MonitorEvent {
  traceId: string; appId: string; userId?: string
  type: EventType; payload: unknown
  timestamp: number; page: string; ua: string
}

interface Plugin {
  name: string
  setup(monitor: MonitorInstance): void
  teardown?(): void
}

interface MonitorInstance {
  readonly options: Readonly<ResolvedOptions>
  capture(type: EventType, payload: unknown): void
}

// 错误载荷类型（判别联合，通过 subType 区分）
interface JsErrorPayload {
  subType: 'js'
  message: string; filename: string
  lineno: number; colno: number
  stack: string; errorType: string
}

interface ResourceErrorPayload {
  subType: 'resource'
  tagName: string; src: string
}

interface PromiseErrorPayload {      // 第 07 章新增
  subType: 'promise'
  message: string; stack: string
  reason: unknown
}

interface FrameworkErrorPayload {    // 第 07 章新增
  subType: 'vue' | 'react'
  message: string; stack: string
  componentInfo?: string
}

type ErrorPayload =
  | JsErrorPayload
  | ResourceErrorPayload
  | PromiseErrorPayload
  | FrameworkErrorPayload

// 性能采集载荷类型（第 08 章新增）
interface PerformanceMetricPayload {
  subType: 'web-vital'
  metric: 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB'
  value: number                                       // CLS 保留 4 位小数，其余 ms 整数
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string                              // navigate / reload / back_forward / prerender
}

interface NavigationTimingPayload {
  subType: 'navigation-timing'
  dns: number; tcp: number; ssl: number
  ttfb: number; download: number
  domInteractive: number; domComplete: number; loadTime: number
}

type PerformancePayload = PerformanceMetricPayload | NavigationTimingPayload
```

---

## 五、Monitor 核心类（`packages/core/src/monitor.ts`）

与第 06 章相同，无改动。

```
Monitor implements MonitorInstance
  属性：options / traceId / plugins / queue / initialized
  方法：init() / use(plugin) / capture(type, payload) / destroy() / _flush()
  capture 数据管道：采样 → 规范化（封装 MonitorEvent）→ 入队 → _flush（打印日志）
```

---

## 六、错误采集插件（`packages/browser/src/plugins/error.ts`）

同第 07 章，本章无改动。

```typescript
createErrorPlugin(options?: ErrorPluginOptions): Plugin

interface ErrorPluginOptions {
  js?: boolean         // 默认 true
  resource?: boolean   // 默认 true
  promise?: boolean    // 默认 true
  dedupWindow?: number // 默认 1000ms
}
```

---

## 七、性能采集插件（`packages/browser/src/plugins/performance.ts`）（第 08 章新增）

```typescript
createPerformancePlugin(options?: PerformancePluginOptions): Plugin

interface PerformancePluginOptions {
  vitals?: boolean      // Core Web Vitals，默认 true
  navigation?: boolean  // 导航时序，默认 true
}
```

**实现要点**：
- FCP：监听 `paint` entry，`buffered: true`，上报后立即 disconnect
- LCP：持续更新 latestLCPValue，在 `click` / `keydown` / `visibilitychange(hidden)` 时锁定最终值
- CLS： Session Window 算法（间隔 <1000ms 且总时长 <5000ms 归一窗口），过滤 `hadRecentInput=true`
- INP：监听 `event` entry，`durationThreshold: 16`，只统计 `interactionId > 0` 的事件，取 `duration` 最大值
- TTFB：`responseStart - fetchStart`，`document.readyState === 'complete'` 时直接读取
- NavigationTiming：load 事件后一次性读取全部阶段耐时
- teardown：`observers` 数组统一持有全部 PerformanceObserver，遍历 disconnect
- 类型问题：`durationThreshold` 需要 `as PerformanceObserverInit` 断言（TypeScript 标准 lib 未收录此字段）
- 安全注册：每个 Observer 用 `_observeSafely()` 包裹，防止旧浏览器抛出 DOMException

---

## 八、数据管道验证

```bash
pnpm --filter @monitor/vue3-demo dev

# 页面加载后控制台自动输出（无需手动操作）：
[Monitor] capture | type=performance { payload: { subType: 'web-vital', metric: 'FCP', value: 312, rating: 'good', ... } }
[Monitor] capture | type=performance { payload: { subType: 'web-vital', metric: 'TTFB', value: 4, rating: 'good', ... } }
[Monitor] capture | type=performance { payload: { subType: 'navigation-timing', dns: 0, tcp: 0, ... loadTime: 311 } }

# 点击页面或切换标签页后：
[Monitor] capture | type=performance { payload: { subType: 'web-vital', metric: 'LCP', value: 318, rating: 'good', ... } }

# 切换标签页（触发 visibilitychange）后：
[Monitor] capture | type=performance { payload: { subType: 'web-vital', metric: 'CLS', value: 0, rating: 'good', ... } }
```

---

## 九、构建验证

```bash
cd '08.SDK 采集——页面性能指标/代码/monitor'
pnpm build
# 期望：Tasks: 10 successful, 10 total（已验证通过）
```

---

## 十、代码规范约束

- 注释禁止出现"第 X 章"字样，用"待实现"、"后续接入"等中性表述
- `@monitor/core` 禁止调用浏览器 API
- `@monitor/vue` 只依赖 `@monitor/core`，不依赖 `@monitor/browser`
- demos 所有类型通过 `@monitor/browser` 重导出获取，不直接依赖 `@monitor/core`
- `durationThreshold` 需要类型断言 `as PerformanceObserverInit`（TypeScript lib 不含此字段）

---

## 十一、下一章待实现（第 09 章：SDK 采集——用户行为与埋点）

### 需要新增的类型

```typescript
interface BehaviorPayload {
  subType: 'pv' | 'click' | 'route-change' | 'custom'
  page?: string
  referrer?: string
  elementPath?: string
  elementText?: string
  from?: string
  to?: string
  extra?: Record<string, unknown>
}
```

### 需要新建的文件

- `packages/browser/src/plugins/behavior.ts`：`createBehaviorPlugin()`
  - PV 采集（每次 `init()` 时上报一次 PV）
  - 点击行为采集（事件委托，`document.addEventListener('click')`）
  - SPA 路由变更监听（`history.pushState` / `popstate` / `hashchange` 劫持）
  - 行为栈（固定长度队列，存储最近 N 条行为，为错误报告提供上下文）

### demo 更新

两个 demo 新增"行为采集"区域，演示自动 PV 上报、路由跳转监听、点击埋点的路径提取。
