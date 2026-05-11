# 第 06 章：SDK 采集——JS 错误与资源加载错误

## 开篇：什么叫"把错误采集做对"

很多人觉得错误采集很简单：

```js
window.onerror = (msg, source, lineno, colno, error) => {
  fetch('/collect', { method: 'POST', body: JSON.stringify({ msg, stack: error?.stack }) })
}
```

这段代码能工作，但在真实生产中会遇到这些问题：

- **资源加载失败（404 图片、脚本）完全监控不到**
- **Promise 里的错误一条也捕获不到**（async/await 里 throw 的错误）
- **Vue / React 里的错误有时候会被框架拦截，没有上报**
- **"Script error." 什么信息都没有，无法排查**
- **同一个错误每秒上报 500 条，把后端打崩**

这一章解决前两个问题——**同步 JS 错误和资源加载错误**。后面的章节继续解决其余问题。解决它们的过程，也是把"抓 bug 的工具本身写对"的过程。

---

## 本章目标

- 理解 `window.onerror` 和 `addEventListener('error')` 的区别，以及为什么要选后者
- 理解资源错误为什么不能冒泡、捕获阶段监听的原理
- 理解 JS 错误的完整数据结构（消息 / 文件 / 行列号 / 调用栈 / 错误类型）
- 理解"无痕采集"和"手动埋点"的适用边界
- 实现 `createErrorPlugin()`，让它作为第一个真正能工作的采集插件接入数据管道
- 读懂 `ErrorPayload` 的判别联合类型设计，以及它如何为后续章节预留扩展空间

---

## 6.1 浏览器错误事件的两种监听方式

### window.onerror

```js
window.onerror = function(message, source, lineno, colno, error) {
  // message : '未定义的变量 x'
  // source  : 'https://example.com/main.js'
  // lineno  : 42
  // colno   : 18
  // error   : Error 实例（包含 stack）
}
```

**看起来很完整，但有三个坑：**

**坑 1 — 只能有一个处理器**

`window.onerror` 是一个属性，赋值会覆盖之前的值。如果你的项目里还用了其他监控工具（或者自己的代码也赋值了 `window.onerror`），它们会互相覆盖，最终只有最后一个生效。

```js
window.onerror = handler1  // 来自第三方 SDK
window.onerror = handler2  // 来自你自己的 SDK → handler1 被覆盖，静默失效
```

**坑 2 — 捕获不到资源加载失败**

`img src="not-exist.png"` 加载失败，`window.onerror` 什么都收不到。这一类错误不会到达 `window.onerror`，它只停留在元素自身上，不冒泡。

**坑 3 — 无法精确控制移除**

`window.onerror = null` 会移除，但如果有多方都设置了这个属性，你不知道移除的是不是自己的。

### addEventListener('error', handler, true)

```js
window.addEventListener('error', handler, true)  // 注意：第三个参数 true
```

**为什么加第三个参数 `true`？**

这是浏览器事件传播的核心机制。先来理解事件传播的两个阶段：

```
事件传播的两个阶段（以 <img> 加载失败为例）：

                    window
                      |
     ┌────────── 捕获阶段（向下）──────────────┐
     ↓                                           ↓
   document                                  document
     ↓                                           ↓
   body                                       body
     ↓                                           ↓
   <div>                                      <div>
     ↓                                           ↓
   <img> ← 错误事件在此元素触发      ————→   <img>（目标阶段）
                                                  ↓
                                    （不冒泡，到这里就停了）
```

- **捕获阶段**（Capture Phase）：事件从 window 向下传播到目标元素。`addEventListener('event', handler, true)` 的处理器在这个阶段执行。
- **冒泡阶段**（Bubble Phase）：事件从目标元素向上冒泡回 window。`addEventListener('event', handler)` / `addEventListener('event', handler, false)` 的处理器在这个阶段执行。

资源加载错误（`<img>`/`<script>`/`<link>` 加载失败触发的 error 事件）**不会冒泡**——只在目标元素上触发，不会向上传递。

所以：
- `window.onerror` → 只在冒泡阶段，资源错误根本到不了 window
- `window.addEventListener('error', handler, false)` → 同样，只在冒泡阶段，抓不到资源错误
- `window.addEventListener('error', handler, true)` → 在捕获阶段，事件从 window 向下传播时就能截获，**JS 运行时错误和资源加载错误都能捕获**

> 📖 **术语：事件捕获（Event Capture）**  
> 直白说：在事件从最顶层（window）向下传播到目标元素的过程中，沿途的监听器先执行一次。  
> 第三个参数 `true` 告诉浏览器"我要在捕获阶段执行"，`false` 或不传表示"我要在冒泡阶段执行"。  
> 技术表述：DOM Level 2 事件传播模型中，捕获阶段（capture phase）优先于目标阶段（target phase）和冒泡阶段（bubble phase）执行。

**addEventListener 的额外优势：**

- 可以注册多个，互不覆盖
- 移除时精确对应（同一个函数引用才能移除），不影响其他监听器
- `teardown()` 时可以精确清理

> 🏗️ **架构思考：为什么推荐 addEventListener，而不是 window.onerror？**  
> SDK 是会被"嵌入到别人的项目里"的代码。你不知道宿主项目里还有没有别的代码用了 `window.onerror`，也不知道有没有其他监控 SDK 也在运行。用 `addEventListener` 是"礼貌的代码"——不侵占属性，不覆盖别人，自己注册自己的，移除时精确清理。  
> 这种"不假设环境是干净的"的设计意识，是写第三方库代码的基本素养。

---

## 6.2 区分 JS 错误和资源错误

用 `addEventListener('error', handler, true)` 监听之后，我们会同时收到两种事件：

1. **JS 运行时错误**：`e.target === window`，`e` 是 `ErrorEvent` 类型，有 `message`/`filename`/`lineno`/`colno`/`error` 属性
2. **资源加载错误**：`e.target` 是 `<img>` / `<script>` / `<link>` 等 HTML 元素

**如何区分：检查 `e.target` 是不是 HTMLElement**

```typescript
window.addEventListener('error', (e: ErrorEvent) => {
  const target = e.target as EventTarget

  if (target instanceof HTMLElement) {
    // 是资源加载错误：e.target 是加载失败的 HTML 元素
    console.log('资源错误', (target as HTMLImageElement).src)
  } else {
    // 是 JS 运行时错误：e.target 是 window 本身
    console.log('JS 错误', e.message, e.lineno)
  }
}, true)
```

**为什么判断 `instanceof HTMLElement` 而不是 `target instanceof Window`？**

更稳健。`instanceof Window` 在某些 iframe 环境或跨 realm 场景下可能失效，而 `instanceof HTMLElement` 更可靠，因为 `<img>`/`<script>`/`<link>` 都继承自 HTMLElement。

---

## 6.3 JS 错误的数据结构

一条 JS 运行时错误，我们需要采集哪些字段？

```typescript
export interface JsErrorPayload {
  subType: 'js'       // 标识来源
  message: string     // 错误消息："Cannot read properties of null"
  filename: string    // 出错的文件：'https://example.com/main.js'
  lineno: number      // 行号：42
  colno: number       // 列号：18
  stack: string       // 调用栈（原始字符串，后续 SourceMap 可以还原到源码）
  errorType: string   // Error 子类：'TypeError' / 'ReferenceError' / 'RangeError'...
}
```

### 为什么需要 errorType？

后端查询时，`errorType: 'TypeError'` 就能区分"类型错误"和"引用错误"——它们需要不同的修复方式。按 `errorType` 分类统计，能快速发现哪类错误最多。

### 为什么 stack 是原始字符串，不做解析？

压缩后的代码里，`stack` 里的行列号是压缩后的，比如：
```
Error: test
  at main.min.js:1:4832
```

要还原到源码，需要 SourceMap 文件（`main.min.js.map`）。SourceMap 文件可能很大（几 MB），在客户端解析会影响性能，而且如果 SourceMap 托管在服务端，客户端根本没有访问权限。

**正确做法**：客户端只采集原始 stack，服务端持有 SourceMap 文件，查询时在服务端做还原。这一章先保留原始字符串，SourceMap 还原是独立功能，后续章节按需实现。

### "Script error." 是什么情况？

当 `<script src="https://cdn.other-domain.com/lib.js">` 加载的跨域脚本里发生错误时，浏览器出于安全考虑，会将 `message` 设为 `"Script error."`，同时 `filename`/`lineno`/`colno` 全部为空，`e.error` 也是 null。

**根本原因**：浏览器不允许一个域的 JS 读取另一个域的错误详情（可能泄露用户信息）。

**解决办法**：在服务端设置 CDN 的响应头 `Access-Control-Allow-Origin: *`，然后在 `<script>` 标签上加 `crossorigin="anonymous"` 属性——告诉浏览器"我允许跨域读取错误信息"。

```html
<script src="https://cdn.example.com/lib.js" crossorigin="anonymous"></script>
```

加了之后，浏览器会发一个 `Origin` 头，服务端允许后，错误详情就完整了。

### 为什么 SyntaxError 无法被捕获？

```js
// 这段代码在加载时就已经出错了
eval('这不是合法的 JavaScript {{{')

// SyntaxError 发生在代码解析阶段，早于任何监听器的注册
```

`window.addEventListener('error')` 的注册发生在代码执行阶段，而 `SyntaxError` 发生在代码解析阶段——这时候你的监听器还没来得及注册，所以捕获不到。

**解决思路**：SyntaxError 通常意味着代码本身有问题（构建工具漏掉了），这类错误应该在发布前通过 `tsc --noEmit` 或 CI 检查发现，而不是依赖运行时监控。

---

## 6.4 资源错误的数据结构

```typescript
export interface ResourceErrorPayload {
  subType: 'resource'  // 标识来源
  tagName: string      // 'IMG' / 'SCRIPT' / 'LINK' / 'AUDIO' / 'VIDEO'
  src: string          // 加载失败的 URL（图片/脚本的 src，样式表的 href）
}
```

### 为什么只监控特定标签，不监控所有 HTMLElement 的 error 事件？

```typescript
const MONITORED_TAGS = new Set(['IMG', 'SCRIPT', 'LINK', 'AUDIO', 'VIDEO'])
if (!MONITORED_TAGS.has(tagName)) return
```

某些第三方库（如 Leaflet 地图、Monaco 编辑器）可能在 `<div>` 上 dispatch 自定义的 `error` 事件（`new ErrorEvent('error', {...})`）。这些自定义事件不是真正的资源加载失败，如果全部采集会引入大量噪音。

通过白名单只采集我们关心的标签，过滤掉无关的事件。

> 🏗️ **架构思考：为什么用 `Set` 而不是数组 `includes`？**  
> `Set.has()` 的时间复杂度是 O(1)，`Array.includes()` 是 O(n)。对于频繁触发的事件监听器而言（每次 error 事件都要判断），O(1) 更合理。虽然数组只有 5 个元素，差距可以忽略，但这是"性能敏感代码应该用正确数据结构"的好习惯。

---

## 6.5 ErrorPayload 的联合类型设计

`capture('error', payload)` 里的 `payload` 是 `unknown` 类型，各插件可以放任何东西进去。但这只是"运行时的灵活性"，我们还希望有"编译时的类型安全"——写插件的人和写后端解析的人都需要知道 payload 的形状。

### 判别联合类型（Discriminated Union）

```typescript
// packages/core/src/types.ts

export interface JsErrorPayload {
  subType: 'js'      // ← 判别字段（literal type）
  message: string
  filename: string
  lineno: number
  colno: number
  stack: string
  errorType: string
}

export interface ResourceErrorPayload {
  subType: 'resource'  // ← 判别字段
  tagName: string
  src: string
}

// 联合类型：payload 是这两者之一
export type ErrorPayload = JsErrorPayload | ResourceErrorPayload
```

**这个设计有什么用？**

TypeScript 可以根据 `subType` 的值自动"缩窄"类型（Type Narrowing）：

```typescript
function handlePayload(payload: ErrorPayload) {
  if (payload.subType === 'js') {
    // TypeScript 知道这里 payload 是 JsErrorPayload
    console.log(payload.stack)   // ✅ 有提示
    console.log(payload.tagName) // ❌ 编译报错：JsErrorPayload 没有 tagName
  } else {
    // TypeScript 知道这里 payload 是 ResourceErrorPayload
    console.log(payload.src)     // ✅ 有提示
    console.log(payload.stack)   // ❌ 编译报错：ResourceErrorPayload 没有 stack
  }
}
```

> 📖 **术语：判别联合类型（Discriminated Union）**  
> 直白说：几种类型放在一起，每种类型都有一个固定字段（判别字段），字段值不同对应不同的类型。TypeScript 看到判别字段的值，就能知道当前是哪种类型，并给出对应的属性提示和类型检查。  
> 技术表述：以 Literal Type 字段作为判别符（discriminant）的联合类型，是类型安全的多态表达方式。

### 为什么要预留扩展空间？

注意 `types.ts` 里的注释：

```typescript
/**
 * 后续章节会继续扩展此联合类型：
 *   - PromiseErrorPayload（subType: 'promise'）→ 第 07 章 unhandledrejection
 *   - FrameworkErrorPayload（subType: 'vue' | 'react'）→ 第 07 章框架适配
 */
export type ErrorPayload = JsErrorPayload | ResourceErrorPayload
```

到第 07 章，我们只需要：
1. 新增 `PromiseErrorPayload` 接口（`subType: 'promise'`）
2. 在 `ErrorPayload` 联合类型里追加 `| PromiseErrorPayload`
3. 不需要改 `JsErrorPayload` 或 `ResourceErrorPayload`

这是**开放-封闭原则**（Open-Closed Principle）的实际应用：**对扩展开放，对修改封闭**——新功能通过添加新类型来实现，不修改已有类型。

> 📖 **术语：开放-封闭原则（Open-Closed Principle）**  
> 直白说：代码应该很容易被扩展（加新功能），但已经写好的逻辑不需要为了新功能而修改。  
> 技术表述：软件实体（类、模块、函数）应该对扩展开放，对修改封闭。TypeScript 的联合类型是实现这一原则的工具之一。

---

## 6.6 无痕采集与手动埋点：两种策略的适用边界

这一章引入了第一个实际有用的插件，也是介绍"两种埋点策略"的好时机。

### 无痕采集（全埋点）

```
不改业务代码，只注册插件，SDK 自动监听
```

```typescript
// main.ts 里注册一次，之后不需要改任何业务代码
init({
  plugins: [createErrorPlugin()],
})
```

**优点**：
- 零侵入，不需要开发者在业务代码里写任何监控相关代码
- 覆盖面广，只要错误发生就能捕获，不会因为开发者遗漏而丢失数据

**缺点**：
- 采集到的数据比较通用（错误消息、文件、行号），缺少业务上下文
- 某些情况下会采集到无意义的噪音（比如第三方广告脚本的错误）

**适合场景**：错误监控、性能监控、通用行为监控。

### 手动埋点（代码埋点）

```
在业务代码里明确调用 capture()，上报带有业务语义的数据
```

```typescript
// 用户支付时，接口返回业务错误，手动上报
async function handlePayment() {
  const result = await paymentApi.charge(orderId)
  if (result.code === 'BALANCE_INSUFFICIENT') {
    // 手动上报带有业务上下文的数据
    capture('error', {
      subType: 'js',
      message: `支付失败：${result.message}`,
      errorType: 'BusinessError',
      // 可以携带业务数据，后端存储时可以根据这些数据做精细化分析
      filename: 'payment.ts',
      lineno: 0, colno: 0, stack: '',
    } satisfies JsErrorPayload)
  }
}
```

**优点**：
- 数据里有明确的业务语义（"支付失败"比"TypeError: Cannot read..."更有价值）
- 完全可控，想上报什么就上报什么

**缺点**：
- 需要开发者主动在每个关键节点写埋点代码
- 容易遗漏，也容易在业务迭代时忘了同步更新埋点

**适合场景**：关键业务流程的精确追踪（支付、注册、核心功能使用率）。

> 🏗️ **架构思考：SDK 为什么同时支持两种策略？**  
> 这两种策略不是非此即彼的关系，而是互补的：  
> - 无痕采集负责"兜底"——不管业务代码写得多随意，错误都能被捕获  
> - 手动埋点负责"精确"——关键节点的数据有明确语义，方便做业务分析  
>
> SDK 的 Plugin 机制支持无痕采集（在 setup 里注册全局监听），`capture()` API 支持手动埋点（随时调用）。两者都走同一条数据管道（`capture → 采样 → 队列 → flush`），后端不需要区别对待。

---

## 6.7 createErrorPlugin 插件实现

文件路径：`packages/browser/src/plugins/error.ts`

### 插件接口回顾

上一章设计的 `Plugin` 接口：

```typescript
export interface Plugin {
  name: string                          // 唯一名称，防止重复注册
  setup(monitor: MonitorInstance): void  // 初始化：绑定监听
  teardown?(): void                      // 清理（可选）：移除监听，防止内存泄漏
}
```

### 完整实现

```typescript
// packages/browser/src/plugins/error.ts

export interface ErrorPluginOptions {
  js?: boolean       // 是否采集 JS 运行时错误（默认 true）
  resource?: boolean // 是否采集资源加载失败（默认 true）
}

const MONITORED_TAGS = new Set(['IMG', 'SCRIPT', 'LINK', 'AUDIO', 'VIDEO'])

export function createErrorPlugin(options: ErrorPluginOptions = {}): Plugin {
  const { js = true, resource = true } = options

  // 持有处理器引用（teardown 时需要精确移除）
  let errorHandler: ((e: ErrorEvent) => void) | null = null

  return {
    name: 'error',

    setup(monitor: MonitorInstance): void {
      errorHandler = (e: ErrorEvent) => {
        const target = e.target as EventTarget

        if (target instanceof HTMLElement) {
          if (!resource) return
          const tagName = (target as HTMLElement).tagName
          if (!MONITORED_TAGS.has(tagName)) return

          monitor.capture('error', {
            subType: 'resource',
            tagName,
            src: (target as HTMLImageElement).src
              || (target as HTMLScriptElement).src
              || (target as HTMLLinkElement).href
              || '',
          } satisfies ResourceErrorPayload)
          return
        }

        if (!js) return
        monitor.capture('error', {
          subType: 'js',
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error instanceof Error ? (e.error.stack ?? '') : '',
          errorType: e.error instanceof Error ? e.error.constructor.name : 'Error',
        } satisfies JsErrorPayload)
      }

      window.addEventListener('error', errorHandler, true)
    },

    teardown(): void {
      if (errorHandler) {
        window.removeEventListener('error', errorHandler, true)
        errorHandler = null
      }
    },
  }
}
```

### 关键设计点逐一解释

**1. 为什么用工厂函数 `createErrorPlugin()`，而不是直接导出一个对象？**

```typescript
// ❌ 直接导出对象
export const errorPlugin: Plugin = { name: 'error', setup(...) { ... } }

// ✅ 工厂函数
export function createErrorPlugin(options = {}): Plugin { ... }
```

直接导出对象时，`errorHandler` 这个局部变量只能是模块级的闭包——如果同一个模块在多个 Monitor 实例中被使用（虽然我们有单例机制，但测试环境会创建多实例），`errorHandler` 会被多个实例共享，产生干扰。

工厂函数每次调用都创建独立的闭包，每个插件实例都有自己的 `errorHandler` 引用，互不影响。

**2. 为什么 errorHandler 要在外部变量里保存引用？**

```typescript
let errorHandler: ((e: ErrorEvent) => void) | null = null
```

`removeEventListener` 必须传入**和 addEventListener 完全相同的函数引用**才能移除。如果每次调用 `teardown()` 都新建一个函数，是移除不掉的：

```typescript
// ❌ 错误示例：每次都是新函数，移除不掉
window.removeEventListener('error', (e) => { ... }, true)

// ✅ 正确：同一个引用
window.addEventListener('error', errorHandler, true)
window.removeEventListener('error', errorHandler, true)
```

不移除会导致内存泄漏：即使 Monitor 已经销毁，这个监听器仍然存活在 window 上，持有对旧 Monitor 的闭包引用，阻止垃圾回收。

**3. `satisfies` 和 `as` 的区别**

在插件实现里，我们用 `satisfies` 而不是 `as`：

```typescript
// ❌ 用 as 断言（不安全）：骗过编译器，运行时可能出错
monitor.capture('error', { subType: 'js', ... } as JsErrorPayload)

// ✅ 用 satisfies 检查（安全）：真正验证类型是否正确
monitor.capture('error', { subType: 'js', ... } satisfies JsErrorPayload)
```

`as` 是"相信我，它是这个类型"；`satisfies` 是"帮我验证它确实是这个类型"。写 SDK 代码，应该尽量用 `satisfies`，因为 SDK 的类型错误会传播到所有接入方。

> 🏗️ **架构思考：为什么把 errorHandler 设为 null 而不是 undefined？**  
> 惯例。`null` 语义上表示"已清空/已销毁"（一个有意识的空值），`undefined` 表示"从未被赋值"（还没初始化）。  
> 在 teardown 里 `errorHandler = null` 是有意清空，防止重复调用 teardown 时再次执行 removeEventListener（`if (errorHandler)` 能阻止这一点）。这是细节，但体现了"防御性编程"——代码不假设调用者只会调用 teardown 一次。

---

## 6.8 在 browser/index.ts 里导出插件

### 为什么插件放在 `browser` 包而不是 `core` 包？

`core` 包的设计原则是**不依赖浏览器 API**，保留跨环境（SSR/Node.js）的可能性。

`createErrorPlugin` 直接调用了：
- `window.addEventListener`
- `e.target instanceof HTMLElement`
- `(target as HTMLImageElement).src`

这些全是浏览器 API。放进 `core` 包会破坏 `core` 的环境无关性。所以所有依赖浏览器 API 的采集插件，都放在 `browser` 包下的 `plugins/` 目录。

```
packages/
├── core/         ← 不依赖浏览器 API（环境无关）
│   └── src/
│       ├── types.ts    ← 类型定义（包括 ErrorPayload）
│       └── monitor.ts  ← 数据管道核心
└── browser/      ← 只在浏览器运行
    └── src/
        ├── index.ts          ← 单例 + 对外 API + 插件重导出
        └── plugins/
            └── error.ts      ← JS 错误 + 资源错误采集插件（本章）
            ← promise.ts      ← Promise 错误采集插件（第 07 章）
```

### 插件从 index.ts 统一导出

```typescript
// packages/browser/src/index.ts（新增）
export { createErrorPlugin } from './plugins/error'
export type { ErrorPluginOptions } from './plugins/error'
```

> 🏗️ **架构思考：这里的 index.ts 是一个 Facade（门面）**  
> 用户只需要 `import { init, createErrorPlugin } from '@monitor/browser'`，不需要知道 `createErrorPlugin` 的实现在 `plugins/error.ts` 这个具体路径。  
> 如果将来重构，把 `error.ts` 拆分或改名，只要 `index.ts` 里的导出不变，用户代码就不需要改。这是"隐藏实现细节"的体现。  
>
> **进阶设计（生产环境的做法）**：如果项目有很多插件，可以将每个插件配置为独立的构建入口（tsup entry），让用户通过子路径导入 `import { createErrorPlugin } from '@monitor/browser/plugins/error'`。这样只需要用到的插件才会被打包进 bundle，实现更精细的 tree-shaking。本课程为简化起见，统一从主入口导出。

---

## 6.9 类型从 @monitor/core 通过 @monitor/browser 重导出

### 为什么 demos 从 @monitor/browser 引入类型，而不是直接从 @monitor/core？

```typescript
// ❌ demos 里直接引用内部包
import type { JsErrorPayload } from '@monitor/core'

// ✅ 通过 browser 包转发
import type { JsErrorPayload } from '@monitor/browser'
```

demos（以及真实项目中的业务代码）是 `@monitor/browser` 的**用户**，不是 `@monitor/core` 的用户。

如果让用户直接引用 `@monitor/core`：
1. 用户的 `package.json` 里需要手动添加 `@monitor/core` 依赖
2. `@monitor/core` 是内部实现包，它的 API 变动不应该直接影响用户
3. "内部包" 的概念泄露给了外部用户（抽象泄露）

正确的做法：`@monitor/browser` 作为公共 API 层，把用户需要的类型全部重导出：

```typescript
// packages/browser/src/index.ts
export type { MonitorOptions, Plugin, EventType } from '@monitor/core'
export type { JsErrorPayload, ResourceErrorPayload, ErrorPayload } from '@monitor/core'
```

用户只感知 `@monitor/browser`，不需要感知 `@monitor/core` 的存在。

---

## 6.10 在 demos 里验证

### 启动步骤

```bash
cd '06.SDK 采集——JS 错误与资源加载错误/代码/monitor'
pnpm build
pnpm --filter @monitor/vue3-demo dev
# 或
pnpm --filter @monitor/react-demo dev
```

### 验证场景 1：触发 JS 运行时错误（无痕采集）

点击"触发 JS 运行时错误"按钮，控制台应出现：

```
[Monitor] Plugin "error" registered.
[Monitor] initialized | appId=vue3-demo | traceId=xxx | plugins=error

[Monitor] capture | type=error {
  traceId: 'xxx',
  appId: 'vue3-demo',
  type: 'error',
  payload: {
    subType: 'js',
    message: 'window.undefinedFunctionThatDoesNotExist is not a function',
    filename: 'http://localhost:5173/src/App.vue',
    lineno: 82,
    colno: 7,
    stack: 'TypeError: window.undefinedFunctionThatDoesNotExist is not a function\n  at ...',
    errorType: 'TypeError',
  },
  timestamp: 1746748800000,
  page: 'http://localhost:5173/',
  ua: 'Mozilla/5.0 ...'
}
```

**逐项对照检查：**

| 字段 | 期望值 | 说明 |
|---|---|---|
| `payload.subType` | `'js'` | 插件正确判断了是 JS 错误 |
| `payload.errorType` | `'TypeError'` | 从 `error.constructor.name` 取得 |
| `payload.stack` | 包含函数名和行号 | 原始调用栈，后续 SourceMap 可还原 |
| `traceId` | 每次刷新改变，同一次会话内相同 | 来自 Monitor 构造时生成的会话 ID |

### 验证场景 2：资源加载失败（无痕采集）

点击"加载不存在的图片"按钮，控制台应出现：

```
[Monitor] capture | type=error {
  payload: {
    subType: 'resource',
    tagName: 'IMG',
    src: 'http://localhost:9999/not-exist-image.png',
  },
  ...
}
```

**注意**：点击后控制台可能还会出现浏览器自带的网络错误红字（`GET http://localhost:9999/... net::ERR_CONNECTION_REFUSED`），这是浏览器 DevTools 自己的提示，不是我们的 SDK 输出，不用理会。

### 验证场景 3：手动埋点

点击"手动上报业务异常"按钮，控制台应出现：

```
[Monitor] capture | type=error {
  payload: {
    subType: 'js',
    message: '手动埋点：业务异常 - 支付接口返回错误码 PAY_FAILED',
    errorType: 'BusinessError',
    ...
  },
  ...
}
```

与自动捕获的区别：`errorType: 'BusinessError'`（我们自定义的），`stack: ''`（业务逻辑错误不需要调用栈）。

### 完整数据流（以 JS 错误为例）

```
JS 代码抛出 TypeError（window.undefinedFunction is not a function）
    ↓
浏览器在 window 上派发 error 事件（捕获阶段）
    ↓
createErrorPlugin 的 errorHandler 执行：
    ├── target === window（非 HTMLElement）→ 判定为 JS 错误
    └── 构造 JsErrorPayload：{ subType: 'js', message, filename, lineno, colno, stack, errorType }
    ↓
monitor.capture('error', payload)
    ↓
Monitor.capture()：
    ├── 采样过滤（sampleRate=1，全部通过）
    ├── 封装 MonitorEvent（自动填 traceId / appId / timestamp / page / ua）
    ├── queue.push(event)
    └── _flush()（debug 模式：打印日志；HTTP 上报接入后：fetch POST → DSN）
```

---

## 6.11 为第 07 章做好准备

第 07 章将继续处理两类当前还未覆盖的错误：

### Promise 异常（unhandledrejection）

```typescript
// 这种错误，createErrorPlugin 捕获不到
async function fetchData() {
  throw new Error('接口请求失败')  // 没有 try/catch，也没有 .catch()
}
fetchData()  // Promise 被拒绝但没有处理 → unhandledrejection 事件
```

`unhandledrejection` 是一个独立事件，不是 `error` 事件，需要单独监听。这将在第 07 章实现，可以扩展现有的 error 插件（增加一个 `promise` 选项），也可以作为独立插件——第 07 章会讨论这两种方案。

### Vue3 / React 框架错误

```typescript
// Vue3：在 setup() 里的错误，Vue 会拦截，不一定传到 window
// React：渲染错误，只有 ErrorBoundary 能捕获，window.addEventListener 捕获不到
```

框架层错误需要接入框架自己的错误钩子（`app.config.errorHandler` / `ErrorBoundary`），这是 `@monitor/vue` 和 `@monitor/react` 包的职责，将在第 07 章实现。

### 新增的 ErrorPayload 子类型

到第 07 章，`types.ts` 里的联合类型会扩展为：

```typescript
export type ErrorPayload =
  | JsErrorPayload          // 已实现（本章）
  | ResourceErrorPayload    // 已实现（本章）
  | PromiseErrorPayload     // 第 07 章
  | FrameworkErrorPayload   // 第 07 章
```

因为我们用的是判别联合类型，添加新的子类型不需要修改已有的接口和插件——只是在联合类型里追加一项，符合开放-封闭原则。

---

## 6.12 本章小结

### 本章新增的代码结构

```
packages/
├── core/src/
│   ├── types.ts  ← 新增：JsErrorPayload / ResourceErrorPayload / ErrorPayload
│   └── index.ts  ← 新增导出：JsErrorPayload / ResourceErrorPayload / ErrorPayload
└── browser/src/
    ├── index.ts           ← 新增重导出：createErrorPlugin / ErrorPluginOptions
    │                         新增重导出：JsErrorPayload / ResourceErrorPayload / ErrorPayload
    └── plugins/
        └── error.ts       ← 新增：createErrorPlugin 工厂函数（本章核心）

demos/
├── vue3-demo/src/
│   ├── main.ts   ← 更新：plugins 数组加入 createErrorPlugin()
│   └── App.vue   ← 更新：新增无痕采集演示按钮 + 手动埋点按钮
└── react-demo/src/
    ├── main.tsx  ← 更新：plugins 数组加入 createErrorPlugin()
    └── App.tsx   ← 更新：新增无痕采集演示按钮 + 手动埋点按钮
```

### 设计决策对照表

| 决策 | 问题来源 | 解决思路 |
|---|---|---|
| 用 `addEventListener` 而非 `window.onerror` | `onerror` 只能有一个且抓不到资源错误 | `addEventListener` 可多次注册、精确移除、支持捕获阶段 |
| 第三个参数 `true`（捕获阶段） | 资源 error 事件不冒泡，冒泡阶段监听不到 | 捕获阶段在 window 级别截获所有 error 事件 |
| `e.target instanceof HTMLElement` 区分错误类型 | 同一个监听器同时收到两种事件 | 资源错误的 target 是 HTML 元素，JS 错误的 target 是 window |
| Set 白名单过滤资源标签 | 第三方库可能在 div 上 dispatch 自定义 error | 只监控真正的资源加载标签，过滤噪音 |
| 工厂函数 `createErrorPlugin()` | 插件状态（errorHandler 引用）不能共享 | 每次调用返回独立闭包，状态隔离 |
| 保存 errorHandler 引用 | removeEventListener 需要相同引用 | 在闭包外部变量保存，teardown 时精确移除 |
| 判别联合类型 `ErrorPayload` | 多种错误子类型需要类型安全的多态 | subType 字段作为判别符，TypeScript 自动缩窄 |
| `satisfies` 代替 `as` | `as` 绕过编译检查可能引入运行时错误 | `satisfies` 真正验证类型，更安全 |
| ErrorPayload 联合类型预留扩展 | 后续章节要添加 Promise/框架错误 | 追加联合成员，不修改已有接口（开放-封闭原则） |
| 插件放 browser 包，类型放 core 包 | core 不能依赖浏览器 API | 浏览器 API 调用只在 browser 包，类型定义在 core 包 |
| browser/index.ts 重导出 core 类型 | 用户不应该感知内部包结构 | Facade 模式：公开 API 层统一导出，隐藏实现细节 |
