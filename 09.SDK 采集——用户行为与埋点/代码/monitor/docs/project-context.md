# 项目上下文文档

> 本文档描述**第 09 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `09.SDK 采集——用户行为与埋点/代码/monitor/` |
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
  // 性能类型（第 08 章）
  PerformanceMetricPayload, NavigationTimingPayload, PerformancePayload,
  // 行为类型（第 09 章新增）
  PVPayload, ClickPayload, RouteChangePayload, CustomPayload, BehaviorPayload,
}
export const MONITOR_VERSION = '0.1.0'
```

---

### @monitor/browser（`packages/browser/`）

**已实现**：`src/index.ts` + `src/plugins/error.ts` + `src/plugins/performance.ts` + `src/plugins/performance-web-vitals.ts` + `src/plugins/behavior.ts`（第 09 章新增）

**对外暴露**：
```typescript
export function init(options: MonitorOptions): Monitor
export function getMonitor(): Monitor | null
export function capture(type: EventType, payload: unknown): void
export function use(plugin: Plugin): void
export function destroy(): void

// 第 09 章新增
export function trackBehavior(name: string, extra?: Record<string, unknown>): void
export function getBreadcrumbs(): readonly BehaviorPayload[]

export type { MonitorOptions, Plugin, EventType }
export type {
  JsErrorPayload, ResourceErrorPayload,
  PromiseErrorPayload, FrameworkErrorPayload, ErrorPayload,
  PerformanceMetricPayload, NavigationTimingPayload, PerformancePayload,
  // 第 09 章新增
  PVPayload, ClickPayload, RouteChangePayload, CustomPayload, BehaviorPayload,
}
export { MONITOR_VERSION }
export { createErrorPlugin }; export type { ErrorPluginOptions }
export { createPerformancePlugin }; export type { PerformancePluginOptions }
export { createWebVitalsPlugin }; export type { WebVitalsPluginOptions }
// 第 09 章新增
export { createBehaviorPlugin }; export type { BehaviorPluginOptions }
```

---

### @monitor/browser-utils（`packages/browser-utils/`）

**已实现**：`generateUUID()` / `getDeviceInfo()`（无改动）

---

### @monitor/vue（`packages/vue/`）

**状态**：第 07 章已完整实现，本章无改动。

**对外暴露**：`createMonitorVue(monitor: MonitorInstance): VuePlugin`

---

### @monitor/react（`packages/react/`）

**状态**：第 07 章已完整实现，本章无改动。

**对外暴露**：`MonitorErrorBoundary` Class 组件

---

### demos

**vue3-demo** `demos/vue3-demo/`（第 09 章变更）：
- `main.ts`：新增 `createBehaviorPlugin()` 插件注册（pv/click/routeChange 均为 true，maxBreadcrumbs: 20）
- `App.vue`：新增"🔵 自动采集——用户行为与埋点"区域；import 新增 `trackBehavior` / `getBreadcrumbs`；新增 `simulatePushState` / `simulatePopState` / `trackCustomEvent` / `showBreadcrumbs` 函数；新增 `.btn-blue` 样式

**react-demo** `demos/react-demo/`（第 09 章变更）：
- `main.tsx`：新增 `createBehaviorPlugin()` 插件注册
- `App.tsx`：同上变更；新增 `blueBtn` 样式常量；import 新增 `trackBehavior` / `getBreadcrumbs`

---

## 四、核心类型定义（`packages/core/src/types.ts`）

```typescript
type EventType = 'error' | 'performance' | 'behavior' | 'api'

// ── 错误类型（第 06-07 章）
interface JsErrorPayload { subType: 'js'; message: string; filename: string; lineno: number; colno: number; stack: string; errorType: string }
interface ResourceErrorPayload { subType: 'resource'; tagName: string; src: string }
interface PromiseErrorPayload { subType: 'promise'; message: string; stack: string; reason: unknown }
interface FrameworkErrorPayload { subType: 'vue' | 'react'; message: string; stack: string; componentInfo?: string }
type ErrorPayload = JsErrorPayload | ResourceErrorPayload | PromiseErrorPayload | FrameworkErrorPayload

// ── 性能类型（第 08 章）
interface PerformanceMetricPayload {
  subType: 'web-vital'; metric: 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB'
  value: number; rating: 'good' | 'needs-improvement' | 'poor'; navigationType: string
}
interface NavigationTimingPayload {
  subType: 'navigation-timing'
  dns: number; tcp: number; ssl: number; ttfb: number; download: number
  domInteractive: number; domComplete: number; loadTime: number
}
type PerformancePayload = PerformanceMetricPayload | NavigationTimingPayload

// ── 行为类型（第 09 章新增）
interface PVPayload { subType: 'pv'; page: string; referrer: string }
interface ClickPayload { subType: 'click'; elementPath: string; elementText: string; page: string }
interface RouteChangePayload { subType: 'route-change'; from: string; to: string }
interface CustomPayload { subType: 'custom'; name: string; extra?: Record<string, unknown> }
type BehaviorPayload = PVPayload | ClickPayload | RouteChangePayload | CustomPayload
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
interface ErrorPluginOptions { js?: boolean; resource?: boolean; promise?: boolean; dedupWindow?: number }
```

---

## 七、性能采集插件

同第 08 章，本章无改动。

```typescript
createPerformancePlugin(options?: PerformancePluginOptions): Plugin
createWebVitalsPlugin(options?: WebVitalsPluginOptions): Plugin
```

---

## 八、行为采集插件（`packages/browser/src/plugins/behavior.ts`）（第 09 章新增）

```typescript
createBehaviorPlugin(options?: BehaviorPluginOptions): Plugin

interface BehaviorPluginOptions {
  pv?: boolean           // 自动上报 PV，默认 true
  click?: boolean        // 事件委托采集点击，默认 true
  routeChange?: boolean  // 监听 SPA 路由跳转，默认 true
  maxBreadcrumbs?: number // 行为栈容量，默认 20
}
```

**实现要点**：
- **PV**：`setup()` 同步阶段立即上报，读取 `location.href` + `document.referrer`
- **点击**：`document.addEventListener('click', handler)` 事件委托；`Element.closest('button, a, input, select, textarea, [data-track]')` 过滤；`getElementPath()` 向上最多 5 层，遇 id 停止；`getElementText()` 优先 aria-label > data-track-text > innerText 前 50 字符
- **路由跳转**：Monkey Patch `history.pushState` + `history.replaceState`（先保存 `.bind(history)` 原始引用）；监听 `popstate` + `hashchange`；URL 防重检测（`from === to` 跳过）
- **行为栈**：模块级 `_breadcrumbs: BehaviorPayload[]` 数组；`addBreadcrumb()` 追加 + 超出时 `shift()`；`getBreadcrumbs()` 返回副本 `[..._breadcrumbs]`（不可变性）
- **teardown**：清理 click 监听；移除 popstate/hashchange；**还原 history.pushState/replaceState 为原始方法**；清空行为栈

**模块导出**（内部 + 外部）：
```typescript
export function createBehaviorPlugin(options?: BehaviorPluginOptions): Plugin
export function getBreadcrumbs(): readonly BehaviorPayload[]
export function addBreadcrumb(payload: BehaviorPayload): void  // 供 index.ts trackBehavior() 调用
```

---

## 九、trackBehavior() 与 getBreadcrumbs()（`packages/browser/src/index.ts`）（第 09 章新增）

```typescript
import { addBreadcrumb } from './plugins/behavior'
import type { CustomPayload } from '@monitor/core'

export function trackBehavior(name: string, extra?: Record<string, unknown>): void {
  if (!_monitor) return
  const payload: CustomPayload = { subType: 'custom', name, extra }
  _monitor.capture('behavior', payload)
  addBreadcrumb(payload)  // 同步写入行为栈
}

export { getBreadcrumbs } from './plugins/behavior'
```

---

## 十、数据管道验证

```bash
pnpm --filter @monitor/vue3-demo dev
# 页面加载后：subType: 'pv'
# 点击按钮后：subType: 'click'
# 点击路由按钮后：subType: 'route-change'
# 调用 trackBehavior() 后：subType: 'custom'
```

---

## 十一、构建验证

```bash
cd '09.SDK 采集——用户行为与埋点/代码/monitor'
pnpm build
# 期望：Tasks: 10 successful, 10 total（已验证通过）
```

---

## 十二、代码规范约束

- 注释禁止出现"第 X 章"字样
- `@monitor/core` 禁止调用浏览器 API
- `@monitor/vue` 只依赖 `@monitor/core`，不依赖 `@monitor/browser`
- demos 所有类型通过 `@monitor/browser` 重导出获取
- `getBreadcrumbs()` 必须返回副本，不能暴露原始数组引用
- history 方法劫持前必须用 `.bind(history)` 保存原始函数，teardown 时必须还原

---

## 十三、下一章待实现（第 10 章：SDK 采集——API 请求监控）

### 需要新增的类型

```typescript
interface ApiPayload {
  subType: 'xhr' | 'fetch'
  method: string     // GET / POST / PUT / DELETE ...
  url: string        // 请求 URL
  status: number     // HTTP 状态码（0 表示网络错误/超时）
  duration: number   // 请求耗时（ms）
  success: boolean   // status >= 200 && status < 300
}
```

### 需要新建的文件

- `packages/browser/src/plugins/api.ts`：`createApiPlugin()`
  - 劫持 `XMLHttpRequest`（覆盖 open/send，监听 loadend）
  - 劫持 `window.fetch`（包装 Promise，记录开始时间）
  - URL 过滤：排除 DSN 地址（防止上报自身引发无限循环）
  - teardown 还原 XMLHttpRequest.prototype 和 window.fetch

### demo 更新

两个 demo 新增"API 请求监控"区域，演示 fetch/XHR 请求被自动采集。
