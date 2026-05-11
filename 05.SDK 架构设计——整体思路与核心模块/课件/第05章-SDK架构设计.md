# 第 05 章：SDK 架构设计——整体思路与核心模块

## 开篇：为什么架构比实现更重要

很多同学接到"做前端监控"的需求，第一反应是：我知道怎么做——监听 `window.onerror`，然后 `fetch` 发数据，半小时搞定。

这个判断没有错，但只对了一半。**"能跑起来"和"能用于生产"之间，差着一套架构**。

试想一下，你把这段代码交付了，三个月后：

- 产品经理说，新增性能监控——你找不到统一的地方加，每个项目都要改
- 测试环境想关掉上报——你只能注释代码，万一忘了打开呢？
- 线上日志一天 2000 万条，数据库扛不住——你发现采样逻辑散落在五个文件里
- 换了新项目要做监控——你只能复制粘贴旧代码，然后改半天
- 看了半天日志，发现不知道这几条错误是不是同一个用户同一次操作触发的

这些问题都是真实发生的。我们要学的不是"怎么写一段监控代码"，而是**"如何设计一个可以持续演化、多项目复用的监控 SDK"**。

这一讲，我们来把这套架构的来龙去脉讲清楚——不只是"它长什么样"，更要讲"它为什么要长成这个样子"。

---

## 本章目标

- 理解前端监控 SDK 的设计矛盾，以及分层架构如何解决这些矛盾
- 读懂 `packages/core/src/types.ts` 里每一个类型存在的理由
- 理解 Monitor 为什么是一个类，以及类里每个属性和方法的职责边界
- 理解 Plugin 机制如何让 SDK 在不修改核心代码的前提下持续扩展
- 跑通完整的 `init → capture → flush` 数据管道，在控制台看到真实输出

---

## 5.1 从真实问题出发

### "直接写"的样子

```js
window.onerror = (msg, source, lineno, colno, error) => {
  fetch('/collect', {
    method: 'POST',
    body: JSON.stringify({ type: 'error', msg, stack: error?.stack }),
  })
}
```

这段代码能工作，但它存在一系列**在规模变大后才会暴露的问题**：

| 问题场景 | 为什么会发生 |
|---|---|
| 新增性能监控 | 没有统一的"数据入口"，要到处找地方加 |
| 测试环境禁用上报 | 没有环境控制机制，只能注释代码 |
| 换项目复用 | 监控逻辑和业务代码耦合，无法作为独立模块引入 |
| 高流量下降成本 | 没有采样机制，只能全量上报 |
| 排查某个用户的问题 | 每条日志互相独立，不知道这几条错误是否同一次会话发生的 |
| 第三方插件接入 | 没有扩展点，外部代码只能侵入核心逻辑 |

这些问题的本质是：**这段代码承担了太多职责，又没有对外提供任何扩展边界**。

### 我们要解决的核心矛盾

前端监控 SDK 要同时满足几个看起来矛盾的需求：

1. **核心稳定 vs 功能持续增长**：功能会越来越多（错误/性能/行为/API），但核心逻辑不能每次都被改动（改核心 = 引入风险）
2. **全量采集 vs 成本可控**：理想是采集所有数据，但高流量下必须采样
3. **多项目复用 vs 差异化配置**：同一套 SDK 接入几十个项目，但每个项目的 appId、采样率、插件配置都不同
4. **功能齐全 vs 按需引入**：不用 Vue 的项目不应该安装 Vue 适配层

解决这些矛盾的答案就是：**分层架构 + 插件机制**。

---

## 5.2 分层设计：每层只做一件事

### 参考 Sentry 的思路

Sentry 是目前最主流的前端监控 SDK，我们来看它是怎么拆层的：

```
Sentry SDK 分层
┌─────────────────────────────────────────┐
│  Integration（集成层）                   │  ← 各类采集能力：BrowserTracing、Replay...
├─────────────────────────────────────────┤
│  Client（客户端层）                      │  ← 数据处理：采样、格式化、Scope 管理
├─────────────────────────────────────────┤
│  Hub（中枢层）                           │  ← 单例管理、上下文（Scope）维护
├─────────────────────────────────────────┤
│  Transport（传输层）                     │  ← HTTP 上报、重试、批量发送
└─────────────────────────────────────────┘
```

> 📖 **术语框：Integration（集成）**  
> 直白说：Sentry 里的"插件"。每个 Integration 封装一类采集能力，可以按需开启或关闭。  
> 技术表述：实现了统一接口的功能模块，通过注册机制挂载到核心 SDK，不修改核心代码就能扩展功能——这就是"开放-封闭原则"。

Sentry 的分层来自一个很朴素的思考：**每一层只对上层负责，不关心下层的实现细节**。Integration 只管"检测到什么"，不管"数据怎么发"；Transport 只管"怎么发"，不管"采集的是什么"。职责越专一，这一层就越容易独立测试、独立替换。

### 我们的分层

我们不需要照搬 Sentry 的全部复杂度（那是支撑数十种语言、千万量级用户的商业产品），但分层的核心思想完全适用：

```
我们的 SDK 分层（从上到下，职责越来越底层）

┌────────────────────────────────────────────────────────────┐
│  框架适配层  @monitor/vue  @monitor/react                   │
│  捕获框架特有错误（Vue errorHandler / React ErrorBoundary）  │
├────────────────────────────────────────────────────────────┤
│  采集插件层  各类 Plugin                                     │
│  监听浏览器事件，调用 monitor.capture() 上报                 │
├────────────────────────────────────────────────────────────┤
│  浏览器入口层  @monitor/browser                              │
│  维护全局单例，暴露 init() / capture() / use() 给用户        │
├────────────────────────────────────────────────────────────┤
│  核心层  @monitor/core                                       │
│  数据管道（采样→规范化→队列→上报），插件注册管理             │
│  不绑定浏览器环境，纯逻辑，可以在 Node.js 里跑              │
├────────────────────────────────────────────────────────────┤
│  工具函数层  @monitor/browser-utils                          │
│  UUID 生成、设备信息采集等无副作用工具函数                   │
├────────────────────────────────────────────────────────────┤
│  传输层（待实现）                                            │
│  fetch POST / sendBeacon / 重试 / 批量打包                  │
└────────────────────────────────────────────────────────────┘
```

**依赖方向是单向的**（这很关键）：

```
框架适配层 → 浏览器入口层 → 核心层
                              ↑
                         工具函数层（也不依赖核心层）
```

`core` 不依赖任何其他内部包，`browser-utils` 也不依赖任何内部包。所有依赖的"箭头"都从外层指向内层，没有循环依赖。

> 🏗️ **架构思考：为什么不把所有代码放一个包？**
>
> 放一个包更简单，但会有这些代价：
>
> **按需引入**：只用 Vue 的项目不需要安装 `@monitor/react`。包越小，打包体积越小。
>
> **独立迭代**：`@monitor/core` 修复了一个 bug，只需要发布 core 包，不需要同时升级所有包的版本。
>
> **测试隔离**：`core` 包在 Node.js 里就能跑单元测试，不需要浏览器环境（jsdom），测试速度快。
>
> **边界强制执行**：分包之后，如果 `core` 错误地引用了浏览器 API，TypeScript 和构建工具会立刻发现。放一个包的话，这种错误很难被察觉。

---

## 5.3 types.ts：SDK 的"契约文档"

文件路径：`packages/core/src/types.ts`

### 为什么把类型单独放一个文件？

你可能会问：类型不应该和用它的代码放在一起吗？比如 `monitor.ts` 里直接 `interface MonitorEvent { ... }`？

在小项目里这没问题。但我们有多个包（`core`、`browser`、`browser-utils`、`vue`、`react`），它们都需要用 `MonitorEvent`、`Plugin`、`EventType` 这些类型。如果类型定义在 `monitor.ts` 里，其他包要引用这些类型，就必须从 `monitor.ts` 导入——而 `monitor.ts` 是**实现文件**，里面有类和运行时逻辑，引入它会触发副作用。

把类型单独放 `types.ts`，所有包只需要 `import type { ... } from '@monitor/core'`，引入的是零运行时成本的纯类型。

> 📖 **术语框：`import type`（TypeScript 特性）**  
> 直白说：只在编译阶段用，运行时完全消失，不会增加 JS bundle 体积。  
> 作用：明确声明"我只需要这个类型的形状，不需要它的运行时实现"，构建工具可以更安全地做 tree-shaking。

### 每个类型存在的理由

#### EventType：为什么不用数字或者随意字符串？

```typescript
export type EventType = 'error' | 'performance' | 'behavior' | 'api'
```

**为什么不用数字（0/1/2/3）？** 数字没有语义，`type: 2` 是什么意思？看代码的人要对着文档查，很容易出错，而且后端数据库里全是数字，没有人能一眼看懂日志。

**为什么不允许任意字符串？** 一个插件叫 `error`，另一个手滑写了 `errors`，后端存进去两种数据，查询时还得兼容两种写法，维护成本翻倍。

**联合类型的好处**：TypeScript 会在编译时检查，写错了直接报错，不会等到运行时才发现。后端数据库建表时也可以直接按这四个值分区，查询效率更高。

这四个值来自"前端监控能采集什么"的分类——错误、性能、用户行为、接口请求，基本覆盖了所有需要关注的维度。

#### MonitorOptions 与 ResolvedOptions：为什么要两个"配置"类型？

```typescript
// 用户传进来的：所有可选项都可以不填
export interface MonitorOptions {
  dsn: string            // 必填
  appId: string          // 必填
  userId?: string        // 可选
  sampleRate?: number    // 可选（有默认值 1）
  plugins?: Plugin[]     // 可选（有默认值 []）
  debug?: boolean        // 可选（有默认值 false）
  maxQueueSize?: number  // 可选（有默认值 20）
}

// SDK 内部使用的：所有字段都已确定，没有 undefined
export interface ResolvedOptions {
  dsn: string
  appId: string
  userId: string | undefined
  sampleRate: number     // 一定是数字，不是 number | undefined
  plugins: Plugin[]
  debug: boolean
  maxQueueSize: number
}
```

这个设计解决了一个很具体的问题：**Monitor 内部代码不应该反复判断 `if (this.options.sampleRate !== undefined)`**。

`MonitorOptions` 对用户友好，"你不需要填那么多字段"；`ResolvedOptions` 对内部友好，"我已经填好了所有默认值，你放心用"。两者之间的转换只在 `constructor` 里发生一次，之后整个 Monitor 生命周期都用 `ResolvedOptions`，内部代码干净很多。

#### MonitorEvent：一条数据是什么样的？

```typescript
export interface MonitorEvent {
  traceId: string    // 会话 ID
  appId: string      // 哪个项目
  userId?: string    // 哪个用户（可选）
  type: EventType    // 什么类型的事件
  payload: unknown   // 具体内容（每类事件不同）
  timestamp: number  // 什么时候发生的（毫秒时间戳）
  page: string       // 在哪个页面发生的（URL）
  ua: string         // 用什么浏览器（User-Agent）
}
```

设计这个结构的思路：**后端收到这条数据，不需要再问任何问题就能定位问题**。

- `traceId`：用户 A 在一次访问中触发了 5 条错误，这 5 条数据的 traceId 相同，后端可以把它们关联起来，还原出"用户操作的时间线"
- `appId`：同一套监控后端可以接多个前端项目，通过 appId 区分
- `userId`：可以直接定位到"是哪个用户遇到了这个问题"
- `payload: unknown`：为什么不用具体类型？因为不同事件的内容完全不同——错误事件有 `stack`，性能事件有 `FCP`、`LCP`，行为事件有 `action`。用 `unknown` 保留了灵活性，各插件自定义内部结构

> 📖 **术语框：traceId（追踪 ID）**  
> 直白说：每次用户打开页面，SDK 生成一个随机字符串，这次访问里发生的所有事件都带着这个字符串。后端可以把同一次访问的所有事件串起来。  
> 技术表述：会话级别的唯一标识符（Session ID）。类似于 HTTP 请求里的 `X-Request-ID`，用于事件关联和会话追踪。

#### Plugin：为什么要定义一个接口，而不是直接传函数？

如果我们不做 Plugin 接口，可能这样写：

```typescript
// ❌ 没有 Plugin 接口
init({
  dsn: '...',
  onError: (monitor) => { ... },
  onPerformance: (monitor) => { ... },
  onBehavior: (monitor) => { ... },
})
```

这样有什么问题？**每加一类采集，就要给 `MonitorOptions` 新增一个字段**——SDK 核心配置越来越胖，而且每个项目都要把这些配置全部列出来，哪怕根本不需要某类采集。

Plugin 接口把"扩展能力"和"核心配置"彻底分离：

```typescript
// ✅ Plugin 接口
export interface Plugin {
  name: string                          // 唯一名称（防重复注册）
  setup(monitor: MonitorInstance): void  // 初始化：绑定监听、注册观察者
  teardown?(): void                     // 销毁（可选）：清理事件监听
}

// init() 时：需要什么加什么，不需要就不加
init({
  dsn: '...',
  plugins: [errorPlugin, performancePlugin],
})
```

`name` 字段的作用：防止同一个插件被注册两次（比如用户在 `init()` 里传了，又调了 `use()` 重复注册）。

`teardown` 是可选的：不是所有插件都需要清理资源——只有那些添加了全局监听的插件（比如 `window.onerror`）才需要在 `destroy()` 时移除监听，其他插件可以不实现它。

#### MonitorInstance：插件为什么看不到完整的 Monitor？

```typescript
export interface MonitorInstance {
  readonly options: Readonly<ResolvedOptions>  // 只读配置
  capture(type: EventType, payload: unknown): void
}
```

`Monitor` 类有很多私有状态：内部队列 `queue`、已注册插件列表 `plugins`、`_flush()` 方法……插件需要这些吗？

不需要。插件只需要两件事：读取配置（判断 `debug` 是否开启）和上报数据（调用 `capture()`）。

如果把整个 `Monitor` 实例传给插件，插件可以直接操作队列、调用私有方法——任何一个插件的 bug 都可能破坏整个 SDK 的状态。

> 🏗️ **架构思考：最小权限原则（Principle of Least Privilege）**  
> 每个模块只应获得完成其职责所必需的最小权限。插件的职责是"检测事件并上报"，它不需要知道队列怎么管理，不需要知道其他插件是什么——所以就不给它这些权限。  
> 这不只是理论，它防止了一类真实 bug：如果允许插件直接 `monitor.queue = []`，某个有 bug 的第三方插件可能会把队列清空，导致数据丢失。用接口限制之后，TypeScript 编译时就会拦截这种操作。

---

## 5.4 Monitor 核心类：为什么是一个类？

文件路径：`packages/core/src/monitor.ts`

### 先回答"为什么是类，不是函数？"

我们完全可以写成函数式：

```typescript
// 函数式的写法
function createMonitor(options: MonitorOptions) {
  let queue: MonitorEvent[] = []
  const traceId = generateSessionId()
  const plugins: Plugin[] = []
  let initialized = false
  // ...
  return { capture, init, destroy }
}
```

这也能工作。那为什么用 `class`？

**原因 1 — 状态管理**：Monitor 需要维护多个内部状态（队列、traceId、插件列表、initialized 标志）。函数式写法用闭包也能做，但当状态变多时，闭包越套越深，可读性变差。`class` 的属性声明让这些状态一目了然，每个属性的类型和修饰符（`readonly`、`private`）也在第一眼就能看清楚。

**原因 2 — 接口契约**：我们有 `MonitorInstance` 接口，`class` 的 `implements` 关键字让 TypeScript 自动验证 Monitor 类是否完整实现了这个接口——少实现一个方法就会报错。

**原因 3 — `this` 的清晰绑定**：类方法访问 `this.options`、`this.queue` 的语义很清晰。函数式写法里，如果某个返回的函数被赋值给另一个变量再调用，`this` 的丢失问题需要额外注意。

**原因 4 — 扩展语义**：将来如果需要 `class NodeMonitor extends Monitor` 来扩展服务端版本，类的继承语义比函数工厂更自然。

### Monitor 的每个属性，存在的理由

```typescript
export class Monitor implements MonitorInstance {
  readonly options: Readonly<ResolvedOptions>
  private readonly traceId: string
  private readonly plugins: Plugin[] = []
  private queue: MonitorEvent[] = []
  private initialized = false
```

**`options` — 为什么是 `readonly` 且 `Readonly<>`？**

`readonly options` 表示属性引用本身不能被重新赋值（不能 `this.options = anotherObject`）。`Readonly<ResolvedOptions>` 表示对象的每个字段也不能被修改（不能 `this.options.debug = true`）。

两层只读的原因：配置一旦确定，就不应该在运行时被改变。如果允许修改，插件 A 把 `debug` 改成 `false`，插件 B 还在期望 `debug` 是 `true`，这类隐性状态变化会导致很难排查的 bug。**不可变性（Immutability）是防御性编程的基础**。

**`traceId` — 为什么是 `private readonly`？**

`private` 意味着外部（包括插件）无法读取 traceId。它由 Monitor 在构造时生成，在每条 `MonitorEvent` 里自动填入，插件不需要也不应该自己操作它。

`readonly` 意味着整个会话里 traceId 不会变——一次 `init()` 到 `destroy()` 对应一个 traceId，后端才能用它关联同一次访问的所有事件。

**`plugins` — 为什么是 `readonly`（引用只读）但内容可变？**

`private readonly plugins: Plugin[]` 说的是"这个属性永远指向同一个数组对象"，但数组里的元素可以 push/pop。这是有意为之的：我们不希望 `this.plugins = anotherArray`（换一个全新数组，可能丢失已注册插件），但我们确实需要 `this.plugins.push(plugin)`（新增插件）。

**`queue` — 为什么没有 `readonly`？**

因为 HTTP 上报实现后，`_flush()` 成功后会 `this.queue = []`（清空队列，换一个新数组）。这里需要重新赋值，所以不能 `readonly`。

**`initialized` — 为什么需要这个标志？**

防止 `init()` 被调用两次。如果没有这个标志，所有插件会被 `setup()` 两次，`window.onerror` 被监听两次，同一条错误就会上报两遍，数据统计失真。

### constructor：合并配置的细节

```typescript
const DEFAULT_OPTIONS = {
  userId: undefined,
  sampleRate: 1,
  plugins: [] as Plugin[],
  debug: false,
  maxQueueSize: 20,
} satisfies Omit<ResolvedOptions, 'dsn' | 'appId'>

constructor(options: MonitorOptions) {
  this.options = Object.freeze({
    ...DEFAULT_OPTIONS,
    ...options,
    plugins: options.plugins ?? [],  // 特殊处理
  })
  this.traceId = generateSessionId()
}
```

**为什么 `plugins` 要单独处理，不能直接 `...options` 覆盖？**

`DEFAULT_OPTIONS.plugins` 是 `[]`，如果用户没传 `plugins`，`options.plugins` 是 `undefined`。展开 `...options` 时，`undefined` 会把 `DEFAULT_OPTIONS.plugins` 的 `[]` 覆盖成 `undefined`——这不是我们想要的。所以用 `options.plugins ?? []` 明确处理这个边界情况。

> 📖 **术语框：`satisfies` 运算符（TypeScript 4.9+）**  
> 直白说：让 TypeScript 检查"这个对象的字段类型符合某个接口"，但不把对象类型强制推导成那个接口类型。  
> 和 `as` 的区别：`as SomeType` 是强制类型断言，骗过编译器；`satisfies SomeType` 是真正的类型检查，类型不符会报错。  
> 这里的作用：如果有人在 `DEFAULT_OPTIONS` 里写了类型错误的字段（比如 `sampleRate: '1'`），TypeScript 会立即报错，而不是等到运行时才发现采样率不生效。

> 📖 **术语框：`Object.freeze()`**  
> 直白说：冻结一个对象，让它的属性变成只读。  
> 为什么要用它：`readonly` 是 TypeScript 编译期的检查，TypeScript 编译成 JS 后类型信息丢失，运行时是可以修改的。`Object.freeze()` 是**运行时**的保护，真正杜绝了任何代码在运行期间修改配置。

### init()：为什么不在 constructor 里启动插件？

```typescript
init(): void {
  if (this.initialized) return
  this.initialized = true

  for (const plugin of this.options.plugins) {
    this._registerPlugin(plugin)
  }
}
```

这是**"构造 vs 初始化分离"**的经典模式，有两个原因：

**原因 1 — 时序安全**

```typescript
// 假设 constructor 里直接 setup()
const monitor = new Monitor({
  plugins: [{
    name: 'async-plugin',
    setup(m) {
      setTimeout(() => {
        // 这里的 monitor 变量，在 constructor 返回之前还没被赋值！
        // 极短的 setTimeout（如 0ms）可能在 monitor 赋值之前就执行
        console.log(monitor)  // 可能是 undefined
      }, 0)
    }
  }]
})
// ← monitor 变量在这里才被赋值
```

把 `init()` 分开，让外部代码明确控制"什么时候激活"，外部变量赋值完成后再调 `init()`，时序问题不复存在。

**原因 2 — 灵活性**

框架适配层在安装时可能需要先做准备工作（比如等 Vue 的 `app` 实例创建好），再注册某些插件。分离 `init()`，让调用方能精确控制激活时机：

```typescript
// @monitor/browser 里的实现
export function init(options: MonitorOptions): Monitor {
  _monitor = new Monitor(options)  // 构造：配置已就绪，但插件还没激活
  _monitor.init()                  // 激活：插件开始工作，开始采集
  return _monitor
}
```

### 数据管道：capture() 是整个 SDK 最核心的方法

**所有采集数据，无论来自哪个插件，都必须经过这里**。它是整个数据流的"总闸门"。

```
Plugin 调用 monitor.capture('error', { message: '...', stack: '...' })
    ↓
[1] 采样过滤
    Math.random() > sampleRate → 丢弃（不上报）
    ↓
[2] 规范化
    封装为 MonitorEvent（自动填 traceId / appId / timestamp / page / ua）
    ↓
[3] 写入队列
    queue.push(event)
    超出 maxQueueSize → queue.shift()（丢弃最旧的）
    ↓
[4] flush
    触发上报（debug 模式：打印日志；接入 HTTP 上报后：发送到 DSN 服务）
```

**[1] 为什么在客户端丢弃，而不是全量发到服务端再过滤？**

服务端过滤也能实现采样，但代价是所有数据都要经过网络传输。假设 DAU 100 万，每个用户产生 100 条事件，即使服务端最终只存 10%，也要处理 1 亿次 HTTP 请求。

客户端以 90% 的概率直接 `return`，1 亿次请求变成 1000 万次，带宽成本直接降低 90%。

**[2] 为什么在 capture() 里统一填 timestamp 和 page，而不是让插件自己填？**

如果让插件自己填，每个插件都要写 `timestamp: Date.now(), page: location.href`——重复代码。更重要的是，如果某个插件忘了填 `traceId`，后端就无法关联事件。**集中在 `capture()` 里统一处理，保证了数据完整性，不依赖插件开发者的自觉性**。

**[3] 为什么要有 `maxQueueSize`？**

极端场景：HTTP 请求因为网络问题持续失败，数据不断积累在 `queue` 里。如果没有上限，`queue` 会无限增长，最终导致内存溢出（OOM）。设置上限后，超出时丢弃最旧的数据，保护内存安全，同时保留最新的数据（最新的数据往往更有排查价值）。

**[4] 为什么不直接发 HTTP，而是先进队列？**

用户一秒内点击了 10 次，就会触发 10 次 `capture()`。如果每次直接发 HTTP，就是 10 个并发请求，浪费带宽，也给服务端增加无谓的压力。

更关键的问题：用户关闭页面时，普通的 `fetch` 会被浏览器直接取消，最后那批数据就丢了。`navigator.sendBeacon()` 是浏览器专门为"页面卸载时发数据"设计的 API，调用后浏览器会保证把数据发出去再关闭页面。队列机制为后续接入 `sendBeacon` 打好了基础。

### destroy()：为什么 SDK 需要销毁逻辑？

```typescript
destroy(): void {
  for (const plugin of this.plugins) {
    plugin.teardown?.()
  }
  this.plugins.length = 0
  this.queue = []
}
```

**场景 1 — SPA 切换账号/项目**：某些平台型应用，用户可以在同一个 SPA 里切换不同项目。切换时，旧项目的监控实例应该被销毁（清理监听、清空队列），新项目用新的 `appId` 重新初始化。

**场景 2 — 防止内存泄漏**：错误采集插件会监听 `window.onerror`，如果 SDK 被"销毁"了但监听没清理，监听器还在内存里，这就是内存泄漏。`teardown()` 让每个插件有机会清理自己的资源。

**`plugin.teardown?.()`——为什么加 `?.`？**

`teardown` 在 `Plugin` 接口里是可选的（`teardown?(): void`）。`?.` 是可选链操作符——"如果这个方法存在就调用，不存在就跳过"，避免 `TypeError: plugin.teardown is not a function`。

---

## 5.5 browser-utils：工具函数为什么要独立成包？

文件路径：`packages/browser-utils/src/`

这里有两个工具：UUID 生成 和 设备信息采集。完全可以放进 `browser` 包里，那为什么单独成包？

**理由 1 — 职责边界**：`browser-utils` 是"无状态的纯函数工具箱"，不依赖任何内部包，不初始化任何全局状态，引入它没有副作用。这种特性值得用包边界来保护——一旦放进 `browser` 包，有人可能无意中引入了有副作用的代码，就破坏了这个"纯"的特性。

**理由 2 — 复用性**：假设将来要做 Node.js 端的 SDK（监控 SSR 错误），UUID 生成是通用的，可以直接用 `@monitor/browser-utils` 的 `generateUUID`，不需要重复实现。

**为什么不放进 `core`？** `core` 的设计目标是"不绑定浏览器环境"，而 `getDeviceInfo()` 里直接调用了 `navigator.userAgent`、`screen.width`——这些是浏览器专有 API。放进 `core` 就破坏了 `core` 的跨环境设计。

### generateUUID：为什么要处理两种情况？

```typescript
export function generateUUID(): string {
  // 优先使用浏览器原生 API：密码学安全的随机数
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 降级到 Math.random()：兼容老浏览器
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
```

`crypto.randomUUID()` 是 Web Crypto API，使用密码学安全的随机数（CSPRNG），现代浏览器（Chrome 92+、Safari 15.4+、Firefox 95+）都支持。

`Math.random()` 的降级方案用于兼容老浏览器。它的随机性不如 `crypto`，但对于生成 traceId 来说足够用——我们不需要密码学安全，只需要"在一个用户的一次访问里不重复"。

`typeof crypto !== 'undefined'` 的检查是为了让这段代码在 Node.js 里也能安全运行，不会因为全局变量不存在而抛错。

> 📖 **术语框：UUID v4**  
> 直白说：一个格式固定（`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`）的随机字符串，全球范围内重复概率极低。  
> 技术表述：Universally Unique Identifier 第 4 版，128 位随机数，约有 $5.3 \times 10^{36}$ 种可能值。  
> 用途：生成 `traceId`，确保不同用户、不同页面的会话 ID 不会碰撞。

### getDeviceInfo：为什么采集这四个字段？

```typescript
export interface DeviceInfo {
  ua: string        // User-Agent：浏览器型号和版本
  screen: string    // 屏幕分辨率：'1920x1080'
  language: string  // 浏览器语言：'zh-CN'
  online: boolean   // 是否在线
}
```

这四个字段来自真实的排查需求：

- **ua**：某个错误只在 Safari 上复现？`ua` 帮你过滤。某个性能问题只在低版本 Chrome 上？`ua` 告诉你是哪个版本。
- **screen**：某个布局 bug 只在小屏幕上出现？`screen` 帮你复现。
- **language**：国际化 bug 只在特定语言用户身上出现？`language` 帮你缩小范围。
- **online**：是用户网络断了导致的请求失败，还是代码 bug？`online` 是第一个判断依据。

---

## 5.6 browser 入口包：为什么要这一层？

文件路径：`packages/browser/src/index.ts`

`@monitor/browser` 是用户直接 `import` 的包。它只做一件事：**把 Monitor 的复杂性藏起来，暴露一组简单的函数**。

### 单例：为什么全局只能有一个 Monitor 实例？

```typescript
let _monitor: Monitor | null = null
```

**traceId 的连续性**：`traceId` 代表"本次页面访问"。如果允许多个 Monitor 实例，就会有多个 traceId，同一次会话的事件被分散到多个"会话"里，后端无法关联。

**插件只能注册一次**：如果允许两个 Monitor 实例，每个都注册了错误采集插件，`window.onerror` 被监听两次，一条错误发出两条上报——数据重复，统计失真。

**防重复的实现**：

```typescript
export function init(options: MonitorOptions): Monitor {
  if (_monitor) {
    // 已经初始化过了，静默返回，同时发出警告（不抛错，不让应用崩溃）
    if (options.debug) {
      console.warn('[Monitor] SDK is already initialized. Duplicate init() call ignored.')
    }
    return _monitor
  }
  _monitor = new Monitor(options)
  _monitor.init()
  return _monitor
}
```

用 `console.warn` 而不是 `throw Error`：重复初始化通常是用户失误，不应该让应用崩溃——静默忽略 + 警告，用户能发现问题，同时不影响应用运行。

### 为什么要导出 `getMonitor()`？

```typescript
export function getMonitor(): Monitor | null {
  return _monitor
}
```

业务代码一般不需要这个函数，但**框架适配层**（`@monitor/vue`、`@monitor/react`）需要它：

```typescript
// @monitor/vue 内部（后续实现）
import { getMonitor } from '@monitor/browser'

export const MonitorVue = {
  install(app) {
    app.config.errorHandler = (error, vm, info) => {
      getMonitor()?.capture('error', { message: error.message, stack: error.stack, info })
    }
  }
}
```

适配层不自己管理 Monitor 实例，通过 `getMonitor()` 获取用户已初始化好的单例，这样不管用户是在 `main.ts` 里调的 `init()`，还是在别处，适配层都能拿到同一个实例。

### 为什么把类型重导出？

```typescript
export type { MonitorOptions, Plugin, EventType } from '@monitor/core'
```

用户引入 `@monitor/browser` 时，TypeScript 需要知道 `MonitorOptions` 的类型才能给 `init()` 提示参数。如果不重导出，用户还要额外安装并引入 `@monitor/core`——而 `@monitor/core` 是内部实现包，让用户感知它的存在是"抽象泄露"（你的内部设计不小心暴露给了外部用户）。

重导出之后：

```typescript
// 用户只需要从 @monitor/browser 导入所有东西，不需要感知内部包结构
import { init, capture } from '@monitor/browser'
import type { MonitorOptions } from '@monitor/browser'
```

> 📖 **术语框：Facade 模式（门面模式）**  
> 直白说：把复杂的系统用一个简单的接口包裹起来，调用方只和这个简单接口打交道。  
> 这里的 `@monitor/browser` 就是门面：用户不需要知道 Monitor 类、Plugin 注册机制、事件队列……只需要调 `init()` 和 `capture()` 两个函数。

---

## 5.7 在 Demo 里验证数据管道

### 启动步骤

```bash
cd '05.SDK 架构设计——整体思路与核心模块/代码/monitor'

# 先构建所有 SDK 包
pnpm build

# 启动 Vue demo
pnpm --filter @monitor/vue3-demo dev

# 或启动 React demo
pnpm --filter @monitor/react-demo dev
```

### 查看初始化日志

打开浏览器 → F12 → Console，应该看到：

```
[Monitor] initialized | appId=vue3-demo | traceId=xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx | plugins=none
```

`plugins=none` 说明现在还没有任何采集插件接入——数据管道的骨架已经建好，等后续把插件一个个接进来，这里会显示各插件的名称。

### 点击按钮验证数据流

点击"模拟行为事件"按钮后，控制台应该出现：

```
[Monitor] capture | type=behavior {
  traceId: 'a1b2c3d4-...',
  appId: 'vue3-demo',
  type: 'behavior',
  payload: { action: 'click', target: '...', page: 'http://localhost:5173/' },
  timestamp: 1746748800000,
  page: 'http://localhost:5173/',
  ua: 'Mozilla/5.0 ...'
}

[Monitor] flush | 1 event(s) pending upload to http://localhost:3001/collect [...]
```

逐项对照验证：

| 验证项 | 期望结果 | 意义 |
|---|---|---|
| `traceId` | 每次点击相同，刷新后改变 | 单次会话内共享同一个 ID |
| `appId` | `vue3-demo` | 来自 `init()` 配置，自动填入 |
| `timestamp` | 毫秒级数字 | `capture()` 里统一写，插件无需填 |
| `page` | 当前 URL | `capture()` 里统一写，插件无需填 |
| `flush` 里的 URL | `http://localhost:3001/collect` | 来自 `init()` 的 `dsn` 配置 |

### 完整数据流

```
用户点击按钮
    ↓
App.vue: capture('behavior', { action: 'click', ... })
    ↓
@monitor/browser: capture() → _monitor?.capture(type, payload)
    ↓
Monitor.capture():
    ├── 通过采样（sampleRate: 1，全量采集）
    ├── 封装为 MonitorEvent（自动填 traceId / timestamp / page / ua）
    ├── queue.push(event)
    └── _flush()
    ↓
Monitor._flush():
    └── debug 模式：打印 flush 日志（数据还在队列里，未真正上报）
        （HTTP 上报接入后：fetch POST → DSN 服务 → 数据库存储）
```

---

## 5.8 本章小结

### 设计决策回顾

| 决策 | 问题来源 | 解决思路 |
|---|---|---|
| **分层架构 + 多包** | 功能扩展时核心代码频繁被改动 | 每层只对上层负责，单向依赖，扩展不改核心 |
| **Plugin 接口** | 采集能力增多后配置越来越胖 | 扩展点与核心配置分离，按需注册 |
| **types.ts 独立文件** | 多包共享类型，引入实现文件有副作用 | 纯类型文件，`import type` 零运行时成本 |
| **MonitorOptions + ResolvedOptions** | 内部代码频繁判断 `!== undefined` | 构造时一次性填充默认值，之后放心用 |
| **MonitorEvent 统一结构** | 后端要兼容多种数据格式 | `capture()` 规范化层统一封装 |
| **Monitor 是类** | 多状态管理 + 接口契约 + 生命周期 | class + implements 清晰表达意图 |
| **init() 与 constructor 分离** | 插件 setup 可能有时序问题 | 让调用方显式控制激活时机 |
| **事件队列 + maxQueueSize** | 高频事件并发上报 + 网络失败积压 | 缓冲后批量上报，上限防止 OOM |
| **客户端采样** | 全量上报带宽成本高 | 上报前随机丢弃，比服务端过滤省带宽 |
| **MonitorInstance 接口限制插件** | 插件可能误操作内部状态 | 最小权限原则，只暴露必要能力 |
| **browser 包单例 + Facade** | 多实例 traceId 不一致 + API 复杂 | 全局唯一实例，简单函数 API 屏蔽内部复杂性 |
| **core 不绑定浏览器 API** | SSR 场景 Node.js 里没有 window | 运行时保护，保留跨环境复用能力 |

### 文件结构总览

```
packages/
├── core/src/
│   ├── types.ts      ← 所有类型定义（多包共享的"契约文档"）
│   ├── monitor.ts    ← Monitor 核心类（数据管道大脑）
│   └── index.ts      ← 统一导出
├── browser-utils/src/
│   ├── uuid.ts       ← generateUUID（traceId 生成）
│   ├── device.ts     ← getDeviceInfo（设备信息快照）
│   └── index.ts      ← 统一导出
└── browser/src/
    └── index.ts      ← 单例管理 + 对外 API（init / capture / use / destroy / getMonitor）

demos/
├── vue3-demo/src/
│   ├── main.ts       ← init() 接入，debug 模式
│   └── App.vue       ← 三个测试按钮，验证数据管道
└── react-demo/src/
    ├── main.tsx      ← init() 接入，debug 模式
    └── App.tsx       ← 三个测试按钮，验证数据管道
```

### 下一步

架构骨架已经搭好，数据管道已经跑通。接下来要做的是：**逐一实现各类采集插件**，让这个骨架真正"活"起来——

- 错误采集：监听 `window.onerror` 和 `unhandledrejection`
- 性能采集：读取 `PerformanceObserver` 和 Navigation Timing
- 用户行为：监听点击、路由变化
- 接口监控：拦截 `XMLHttpRequest` 和 `fetch`

每个插件实现后，把它加进 `init()` 的 `plugins` 数组，就能在控制台看到对应类型的数据流转。
