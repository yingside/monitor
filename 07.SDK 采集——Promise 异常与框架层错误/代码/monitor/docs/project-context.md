# 项目上下文文档

> 本文档描述**第 07 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `07.SDK 采集——Promise 异常与框架层错误/代码/monitor/` |
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
  PromiseErrorPayload, FrameworkErrorPayload,  // 第 07 章新增
  ErrorPayload
}
export const MONITOR_VERSION = '0.1.0'
```

---

### @monitor/browser（`packages/browser/`）

**已实现**：`src/index.ts` + `src/plugins/error.ts`

**对外暴露**：
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
  ErrorPayload
}
export { MONITOR_VERSION }
export { createErrorPlugin }
export type { ErrorPluginOptions }
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

**vue3-demo** `demos/vue3-demo/`：
- `main.ts`：`const monitor = init({...}); createApp(App).use(createMonitorVue(monitor)).mount('#app')`
- `App.vue`：四区块（JS错误 / Promise异常 / Vue框架错误 / 手动埋点）

**react-demo** `demos/react-demo/`：
- `main.tsx`：`<MonitorErrorBoundary monitor={monitor}><StrictMode><App /></StrictMode></MonitorErrorBoundary>`
- `App.tsx`：四区块（JS错误 / Promise异常 / React框架错误 / 手动埋点）

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

```typescript
createErrorPlugin(options?: ErrorPluginOptions): Plugin

interface ErrorPluginOptions {
  js?: boolean         // 默认 true
  resource?: boolean   // 默认 true
  promise?: boolean    // 默认 true（第 07 章新增）
  dedupWindow?: number // 默认 1000ms（第 07 章新增，0=关闭去重）
}
```

**第 07 章变更**：
- 新增 `computeFingerprint(message, filename, lineno)` → `"msg|file|lineno"` 格式
- 新增 `dedupMap: Map<string, number>`（key=指纹，value=上次上报时间戳）
- `shouldDeduplicate(fingerprint)` 检查是否在窗口期内
- 新增 `rejectionHandler` 监听 `unhandledrejection`，`teardown` 时精确移除
- `teardown()` 新增 `dedupMap.clear()` 释放内存

---

## 七、数据管道验证

```bash
pnpm --filter @monitor/vue3-demo dev

# 点击"Promise.reject（无 catch）" → 控制台：
[Monitor] capture | type=error { payload: { subType: 'promise', ... } }

# 点击"去重测试" → 控制台只输出 1 次 capture：
[Demo] 触发了 5 次相同 Promise 错误，SDK 去重后预期只上报 1 次
[Monitor] capture | type=error { payload: { subType: 'promise', message: '去重测试：相同错误' } }

# 点击"Vue setup() 中抛出错误" → 控制台：
[Monitor][Vue] Component error captured: Error: ...
[Monitor] capture | type=error { payload: { subType: 'vue', componentInfo: 'App' } }
```

---

## 八、构建验证

```bash
cd '07.SDK 采集——Promise 异常与框架层错误/代码/monitor'
pnpm build
# 期望：Tasks: 10 successful, 10 total（已验证通过）
```

---

## 九、代码规范约束

- 注释禁止出现"第 X 章"字样，用"待实现"、"后续接入"等中性表述
- `@monitor/core` 禁止调用浏览器 API
- `@monitor/vue` 只依赖 `@monitor/core`，不依赖 `@monitor/browser`
- demos 所有类型通过 `@monitor/browser` 重导出获取，不直接依赖 `@monitor/core`

---

## 十、下一章待实现（第 08 章：SDK 采集——页面性能指标）

### 需要新增的类型

```typescript
interface PerformanceMetricPayload {
  metric: 'FCP' | 'LCP' | 'CLS' | 'FID' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string
}
```

### 需要新建的文件

- `packages/browser/src/plugins/performance.ts`：`createPerformancePlugin()`
- 使用 `PerformanceObserver` 监听 Web Vitals 指标
- 按 Web Vitals 官方阈值判断 `rating`

### demo 更新

两个 demo 新增"性能指标采集"区域，自动上报当前页面 Web Vitals，支持手动触发 Long Task 观察 INP。
