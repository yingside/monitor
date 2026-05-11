# 项目上下文文档

> 本文档描述**第 06 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `06.SDK 采集——JS 错误与资源加载错误/代码/monitor/` |
| **包管理器** | pnpm 10.33.0（`packageManager` 字段写在根 `package.json`） |
| **构建工具** | Turborepo v2（`turbo.json` 管理任务依赖）|
| **Node.js** | v25.x（使用 `crypto.randomUUID` 原生 API）|
| **语言** | 全量 TypeScript，禁用 `any`，SDK 边界处用 `unknown` |
| **模块规范** | 全量 ES Module（`import`/`export`），无 `require` |
| **代码风格** | 2 空格缩进 / 单引号 / 不加分号（Prettier 管理）|

---

## 二、Monorepo 目录结构

```
monitor/
├── packages/                    # SDK 包（对外发布）
│   ├── core/                    # @monitor/core — 框架无关核心逻辑
│   ├── browser/                 # @monitor/browser — 浏览器入口包 + 采集插件
│   ├── browser-utils/           # @monitor/browser-utils — 纯工具函数
│   ├── vue/                     # @monitor/vue — Vue3 适配层（骨架，待实现）
│   └── react/                   # @monitor/react — React 适配层（骨架，待实现）
├── apps/
│   └── backend/
│       ├── dsn-server/          # @monitor/dsn-server — 数据接收服务（骨架）
│       └── monitor-server/      # @monitor/monitor-server — 平台 API 服务（骨架）
├── demos/
│   ├── vue3-demo/               # @monitor/vue3-demo — Vue3 接入演示
│   └── react-demo/              # @monitor/react-demo — React 接入演示
├── docker/                      # docker-compose.yml（基础设施，后续章节使用）
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 三、各包职责与状态

### @monitor/core（`packages/core/`）

**职责**：框架无关的核心逻辑，不调用任何浏览器 API，保留跨环境（SSR/Node.js）能力。

**已实现**：
- `src/types.ts`：全部类型定义（见第四节）
- `src/monitor.ts`：`Monitor` 核心类（数据管道：采样→规范化→队列→flush）
- `src/index.ts`：统一导出

**对外暴露**：
```typescript
export { Monitor }
export type {
  EventType, MonitorOptions, ResolvedOptions,
  MonitorEvent, MonitorInstance, Plugin,
  JsErrorPayload, ResourceErrorPayload, ErrorPayload  // 第 06 章新增
}
export const MONITOR_VERSION = '0.1.0'
```

---

### @monitor/browser（`packages/browser/`）

**职责**：浏览器入口包。维护全局单例，暴露对外 API（init/capture/use/destroy/getMonitor），聚合采集插件导出。

**已实现**：
- `src/index.ts`：单例管理 + 全部对外函数 + 重导出 core 类型 + 重导出插件
- `src/plugins/error.ts`：`createErrorPlugin`（第 06 章新增，见第五节）

**对外暴露**：
```typescript
// 核心函数
export function init(options: MonitorOptions): Monitor
export function getMonitor(): Monitor | null
export function capture(type: EventType, payload: unknown): void
export function use(plugin: Plugin): void
export function destroy(): void

// 类型（从 @monitor/core 透传，用户无需直接依赖 core）
export type { MonitorOptions, Plugin, EventType }
export type { JsErrorPayload, ResourceErrorPayload, ErrorPayload }
export { MONITOR_VERSION }

// 插件（第 06 章起）
export { createErrorPlugin }
export type { ErrorPluginOptions }
```

**依赖**：`@monitor/core`、`@monitor/browser-utils`

---

### @monitor/browser-utils（`packages/browser-utils/`）

**职责**：无副作用的纯工具函数，不依赖任何内部包。

**已实现**：
- `src/uuid.ts`：`generateUUID()`（优先 `crypto.randomUUID`，降级 Math.random）
- `src/device.ts`：`getDeviceInfo()`（返回 `DeviceInfo`：ua/screen/language/online）
- `src/index.ts`：统一导出

---

### @monitor/vue（`packages/vue/`）

**状态**：骨架，仅有注释说明职责，`export {}`。  
**待实现**（第 07 章）：Vue3 `app.config.errorHandler` 接入，捕获框架层错误。

---

### @monitor/react（`packages/react/`）

**状态**：骨架，仅有注释说明职责，`export {}`。  
**待实现**（第 07 章）：React `ErrorBoundary` 封装，捕获渲染错误。

---

### demos

**vue3-demo**（`demos/vue3-demo/`）：
- `main.ts`：调用 `init({ dsn, appId: 'vue3-demo', debug: true, sampleRate: 1, plugins: [createErrorPlugin()] })`
- `App.vue`：分为"无痕采集"区域（触发真实 JS 错误/资源错误）和"手动埋点"区域

**react-demo**（`demos/react-demo/`）：
- `main.tsx`：同 vue3-demo，appId 为 `'react-demo'`
- `App.tsx`：与 App.vue 功能对等，React 版本

---

## 四、核心类型定义（`packages/core/src/types.ts`）

```typescript
// 事件大类
type EventType = 'error' | 'performance' | 'behavior' | 'api'

// 用户传入的配置（可选项有默认值）
interface MonitorOptions {
  dsn: string           // 必填：数据上报地址
  appId: string         // 必填：项目标识
  userId?: string
  sampleRate?: number   // 默认 1（全量）
  plugins?: Plugin[]    // 默认 []
  debug?: boolean       // 默认 false
  maxQueueSize?: number // 默认 20
}

// Monitor 内部使用的配置（所有字段已填充默认值，无 undefined）
interface ResolvedOptions {
  dsn: string; appId: string; userId: string | undefined
  sampleRate: number; plugins: Plugin[]
  debug: boolean; maxQueueSize: number
}

// 数据管道中流转的基本单位（每次 capture 生成一条）
interface MonitorEvent {
  traceId: string   // 会话 ID（UUID v4，一次 init→destroy 共享）
  appId: string
  userId?: string
  type: EventType
  payload: unknown  // 具体内容由各插件定义
  timestamp: number // Date.now()
  page: string      // location.href
  ua: string        // navigator.userAgent
}

// 插件接口
interface Plugin {
  name: string                          // 唯一名称（防重复注册）
  setup(monitor: MonitorInstance): void  // 初始化：绑定监听
  teardown?(): void                      // 清理（可选）：移除监听，防止内存泄漏
}

// 插件只能看到的最小接口（不暴露 Monitor 私有状态）
interface MonitorInstance {
  readonly options: Readonly<ResolvedOptions>
  capture(type: EventType, payload: unknown): void
}

// ── 第 06 章新增：错误载荷类型 ──────────────────────────────────────────────

// JS 运行时错误（window.addEventListener('error', ..., true) 捕获）
interface JsErrorPayload {
  subType: 'js'
  message: string
  filename: string
  lineno: number
  colno: number
  stack: string       // 原始调用栈（服务端 SourceMap 还原）
  errorType: string   // 'TypeError' / 'ReferenceError' 等
}

// 静态资源加载失败（<img>/<script>/<link> 触发）
interface ResourceErrorPayload {
  subType: 'resource'
  tagName: string   // 'IMG' / 'SCRIPT' / 'LINK' / 'AUDIO' / 'VIDEO'
  src: string       // 加载失败的 URL
}

// 判别联合类型（第 07 章会继续追加 Promise/框架错误）
type ErrorPayload = JsErrorPayload | ResourceErrorPayload
// 待扩展：| PromiseErrorPayload | FrameworkErrorPayload
```

---

## 五、Monitor 核心类（`packages/core/src/monitor.ts`）

```
Monitor implements MonitorInstance

属性：
  readonly options: Readonly<ResolvedOptions>   // 配置（构造时冻结）
  private readonly traceId: string              // 会话 ID（构造时生成，不变）
  private readonly plugins: Plugin[]            // 已注册插件列表
  private queue: MonitorEvent[]                 // 内存事件队列
  private initialized: boolean                  // 防重复初始化标志

方法：
  init()          启动所有已配置插件（setup），打印初始化日志
  use(plugin)     动态注册插件（init 后也可调用，防重名跳过）
  capture(type, payload)
                  数据管道入口：
                    [1] 采样过滤（Math.random > sampleRate → 丢弃）
                    [2] 规范化（封装 MonitorEvent，自动填 traceId/appId/timestamp/page/ua）
                    [3] 写入队列（超 maxQueueSize 丢弃最旧）
                    [4] _flush()（当前：debug 打印；后续接入 HTTP 上报）
  destroy()       调用所有插件 teardown()，清空 plugins/queue，重置 initialized
  _flush()        [私有] 触发上报（TODO: 接入 Transport 层实现真正 HTTP 发送）
```

---

## 六、错误采集插件（`packages/browser/src/plugins/error.ts`）

```typescript
// 工厂函数，每次调用返回独立闭包（状态隔离）
createErrorPlugin(options?: ErrorPluginOptions): Plugin

interface ErrorPluginOptions {
  js?: boolean       // 是否采集 JS 运行时错误，默认 true
  resource?: boolean // 是否采集资源加载失败，默认 true
}
```

**实现要点**：
- 使用 `window.addEventListener('error', handler, true)` —— **捕获阶段**，能同时截获 JS 错误和不冒泡的资源错误
- 通过 `e.target instanceof HTMLElement` 区分两种错误：
  - `true` → 资源错误，检查 `tagName` 是否在白名单 `['IMG','SCRIPT','LINK','AUDIO','VIDEO']` 中
  - `false` → JS 运行时错误，读取 `e.message/filename/lineno/colno/error.stack`
- `errorHandler` 引用保存在闭包变量中，`teardown` 时精确 `removeEventListener`，防止内存泄漏
- 插件 `name = 'error'`（Monitor 防重名机制会阻止同名插件重复注册）

---

## 七、数据管道运转验证

启动任意 demo（`pnpm --filter @monitor/vue3-demo dev`），打开控制台，预期输出：

```
[Monitor] Plugin "error" registered.
[Monitor] initialized | appId=vue3-demo | traceId=<uuid> | plugins=error

# 点击"触发 JS 运行时错误"后：
[Monitor] capture | type=error { payload: { subType: 'js', errorType: 'TypeError', ... } }
[Monitor] flush | 1 event(s) pending upload to http://localhost:3001/collect [...]

# 点击"加载不存在的图片"后：
[Monitor] capture | type=error { payload: { subType: 'resource', tagName: 'IMG', src: '...' } }
[Monitor] flush | 1 event(s) pending upload to http://localhost:3001/collect [...]
```

> `flush` 目前只打印日志，HTTP 真实上报在第 11 章 Transport 层实现后完善。

---

## 八、构建验证

```bash
cd '06.SDK 采集——JS 错误与资源加载错误/代码/monitor'
pnpm build
# 期望输出：Tasks: 10 successful, 10 total
```

10 个包：`@monitor/core` / `browser` / `browser-utils` / `vue` / `react` / `vue3-demo` / `react-demo` / `dsn-server` / `monitor-server` / `frontend`

---

## 九、已知的 Warning（不影响功能）

构建时所有包的 `package.json` 都会出现：
```
▲ [WARNING] The condition "types" here will never be used as it comes after both "import" and "require"
```
这是 tsup 生成的 `exports` 字段中 `"types"` 的顺序问题（应放在 `"import"` 之前）。不影响运行时行为，后续章节可统一修复。

---

## 十、代码规范约束

- 注释中**禁止**出现 `"第 X 章"` 字样（会随课程进度失效），改用中性描述如"待实现"、"后续接入"
- 所有包的类型边界处用 `satisfies` 而非 `as`（强制类型检查，不绕过编译器）
- `@monitor/core` 禁止调用 `window`/`document`/`navigator` 等浏览器 API（用 `typeof xxx !== 'undefined'` 守卫）
- demos 不直接依赖 `@monitor/core`，所有类型通过 `@monitor/browser` 重导出获取

---

## 十一、下一章待实现内容（第 07 章）

**第 07 章：SDK 采集——Promise 异常与框架层错误**

### 需要新增的类型（在 `core/src/types.ts` 追加到 `ErrorPayload` 联合）

```typescript
// Promise 未捕获异常
interface PromiseErrorPayload {
  subType: 'promise'
  message: string
  stack: string
  reason: unknown   // Promise reject 的原始值
}

// 框架层错误（Vue errorHandler / React ErrorBoundary）
interface FrameworkErrorPayload {
  subType: 'vue' | 'react'
  message: string
  stack: string
  componentInfo?: string  // Vue: vm.$options.name; React: component stack
}

// 更新后的联合类型：
type ErrorPayload = JsErrorPayload | ResourceErrorPayload | PromiseErrorPayload | FrameworkErrorPayload
```

### 需要新增的插件

**方案 A（推荐）**：在 `createErrorPlugin` 的 `ErrorPluginOptions` 追加 `promise?: boolean` 选项，统一处理

**方案 B**：单独创建 `packages/browser/src/plugins/promise-error.ts`，暴露 `createPromiseErrorPlugin()`

两种方案课件里都要对比分析，让学生理解权衡。

### 需要实现的框架适配包

- `packages/vue/src/index.ts`：实现 `MonitorVue` 插件（`install(app)` → 设置 `app.config.errorHandler`）
- `packages/react/src/index.ts`：实现 `MonitorErrorBoundary` 组件（`class ErrorBoundary extends React.Component`）

### 错误去重策略（第 07 章新增需求）

同一条错误在短时间内可能被多次触发（如无限循环里的错误）。需要在 `createErrorPlugin`（或 Monitor 层）加入去重逻辑：
- 按 `message + filename + lineno` 计算指纹
- 相同指纹在一定时间窗口内只上报一次（或计数合并）
- 去重状态存在插件内部的 `Map<string, number>`（key=指纹，value=lastReportTime）
