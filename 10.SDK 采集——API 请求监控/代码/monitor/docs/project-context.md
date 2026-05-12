# 项目上下文文档

> 本文档描述**第 10 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `10.SDK 采集——API 请求监控/代码/monitor/` |
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
│   └── mock-server/     本地 Mock API 服务器（第 10 章新增）
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
  // 行为类型（第 09 章）
  PVPayload, ClickPayload, RouteChangePayload, CustomPayload, BehaviorPayload,
  // API 请求类型（第 10 章新增）
  ApiPayload,
}
export const MONITOR_VERSION = '0.1.0'
```

---

### @monitor/browser（`packages/browser/`）

**已实现**：`src/index.ts` + 5 个采集插件

```typescript
// 对外暴露（第 10 章新增 createApiPlugin）
export function init(options: MonitorOptions): Monitor
export function getMonitor(): Monitor | null
export function capture(type: EventType, payload: unknown): void
export function use(plugin: Plugin): void
export function destroy(): void
export function trackBehavior(name: string, extra?: Record<string, unknown>): void
export function getBreadcrumbs(): readonly BehaviorPayload[]

export type { MonitorOptions, Plugin, EventType }
export type { JsErrorPayload, ResourceErrorPayload, PromiseErrorPayload, FrameworkErrorPayload, ErrorPayload }
export type { PerformanceMetricPayload, NavigationTimingPayload, PerformancePayload }
export type { PVPayload, ClickPayload, RouteChangePayload, CustomPayload, BehaviorPayload }
export type { ApiPayload }  // 第 10 章新增
export { MONITOR_VERSION }

export { createErrorPlugin }; export type { ErrorPluginOptions }
export { createPerformancePlugin }; export type { PerformancePluginOptions }
export { createWebVitalsPlugin }; export type { WebVitalsPluginOptions }
export { createBehaviorPlugin, getBreadcrumbs }; export type { BehaviorPluginOptions }
export { createApiPlugin }; export type { ApiPluginOptions }  // 第 10 章新增
```

---

### @monitor/browser-utils（`packages/browser-utils/`）

**状态**：同第 09 章，本章无改动。

---

### @monitor/vue / @monitor/react

**状态**：同第 07 章，本章无改动。

---

### demos/mock-server（第 10 章新增）

**位置**：`demos/mock-server/`

**职责**：提供本地 HTTP Mock 服务，供 demos 测试 API 请求监控功能。

**运行**：
```bash
# 从根目录
pnpm mock-server
# 或
pnpm --filter @monitor/mock-server dev
```

**端口**：3002

**接口列表**：
| 方法 | 路径 | 状态码 | 说明 |
|------|------|--------|------|
| GET | `/api/users` | 200 | 用户列表 |
| POST | `/api/login` | 200 | 模拟登录 |
| GET | `/api/slow` | 200 | 1500ms 延迟（慢请求演示） |
| GET | `/api/error` | 500 | 服务端错误演示 |
| 其他 | 任意 | 404 | 兜底 |

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
interface PerformanceMetricPayload { subType: 'web-vital'; metric: 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB'; value: number; rating: 'good' | 'needs-improvement' | 'poor'; navigationType: string }
interface NavigationTimingPayload { subType: 'navigation-timing'; dns: number; tcp: number; ssl: number; ttfb: number; download: number; domInteractive: number; domComplete: number; loadTime: number }
type PerformancePayload = PerformanceMetricPayload | NavigationTimingPayload

// ── 行为类型（第 09 章）
interface PVPayload { subType: 'pv'; page: string; referrer: string }
interface ClickPayload { subType: 'click'; elementPath: string; elementText: string; page: string }
interface RouteChangePayload { subType: 'route-change'; from: string; to: string }
interface CustomPayload { subType: 'custom'; name: string; extra?: Record<string, unknown> }
type BehaviorPayload = PVPayload | ClickPayload | RouteChangePayload | CustomPayload

// ── API 请求类型（第 10 章新增）
interface ApiPayload {
  subType: 'xhr' | 'fetch'   // 请求发起方式
  method: string              // HTTP 方法（统一大写）
  url: string                 // 请求 URL（绝对路径）
  status: number              // HTTP 状态码；0 = 网络错误
  duration: number            // 耗时（ms，向下取整）
  success: boolean            // status >= 200 && status < 300
}
```

---

## 五、API 监控插件（`packages/browser/src/plugins/api.ts`）（第 10 章新增）

```typescript
createApiPlugin(options?: ApiPluginOptions): Plugin

interface ApiPluginOptions {
  filterUrls?: (string | RegExp)[]  // 需要跳过的 URL（字符串=前缀匹配，RegExp=正则匹配）
}
```

**实现要点**：

- **原始方法保存时机**：模块加载时（文件 import 时）立即保存，保证保存的是原生方法，不受后续劫持影响
- **XHR 劫持流程**：
  - `open(method, url, ...)` → 解析 URL（resolveUrl 转绝对路径）→ 存入 WeakMap（method / url / startTime=0）→ 透传原始 open
  - `send(body?)` → 从 WeakMap 取状态 → 过滤检查 → 记录 startTime → 注册 `loadend` 回调 → 透传原始 send
  - `loadend` 回调：计算 duration = `Date.now() - startTime` → `monitor.capture('api', payload)`
- **Fetch 劫持流程**：替换 `window.fetch` → 从 input 提取 url + method → 过滤检查 → 记录 startTime → 调用原始 fetch → `.then(成功回调, 失败回调)` → 成功回调记录 `response.status` 并**原样 return response** → 失败回调记录 `status: 0` 并**重新 throw error**
- **WeakMap**：`WeakMap<XMLHttpRequest, { method, url, startTime }>` 存储每个 XHR 实例的状态，类型安全且无内存泄漏
- **URL 过滤**：`filterList = [monitor.options.dsn, ...options?.filterUrls ?? []]`，DSN 自动过滤防无限循环
- **teardown**：`XMLHttpRequest.prototype.open = _originalXhrOpenRef`，`XMLHttpRequest.prototype.send = _originalXhrSendRef`，`window.fetch = _originalFetch`

**关键设计决策**：
- `_originalXhrOpen` 保存为 `unknown[]` 参数类型，绕过 TypeScript 对重载函数 `.call()` 的严格检查；同时保留 `_originalXhrOpenRef`（原始类型）用于 teardown 时类型安全地赋值回 prototype
- Fetch 成功路径（`.then` 第一参数）处理 2xx/4xx/5xx（全部是 resolved 状态），用 `response.ok` 判断 success；失败路径（第二参数）处理网络错误（rejected 状态），status 固定为 0
- `resolveUrl()` 使用 `new URL(input, location.href)` 将相对路径转成绝对路径，确保过滤规则能正确匹配

---

## 六、demos 更新（第 10 章变更）

### vue3-demo

**`src/main.ts`**：
- 新增 `createApiPlugin` import
- 新增 `createApiPlugin({ filterUrls: [] })` 插件注册

**`src/App.vue`**：
- 模板新增"🟤 自动采集——API 请求监控"区域（7 个演示按钮）
- script 新增：`MOCK_BASE = 'http://localhost:3002'`
- 新增函数：`fetchUsers()` / `fetchLogin()` / `fetchSlow()` / `fetchError()` / `xhrUsers()` / `xhrError()` / `fetchNetworkError()`
- 更新 tip 区域，新增 `subType: 'xhr'` 和 `subType: 'fetch'` 说明
- 样式新增 `.btn-brown`（紫罗兰色 `#8B5CF6`）

### react-demo

**`src/main.tsx`**：
- 新增 `createApiPlugin` import 和注册（同上）

**`src/App.tsx`**：
- 新增 `violetBtn` 样式常量（`#8B5CF6`）
- 新增 API 演示函数（同 vue3-demo）
- 新增"🟤 自动采集——API 请求监控"区域 JSX
- 更新底部 tip，新增 `subType: 'xhr'` / `subType: 'fetch'`

---

## 七、根目录 package.json 新增脚本

```json
{
  "scripts": {
    "mock-server": "node --experimental-strip-types demos/mock-server/server.ts"
  }
}
```

---

## 八、构建验证

```bash
cd '10.SDK 采集——API 请求监控/代码/monitor'
pnpm build
# 期望：Tasks: 10 successful, 10 total（已验证通过）
```

---

## 九、代码规范约束

- 注释禁止出现"第 X 章"字样
- `@monitor/core` 禁止调用浏览器 API
- `@monitor/vue` 只依赖 `@monitor/core`，不依赖 `@monitor/browser`
- demos 所有类型通过 `@monitor/browser` 重导出获取
- `_originalXhrOpen/Send` 在**模块顶层**（import 时）保存，不在 setup() 内保存
- Fetch 劫持的 `.then` 成功回调**必须 return response**，失败回调**必须 throw error**
- `ApiPayload` 不包含 requestBody / responseBody（最小数据原则 / 隐私保护）

---

## 十、下一章待实现（第 11 章：SDK 上报——数据结构设计与上报策略）

### 当前 _flush 的状态

`packages/core/src/monitor.ts` 中的 `_flush()` 方法目前只打印日志：

```typescript
private _flush(): void {
  console.log('[Monitor] capture', this.queue[this.queue.length - 1])
  // TODO: 第 11 章实现真正的上报逻辑
}
```

### 第 11 章需要实现

1. **最终的 MonitorEvent 结构**（traceId / appId / userId / type / payload / timestamp / page / ua）
2. **上报方式对比与选择**：
   - `navigator.sendBeacon()`：页面关闭时可靠上报，但不能设置请求头、不能得到响应
   - `fetch()`：灵活，但页面关闭时可能被 abort
   - `XMLHttpRequest`：老派，同步 XHR 已被 sendBeacon 替代
3. **批量上报策略**：
   - 即时上报：每条事件立即发送，实时性好但请求多
   - 批量上报：积攒 N 条或等待 X 秒后一次性发送，减少请求数
   - 混合策略（推荐）：平时批量，页面关闭时用 sendBeacon 把剩余数据发完
4. **队列管理**：maxQueueSize 防内存溢出，已在 core 中预留
5. **采样率**：sampleRate 字段已在 MonitorOptions 中定义，需要在上报阶段落地


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
