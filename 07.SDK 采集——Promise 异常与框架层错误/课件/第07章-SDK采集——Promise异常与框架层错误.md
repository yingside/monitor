# 第 07 章：SDK 采集——Promise 异常与框架层错误

## 开篇：还有哪些错误没被我们采集到？

上一章，我们用 `window.addEventListener('error', handler, true)` 拿到了两类错误：
- **同步 JS 运行时错误**（ReferenceError、TypeError 等）
- **静态资源加载失败**（img / script / link 404）

但真实项目里还有两大类错误悄悄溜走，完全不会触发 window error 事件：

**第一类：Promise 里的错误**

```js
// 这两种写法，window.addEventListener('error') 完全捕获不到
async function loadUserData() {
  const res = await fetch('/api/user')  // fetch 请求失败
  return res.json()
}
loadUserData()  // 忘记加 .catch() 或 try-catch → 静默失败
```

**第二类：Vue / React 组件内部的错误**

```js
// Vue 组件的 setup() 里抛错
setup() {
  const data = reactive(null)
  return data.items.map(...)  // TypeError: null 的属性不存在
}

// React render() 里抛错
function UserCard({ user }) {
  return <div>{user.name.toUpperCase()}</div>  // user 是 null → 崩溃
}
```

这些错误会被框架自己"吃掉"——Vue 把它们交给自己的错误处理机制，React 则会让整个组件树崩溃（如果没有 ErrorBoundary）。`window.onerror` 和 `window.addEventListener('error')` 都看不见它们。

**这一章就是要补全这两块盲区，同时引入错误去重机制，防止高频错误把上报队列打爆。**

---

## 本章目标

- 理解 `unhandledrejection` 事件的触发时机，和它与 `error` 事件的区别
- 理解 Vue 3 `app.config.errorHandler` 的设计哲学，和它能捕获哪些错误
- 理解 React ErrorBoundary 为什么必须是 Class 组件，以及它的局限性
- 实现 `PromiseErrorPayload` 和 `FrameworkErrorPayload` 类型定义
- 在 `createErrorPlugin` 中新增 Promise 采集能力（`promise` 开关 + 去重）
- 实现 `@monitor/vue` 的 `createMonitorVue` 插件
- 实现 `@monitor/react` 的 `MonitorErrorBoundary` 组件
- 理解"错误指纹"和"时间窗口去重"的设计，以及为什么用 `Map<string, number>` 而不是 `Set`

---

## 7.1 Promise 错误：unhandledrejection 事件

### 为什么 window error 事件捕获不到 Promise 错误？

先从根本上理解 `window.addEventListener('error', handler)` 是怎么工作的：

**`window error` 事件只会被"同步抛出的错误"触发。** 当 JS 引擎执行某行同步代码发生异常，调用栈立刻崩溃，JS 引擎会把这个异常包装成 `ErrorEvent` 向 `window` 派发——整个过程是即时的、同步的。

但 Promise 的 reject 不是"同步崩溃"，它走的是完全不同的路子：

```js
// 先理解两条路的区别

// 路线 A：同步错误 → window error 事件
null.toString()  // 立刻崩溃，JS 引擎同步派发 window error

// 路线 B：Promise reject → 不触发 window error
Promise.reject(new Error('出错了'))
// ↑ 这行代码本身不崩溃！
// 它只是创建了一个"状态为 rejected 的 Promise 对象"
// 对象已经创建，当前这行同步代码"成功执行完毕"了
// 所以 window error 不会触发
```

> 📖 **术语：微任务（Microtask）**  
> 白话：Promise 的 `.then` / `.catch` 回调不会立刻执行，它们被放进一个"待处理队列"，等当前同步代码全部执行完，才依次取出来执行。这个队列叫微任务队列。  
> 术语：Microtask Queue，由 JavaScript 事件循环（Event Loop）管理，优先级高于宏任务（setTimeout 等）。

```
时间轴（从上往下）：

[同步代码阶段]
  Promise.reject(new Error('出错了'))   ← 只是"创建对象"，不崩溃
  console.log('继续执行')               ← 正常打印
  // 同步代码结束

[微任务处理阶段]
  JS 引擎检查：刚才那个 rejected Promise，有 .catch() 处理它吗？
  没有！→ 标记为"unhandled rejection"
  → 向 window 派发 unhandledrejection 事件

[window error 事件 = 同步崩溃通道，压根没参与上面的流程]
```

换一句话说：**`window error` 是"同步崩溃"的通知机制，`unhandledrejection` 是"Promise 没人处理"的通知机制，这是两个完全独立的事件通道，互不干涉。**

所以，不管你是用 `try-catch`、还是监听 `window error`，都拦不住 Promise reject——除非专门监听 `unhandledrejection`。

### unhandledrejection 事件

```js
window.addEventListener('unhandledrejection', (event) => {
  console.log(event.reason)  // reject 时传入的值（通常是 Error 实例）
  console.log(event.promise) // 触发 rejection 的那个 Promise 对象
})
```

**触发时机**：当一个 Promise 被 reject，并且直到当前微任务队列清空后，仍然没有对应的 `.catch()` / `try-catch` 处理，浏览器才会派发这个事件。

典型场景：
```js
// 场景 1：直接 Promise.reject 不处理
Promise.reject(new Error('未捕获'))

// 场景 2：async 函数 throw，但调用处没有 await + try-catch
async function fetchData() {
  throw new Error('接口失败')
}
fetchData()  // 没有 await，也没有 .catch()

// 场景 3：异步代码里的 throw
async function loadConfig() {
  const config = await fetchConfig()  // 这里 reject 了
  return config.items  // 永远不会执行
}
loadConfig()  // 没有 .catch()
```

> 🏗️ **架构思考**
>
> **为什么把 Promise 采集放在 `createErrorPlugin` 里，而不是单独创建 `createPromiseErrorPlugin`？**
>
> 两种方案各有优缺：
>
> | 方案 | 优点 | 缺点 |
> |------|------|------|
> | 合并到 `createErrorPlugin`（我们的选择） | 接入一行代码，无需考虑插件加载顺序 | 选项越来越多，`ErrorPluginOptions` 可能变胖 |
> | 独立 `createPromiseErrorPlugin` | 职责单一，方便单独开关 | 用户需要注册多个插件，容易遗漏 |
>
> 选择合并方案的理由：Promise 未捕获异常本质上也是"错误类型"，与 JS 运行时错误属于同一语义层。而且合并后可以共享去重表（`dedupMap`），避免同一个错误被两个插件分别统计。
>
> **如果未来还要支持跨 Worker 的错误传递，再独立成包也不迟——先用最简单的方式解决问题。**

---

## 7.2 错误去重：防止高频错误刷爆队列

### 为什么需要去重？

想象这个场景：React 里有个死循环渲染：

```js
function Counter() {
  const [count, setCount] = useState(0)
  setCount(count + 1)  // 每次渲染都触发重新渲染 → 无限循环
  return <div>{count}</div>
}
```

或者一个 `setInterval` 里的错误：

```js
setInterval(() => {
  undefinedVariable.toString()  // 每 100ms 触发一次 error 事件
}, 100)
```

如果不去重，10 秒内会产生 100 条完全相同的错误上报。后端写入数据库的压力会骤增，而这 100 条数据的实际价值等于 1 条。

### 错误指纹设计

> 📖 **术语：错误指纹（Fingerprint）**  
> 白话：给每条错误起一个"身份 ID"——把错误的关键特征（消息 + 文件名 + 行号）拼成一个字符串。如果两条错误的指纹相同，就认为是同一条错误。  
> 术语：Fingerprint，用于错误分类聚合的唯一标识符。

#### 为什么要设计指纹？

判断"这两条错误是不是同一条"，不能简单地用 `===` 比较 `Error` 对象——每次 `throw new Error()` 都会创建一个全新对象，对象引用永远不相等。我们需要从**内容**上判断"同一类错误"。

**核心思想：只取"能唯一定位错误位置"的最小信息集合。**

一条错误的位置由三个维度确定：

| 维度 | 字段 | 作用 |
|------|------|------|
| 错误类型 | `message` | 区分"是什么错"，比如 "Cannot read properties of null" 和 "is not a function" 是两类不同错误 |
| 错误来源文件 | `filename` | 同样的消息可能来自不同文件，定位"在哪个文件出的问题" |
| 错误来源行号 | `lineno` | 同一个文件的不同行，说明是代码里不同位置的问题 |

三个维度合在一起，才能唯一确定"是哪个文件的哪一行发生了什么类型的错误"。

```typescript
// 把三个维度用竖线拼接成一个字符串
function computeFingerprint(message: string, filename: string, lineno: number | string): string {
  return `${message}|${filename}|${lineno}`
}

// 示例：
// TypeError: Cannot read properties of null (reading 'name')
// → "TypeError: Cannot read properties of null (reading 'name')|http://localhost:5173/src/App.vue|42"

// 同一个错误触发 100 次 → 100 次都得到同一个指纹字符串
// → 可以用指纹当 key 判断是否重复
```

> 💡 **为什么用竖线 `|` 分隔，而不是直接拼接？**
>
> 防止"歧义拼接"：假如消息是 `"a|b"`、文件名是 `"c"`、行号是 `1`，拼成 `"a|b|c|1"`；但如果消息是 `"a"`、文件名是 `"b|c"`、行号是 `1`，拼成的也是 `"a|b|c|1"`——两条不同的错误得到了同一个指纹，产生误判。
>
> 这个问题在实际中发生概率极低（错误消息和文件名里很少出现 `|`），工程上可以接受。如果要求严格，可以对每个字段做 URL 编码再拼接，彻底消除歧义。
>
> **这就是指纹设计最关键的工程思想：用最小代价、最直观的方式，给每条错误打上"身份标签"，让去重和聚合成为可能。**

### 时间窗口去重

函数名 `shouldDeduplicate` 的意思是："这条错误应该被去重（即跳过上报）吗？" 返回 `true` = 跳过，返回 `false` = 正常上报。

```typescript
// 去重表：key = 指纹字符串，value = 上次成功上报时的毫秒时间戳
// 用 Map 而不是 Set，因为需要记录"上次上报的时间"，不只是"有没有见过"
const dedupMap = new Map<string, number>()

function shouldDeduplicate(fingerprint: string): boolean {
  // 第一步：如果 dedupWindow 被设为 0，说明用户想关闭去重功能
  // 直接返回 false = 每次都上报，不跳过
  if (dedupWindow <= 0) return false

  // 第二步：查询这个指纹上次上报的时间
  // 如果从来没上报过，get() 返回 undefined
  const lastTime = dedupMap.get(fingerprint)
  const now = Date.now()  // 当前时间（毫秒）

  // 第三步：判断是否在"时间窗口"内
  // 条件一：lastTime !== undefined → 这条错误之前上报过（不是第一次出现）
  // 条件二：now - lastTime < dedupWindow → 距离上次上报还没超过窗口时间
  // 两个条件同时成立 → 说明"刚刚才上报过，还没过期" → 跳过这次上报
  if (lastTime !== undefined && now - lastTime < dedupWindow) {
    return true  // 应该去重，告诉调用方：跳过这次上报
  }

  // 第四步：走到这里说明是"第一次出现"或"窗口期已过"
  // 把这个指纹的时间戳更新为"现在"，作为下一次判断的基准
  dedupMap.set(fingerprint, now)
  return false  // 不需要去重，正常上报
}
```

用一个具体例子串联整个流程：

```
假设 dedupWindow = 1000ms（1 秒），某组件每 200ms 抛一次同一个错误：

T=0ms    shouldDeduplicate('指纹A') → lastTime=undefined → 更新为 0    → false（上报）✅
T=200ms  shouldDeduplicate('指纹A') → lastTime=0，200-0=200 < 1000    → true （跳过）⛔
T=400ms  shouldDeduplicate('指纹A') → lastTime=0，400-0=400 < 1000    → true （跳过）⛔
T=1100ms shouldDeduplicate('指纹A') → lastTime=0，1100-0=1100 ≥ 1000 → 更新为 1100 → false（上报）✅
T=1200ms shouldDeduplicate('指纹A') → lastTime=1100，100 < 1000       → true （跳过）⛔

结果：10 秒内产生 50 次错误，只上报 ~10 次（每秒最多 1 次）
```

> 🏗️ **架构思考**
>
> **为什么用 `Map<string, number>` 而不是 `Set<string>`？**
>
> `Set` 只能记录"是否见过"，无法实现"时间窗口"。如果用 `Set`，一条错误被记录后就永远不会再上报——即使这条错误在修复后重新出现，也会被漏掉。
>
> `Map` 存储"上次上报时间"，允许我们实现：**同一条错误在 1 秒（`dedupWindow`）内只上报一次，但 1 秒后恢复正常上报**。这样既能过滤短时间高频重复，又不会永久屏蔽。
>
> **这是监控系统中典型的"滑动窗口"思想——不是永久记忆，而是短期记忆。**

---

## 7.3 类型扩展：新增 Promise 和框架层错误载荷

在 `packages/core/src/types.ts` 中追加两个新类型，并更新 `ErrorPayload` 联合类型：

```typescript
// Promise 未捕获异常
export interface PromiseErrorPayload {
  subType: 'promise'
  message: string    // reason.message（若 reason 是 Error）或 String(reason)
  stack: string      // reason.stack（若 reason 是 Error）或空字符串
  reason: unknown    // Promise reject 时传递的原始值（任意类型）
}

// 框架层错误（Vue / React）
export interface FrameworkErrorPayload {
  subType: 'vue' | 'react'
  message: string
  stack: string
  componentInfo?: string  // Vue：组件名；React：componentStack
}

// 更新联合类型
export type ErrorPayload =
  | JsErrorPayload
  | ResourceErrorPayload
  | PromiseErrorPayload       // 新增
  | FrameworkErrorPayload     // 新增
```

> 📖 **术语：判别联合类型（Discriminated Union）**  
> 白话：把多个不同的类型合并成一个，通过一个固定的"标签字段"（这里是 `subType`）来区分到底是哪个类型。TypeScript 会根据 `subType` 的值自动推断剩余字段的类型，这叫"类型缩窄"。  
> 举例：`if (payload.subType === 'promise') { payload.reason }` — 进了这个分支，TypeScript 就知道 `payload` 是 `PromiseErrorPayload`，有 `reason` 字段。

**为什么 `reason` 的类型是 `unknown` 而不是 `Error`？**

Promise 可以 reject 任何值：

```js
Promise.reject('字符串类型')         // reason 是 string
Promise.reject(404)                   // reason 是 number
Promise.reject({ code: 'ERR_XXX' })   // reason 是 object
Promise.reject(new Error('标准错误')) // reason 才是 Error
```

用 `unknown` 而不是 `Error`，是在告诉调用方：**"使用前先检查类型，不要假设"**。这比用 `any` 更安全——`any` 是放弃检查，`unknown` 是要求检查。

---

## 7.4 Vue3 框架层错误捕获

### Vue 3 的错误处理机制

在 Vue 3 中，组件内部（setup / 生命周期钩子 / render 函数）抛出的错误，默认会：
1. 打印到控制台
2. 向上冒泡，直到被某个父组件的 `onErrorCaptured` 钩子拦截，或到达根应用

`app.config.errorHandler` 是整个应用的**全局最终兜底**：当一个错误没有被任何组件处理，最终会到达这里。

```typescript
app.config.errorHandler = (err, instance, info) => {
  // err：抛出的错误（unknown 类型，可能是任何值）
  // instance：发生错误的组件实例（ComponentPublicInstance | null）
  // info：错误发生的位置描述，如 "mounted hook" / "render function"
}
```

> 🏗️ **架构思考**
>
> **`@monitor/vue` 只依赖 `@monitor/core`，不依赖 `@monitor/browser`，为什么？**
>
> 如果 `@monitor/vue` 依赖 `@monitor/browser`，那它就只能在浏览器环境下使用。但 Vue 也可以在 SSR（服务端渲染）场景下运行，此时 `window` 不存在，`@monitor/browser` 无法运行。
>
> 通过依赖 `@monitor/core`（它不调用任何浏览器 API），`@monitor/vue` 保留了跨环境的潜力。
>
> 另一个好处：**依赖注入（Dependency Injection）**——`Monitor` 实例作为参数传入，而不是全局查找。这让 `createMonitorVue` 更容易测试（传入 mock 对象即可），也更容易在同一应用里管理多个 Monitor 实例。

### createMonitorVue 实现

```typescript
// packages/vue/src/index.ts

import type { App, ComponentPublicInstance } from 'vue'
import type { FrameworkErrorPayload, MonitorInstance } from '@monitor/core'

export function createMonitorVue(monitor: MonitorInstance): VuePlugin {
  return {
    install(app: App): void {
      app.config.errorHandler = (
        err: unknown,
        instance: ComponentPublicInstance | null,
        info: string,
      ): void => {
        const error = err instanceof Error ? err : new Error(String(err))

        // 获取组件名：优先读 name 选项，其次 __name（<script setup> 注入），最后用 info
        const componentName: string =
          (instance?.$options?.name as string | undefined) ??
          ((instance?.$.type as Record<string, unknown>)?.__name as string | undefined) ??
          info

        const payload: FrameworkErrorPayload = {
          subType: 'vue',
          message: error.message,
          stack: error.stack ?? '',
          componentInfo: componentName,
        }

        monitor.capture('error', payload)
      }
    },
  }
}
```

**接入方式**（`demos/vue3-demo/src/main.ts`）：

```typescript
import { createApp } from 'vue'
import { init, createErrorPlugin } from '@monitor/browser'
import { createMonitorVue } from '@monitor/vue'
import App from './App.vue'

// init() 返回 Monitor 实例
const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'vue3-demo',
  debug: true,
  plugins: [createErrorPlugin()],  // Promise 采集默认开启
})

createApp(App)
  .use(createMonitorVue(monitor))  // 传入 monitor 实例
  .mount('#app')
```

> ⚠️ **重要顺序**：`init()` 必须在 `createApp().use()` 之前调用，否则 `monitor` 实例还不存在。

**Vue 3 errorHandler 能捕获哪些错误？**

| 场景 | 能否捕获 |
|------|----------|
| `setup()` 函数中 throw | ✅ |
| 生命周期钩子（`onMounted` 等）中 throw | ✅ |
| 模板渲染表达式中的错误 | ✅ |
| `@click` 事件处理器中 throw | ✅（Vue 3.0+） |
| `setTimeout` / `Promise` 里的错误 | ❌（由 `createErrorPlugin` 的 `unhandledrejection` 处理） |

---

## 7.5 React 框架层错误捕获

### React 的崩溃模型

React 没有类似 Vue `errorHandler` 的全局机制。如果渲染阶段（`render()` 函数或函数式组件返回值的计算）抛错，React 会直接卸载整个组件树，屏幕变成白屏。

解决方案是 **ErrorBoundary（错误边界）**——包裹子树，当子树渲染出错时：
1. 捕获错误，阻止崩溃蔓延到整棵树
2. 显示降级 UI（"加载失败，请刷新"）
3. 上报错误到监控系统

### 为什么必须是 Class 组件？

> 📖 **术语：错误边界（Error Boundary）**  
> 白话：在 React 组件树里放一个"安全网"组件，任何子组件渲染出错，都会被这个安全网接住，而不是让整个页面崩溃。  
> 术语：Error Boundary，实现了 `getDerivedStateFromError` 或 `componentDidCatch` 的 Class 组件。

React 提供了两个 Class 组件专属的生命周期方法：

```typescript
class ErrorBoundary extends React.Component {
  // 当子组件渲染出错时，派生新 state（纯函数，不能有副作用）
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  // 当子组件渲染出错时，处理副作用（上报错误）
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // info.componentStack 是组件调用栈字符串
    sendToMonitor(error, info)
  }
}
```

**函数式组件至今无法实现 ErrorBoundary**——这是 React 设计上的已知局限，官方文档明确说明未来可能通过 hooks 提供方案（目前尚未落地）。

> 🏗️ **架构思考**
>
> **两个生命周期方法为什么要分开？**
>
> - `getDerivedStateFromError` 是**静态纯函数**：只负责"出错了，把 state 更新为 hasError"，不允许有副作用（网络请求、日志等）
> - `componentDidCatch` 是**实例方法**：只负责副作用（上报日志、发送请求等），不用于更新 state
>
> 这是 React 的"单一职责 + 副作用隔离"原则：状态更新和副作用分开，使渲染更可预测。

### MonitorErrorBoundary 实现要点

```typescript
export class MonitorErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const payload: FrameworkErrorPayload = {
      subType: 'react',
      message: error.message,
      stack: error.stack ?? '',
      componentInfo: info.componentStack ?? '',
    }
    this.props.monitor.capture('error', payload)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultFallbackUI error={this.state.error} />
    }
    return this.props.children
  }
}
```

**接入方式**（`demos/react-demo/src/main.tsx`）：

```tsx
import { init, createErrorPlugin } from '@monitor/browser'
import { MonitorErrorBoundary } from '@monitor/react'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'react-demo',
  debug: true,
  plugins: [createErrorPlugin()],
})

createRoot(document.getElementById('root')!).render(
  // MonitorErrorBoundary 放在 StrictMode 外层，避免开发模式双调用问题
  <MonitorErrorBoundary monitor={monitor}>
    <StrictMode>
      <App />
    </StrictMode>
  </MonitorErrorBoundary>,
)
```

> ⚠️ **`StrictMode` 与 `MonitorErrorBoundary` 的放置顺序**
>
> React `StrictMode` 在开发模式下会对某些生命周期方法进行双重调用，以帮助发现副作用问题。如果 `MonitorErrorBoundary` 放在 `StrictMode` 内部，`componentDidCatch` 可能被调用两次，导致同一条错误被上报两次。
>
> 将 `MonitorErrorBoundary` 放在 `StrictMode` 外层，可以避免这个问题，同时仍然让 `App` 组件享受 StrictMode 的双重检查保护。

**React ErrorBoundary 的局限性（能捕获 vs 不能捕获）**：

| 场景 | 能否捕获 |
|------|----------|
| render() / 函数式组件 return 中的错误 | ✅ |
| Class 组件生命周期（componentDidMount 等）中的错误 | ✅ |
| `onClick` 等事件处理器中的错误 | ❌（用 try-catch 或 createErrorPlugin） |
| `setTimeout` / `Promise` 里的错误 | ❌（由 createErrorPlugin 处理） |
| ErrorBoundary 自身的渲染错误 | ❌（由父层 ErrorBoundary 处理） |
| SSR 阶段的错误 | ❌ |

---

## 7.6 本章代码演练步骤

所有改动均在 `07.SDK 采集——Promise 异常与框架层错误/代码/monitor/` 目录下。

### 步骤 1：扩展类型定义

**文件**：`packages/core/src/types.ts`

在原有 `JsErrorPayload` 和 `ResourceErrorPayload` 之后追加：

```typescript
export interface PromiseErrorPayload {
  subType: 'promise'
  message: string
  stack: string
  reason: unknown
}

export interface FrameworkErrorPayload {
  subType: 'vue' | 'react'
  message: string
  stack: string
  componentInfo?: string
}

// 更新联合类型（追加两个新成员）
export type ErrorPayload =
  | JsErrorPayload
  | ResourceErrorPayload
  | PromiseErrorPayload
  | FrameworkErrorPayload
```

同时在 `packages/core/src/index.ts` 中追加导出：

```typescript
export type { PromiseErrorPayload, FrameworkErrorPayload } from './types'
```

### 步骤 2：更新 createErrorPlugin（添加 Promise 采集 + 去重）

**文件**：`packages/browser/src/plugins/error.ts`

关键改动：
1. `ErrorPluginOptions` 新增 `promise?: boolean` 和 `dedupWindow?: number`
2. 新增 `computeFingerprint()` 工具函数
3. 新增 `dedupMap` 和 `shouldDeduplicate()` 去重逻辑
4. 新增 `rejectionHandler`，监听 `unhandledrejection` 事件
5. `teardown()` 中清理 `rejectionHandler` 和 `dedupMap`

### 步骤 3：实现 @monitor/vue

**文件**：`packages/vue/src/index.ts`

```typescript
export function createMonitorVue(monitor: MonitorInstance): VuePlugin
```

### 步骤 4：实现 @monitor/react

**文件**：`packages/react/src/index.ts`

```typescript
export class MonitorErrorBoundary extends React.Component<
  MonitorErrorBoundaryProps,
  MonitorErrorBoundaryState
>
```

### 步骤 5：更新 browser/index.ts

在重导出类型的部分追加：

```typescript
export type { PromiseErrorPayload, FrameworkErrorPayload } from '@monitor/core'
```

### 步骤 6：更新 demos

**vue3-demo/src/main.ts**：
```typescript
const monitor = init({ ... })
createApp(App).use(createMonitorVue(monitor)).mount('#app')
```

**react-demo/src/main.tsx**：
```tsx
const monitor = init({ ... })
createRoot(container).render(
  <MonitorErrorBoundary monitor={monitor}>
    <StrictMode><App /></StrictMode>
  </MonitorErrorBoundary>
)
```

两个 demo 的 `App.vue` / `App.tsx` 中新增演示区域：
- 🟠 **Promise 未捕获异常**：`Promise.reject` 无 catch / async throw 无 await
- 🟣 **框架层错误**：Vue `setup()` 抛错 / React 渲染子组件抛错

### 步骤 7：构建验证

```bash
cd '07.SDK 采集——Promise 异常与框架层错误/代码/monitor'
pnpm build
# 期望：Tasks: 10 successful, 10 total
```

---

## 7.7 运行验证

启动 vue3-demo：

```bash
pnpm --filter @monitor/vue3-demo dev
```

打开浏览器控制台，依次点击按钮，预期日志：

```
# Promise.reject（无 catch）
[Monitor] capture | type=error { payload: { subType: 'promise', message: '模拟 Promise.reject：未捕获的异步错误', stack: '...', reason: Error } }

# async throw（无 try-catch）
[Monitor] capture | type=error { payload: { subType: 'promise', message: '模拟 async throw：接口请求失败 (500 Internal Server Error)', ... } }

# 去重测试（5 次相同错误）
[Demo] 触发了 5 次相同 Promise 错误，SDK 去重后预期只上报 1 次
[Monitor] capture | type=error { payload: { subType: 'promise', message: '去重测试：相同错误', ... } }
# ← 注意：只打印一次 capture，说明去重生效

# Vue setup() 抛错
[Monitor][Vue] Component error captured: Error: 模拟 Vue 事件处理器错误... Component: App Info: native event handler
[Monitor] capture | type=error { payload: { subType: 'vue', message: '...', componentInfo: 'App' } }

# Vue 子组件渲染出错
[Monitor][Vue] Component error captured: Error: 模拟 Vue 渲染错误：BrokenComponent setup() 抛出异常 Component: BrokenComponent
[Monitor] capture | type=error { payload: { subType: 'vue', componentInfo: 'BrokenComponent' } }
```

---

## 7.8 本章小结

| 知识点 | 核心结论 |
|--------|----------|
| unhandledrejection | Promise reject 后无任何处理，浏览器异步派发此事件（不是同步的 error 事件） |
| 错误指纹 | message + filename + lineno 拼接，用 `\|` 分隔避免碰撞 |
| 时间窗口去重 | `Map<string, number>`：key=指纹，value=上次上报时间；窗口期内跳过，不永久屏蔽 |
| Vue errorHandler | 全局兜底，捕获所有组件层的错误；接受 Monitor 实例作为参数（依赖注入） |
| React ErrorBoundary | 必须是 Class 组件；只捕获渲染阶段的错误，事件处理/Promise 错误捕获不到 |
| `@monitor/vue` 依赖设计 | 只依赖 `@monitor/core`，不依赖 `@monitor/browser`；保留 SSR 兼容性 |
| `unknown` vs `any` | `reason: unknown` 要求使用前类型检查；`any` 是放弃检查，是 TypeScript 的"最后手段" |

**覆盖的错误类型完整版**（截止本章）：

```
window error 事件 ──┬── JS 运行时错误（subType: 'js'）
                   └── 资源加载失败（subType: 'resource'）

unhandledrejection ──── Promise 未捕获异常（subType: 'promise'）

Vue errorHandler ──────  Vue 组件层错误（subType: 'vue'）

React ErrorBoundary ───  React 渲染层错误（subType: 'react'）
```

**下一章（第 08 章）** 将进入性能指标采集：PerformanceObserver + Web Vitals（FCP / LCP / CLS / FID / TTFB），进入完全不同的浏览器 API 体系。

---

## 附录：常见问题

**Q：Vue errorHandler 和 window error 事件会重复上报同一条错误吗？**

A：可能会，取决于 Vue 的内部错误处理机制。Vue 3 在调用 `errorHandler` 后，通常不会再将错误重新抛出（不触发 window error）。但在 Vue 2 中存在差异。可以在 `errorHandler` 里设置标志位，或者依赖 `createErrorPlugin` 的去重机制来处理。

**Q：React StrictMode 双重渲染会导致 ErrorBoundary 重复上报吗？**

A：`StrictMode` 只对 `useEffect` 进行双重调用，`componentDidCatch` 不受影响。但如果 `MonitorErrorBoundary` 在 `StrictMode` 内部，存在双重调用的风险，所以我们把它放在 `StrictMode` 外层。

**Q：去重窗口期设多少合适？**

A：默认 1000ms（1 秒）适合大多数场景。高频数据场景（如游戏、实时编辑器）可适当增大（5000ms）；需要快速响应的场景可减小（500ms）。完全关闭去重设 `dedupWindow: 0`。
