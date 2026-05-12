# 第 09 章：SDK 采集——用户行为与埋点

> **本章要讲什么**
>
> 这一章解决一个核心问题：**我们的用户在做什么？**
>
> 前面两章（06-08 章）采集的是"出了什么问题"（错误）和"加载有多快"（性能）。
> 但仅靠这两类数据，当一个错误发生时，你并不知道用户在出错前做了什么操作——
> 是点了哪个按钮？跳转了哪个页面？还是某个特定操作序列触发的？
>
> 这一章实现**行为采集插件**，采集用户的操作轨迹：
> - 自动采集 PV（页面浏览）
> - 自动采集点击行为（事件委托）
> - 自动监听 SPA 路由跳转（劫持 history API）
> - 维护**行为栈（Breadcrumbs）**，为错误上报提供上下文
> - 暴露 `trackBehavior()` 实现手动代码埋点

---

## 课程元信息

```json
{
  "chapter": 9,
  "title": "SDK 采集——用户行为与埋点",
  "duration": "约 75 分钟",
  "skills": [
    "document.addEventListener('click') 事件委托",
    "history.pushState / replaceState 劫持（Monkey Patching）",
    "popstate 事件",
    "hashchange 事件",
    "Element.closest()",
    "Element.classList",
    "Element.getAttribute('aria-label')",
    "document.referrer",
    "location.href",
    "BehaviorPayload 判别联合类型（subType: 'pv' | 'click' | 'route-change' | 'custom'）",
    "Breadcrumbs（行为栈）固定长度队列",
    "trackBehavior() 手动埋点 API",
    "getBreadcrumbs() 行为栈快照",
    "createBehaviorPlugin()"
  ],
  "prerequisites": ["第 05-08 章 SDK 插件机制与采集体系"],
  "重点": ["history API 劫持原理与还原", "事件委托的过滤策略", "行为栈的设计动机"],
  "难点": ["history.pushState 不触发任何原生事件的问题", "teardown 还原劫持的正确写法"]
}
```

---

## 9.1 为什么要采集用户行为？

### 9.1.1 错误报告缺少"剧情"

假设你收到一条错误报告：

```
TypeError: Cannot read properties of null (reading 'price')
  at checkout (cart.js:42)
```

问题来了：这个错误**怎么触发的**？每次打开页面都会报吗？还是只有在某种操作序列之后才会出现？

光看错误堆栈，你不知道答案。你需要的是**上下文**——用户在出错前做了什么。

> 📖 **术语：Breadcrumbs（面包屑 / 行为栈）**
>
> 白话：就像森林里撒面包屑留下的痕迹，记录用户走过的路径。
> 术语：行为栈是一个固定长度的 FIFO 队列，存储最近 N 条用户行为，当错误发生时作为"操作路径"随错误一起上报，帮助复现问题。
>
> Sentry 也有这个概念，叫做 Breadcrumbs。它的价值在于：**让每条错误报告自带剧情**。

### 9.1.2 行为数据的三个维度

| 维度 | 采集方式 | 典型用途 |
|---|---|---|
| **被动采集** | 自动监听事件，零侵入代码 | 普适行为：页面访问、点击按钮、路由跳转 |
| **主动埋点** | 业务代码调用 trackBehavior() | 业务语义事件：下单、支付完成、视频播放 |
| **错误上下文** | 错误发生时附带 getBreadcrumbs() | 复现问题的操作路径 |

> 🏗️ **架构思考：被动采集 vs 主动埋点的边界在哪里？**
>
> - **被动采集**：所有应用通用的行为（点击、路由跳转、PV），框架无关，SDK 一次实现所有项目受益
> - **主动埋点**：有业务语义的事件，SDK 无法自动知道"用户完成了一次下单"，需要业务代码主动调用
>
> 两者缺一不可：纯被动采集无法表达业务语义；纯主动埋点维护成本极高（每个按钮都要写代码）。
>
> 本章的设计是：**自动采集打底，手动埋点补充语义**。

---

## 9.2 数据结构设计：BehaviorPayload 判别联合类型

与错误采集（第 06-07 章）的设计思路一致，我们用**判别联合类型**来区分四种行为类型：

```typescript
// packages/core/src/types.ts

/** PV（页面浏览）事件 */
interface PVPayload {
  subType: 'pv'
  page: string      // 当前页面 URL
  referrer: string  // 来源 URL（直接访问时为空字符串）
}

/** 点击行为事件 */
interface ClickPayload {
  subType: 'click'
  elementPath: string  // CSS 路径，如 "div#app > button.btn-danger"
  elementText: string  // 按钮文字或 aria-label，最多 50 字符
  page: string         // 点击时的页面 URL
}

/** SPA 路由跳转事件 */
interface RouteChangePayload {
  subType: 'route-change'
  from: string  // 跳转前 URL
  to: string    // 跳转后 URL
}

/** 手动代码埋点事件 */
interface CustomPayload {
  subType: 'custom'
  name: string                        // 事件名，如 'checkout_success'
  extra?: Record<string, unknown>     // 附加业务数据
}

type BehaviorPayload = PVPayload | ClickPayload | RouteChangePayload | CustomPayload
```

> 🏗️ **架构思考：为什么用判别联合类型，而不是一个大而全的 interface？**
>
> 如果用一个 interface，所有字段都变成可选（`page?: string; from?: string; to?: string...`），
> TypeScript 就无法通过 `if (payload.subType === 'pv')` 帮你自动缩窄类型，
> 每次取值前都要手动断言，既不安全又繁琐。
>
> **判别联合 + subType** 是 TypeScript 处理"一种概念有多种变体"的最佳模式，
> 与第 06 章的 ErrorPayload 保持一致的设计语言。

---

## 9.3 PV 采集：记录用户"进了哪扇门"

PV（Page View，页面浏览量）是最基础的行为数据——记录用户访问了哪个页面、从哪里来的。

> 📖 **术语：PV（Page View，页面浏览量）**
>
> 白话：用户每打开一个页面就算一次 PV，就像进了一个房间算一次记录。
> 术语：PV 是统计网站流量的基础指标，每次页面初始化时上报一次，记录 URL 和来源（referrer）。

### 实现思路

在插件的 `setup()` 中**同步执行**，立即上报，确保时序最早：

```typescript
// packages/browser/src/plugins/behavior.ts（片段）

if (pv) {
  const pvPayload: PVPayload = {
    subType: 'pv',
    page: location.href,       // 当前完整 URL（含协议/域名/路径/query）
    referrer: document.referrer, // 上一个页面的 URL，直接输入地址栏时为空字符串
  }
  monitor.capture('behavior', pvPayload)
  addBreadcrumb(pvPayload)  // 同时写入行为栈
}
```

> **为什么在 setup() 的同步阶段上报，而不是监听 DOMContentLoaded？**
>
> `setup()` 本身是同步执行的，时机在页面加载的最早阶段（main.ts 入口处就调用了 init()）。
> 如果等 DOMContentLoaded，可能错过某些极短暂的会话。更重要的是，
> PV 只需要知道"用户进入了这个 URL"，不依赖 DOM 是否加载完成，直接读取即可。

---

## 9.4 点击行为采集：事件委托 + 智能过滤

### 9.4.1 为什么用事件委托？

一个 SPA 页面可能有几十上百个按钮，而且这些按钮是**动态渲染**的——组件挂载时才出现，卸载时就消失。

> 📖 **术语：事件委托（Event Delegation）**
>
> 白话：与其给每个按钮都安装一个监听器，不如在它们的"祖先"（比如 document）安装一个，
> 谁触发了事件，通过 event.target 就能知道是谁，然后再处理。
> 术语：利用事件冒泡机制，将子元素的事件统一在父元素上处理。

事件委托的三大优势：

| 对比项 | 给每个元素绑定 | 事件委托（我们的方案）|
|---|---|---|
| 动态元素 | 需要在组件挂载/卸载时手动添加/移除 | 自动覆盖所有元素，无需关心生命周期 |
| 内存开销 | N 个元素 → N 个监听器 | 1 个监听器 |
| teardown 成本 | 需要逐一移除 | 移除 document 上的 1 个监听器 |

### 9.4.2 过滤策略：只记录有意义的点击

不是每次 `click` 都值得上报。用户鼠标放在页面随机区域点一下，对我们没有任何分析价值。

```typescript
const interactiveEl = target.closest(
  'button, a, input, select, textarea, [data-track]',
)
if (!interactiveEl) return
```

> 📖 **术语：`Element.closest(selector)`**
>
> 白话：从当前元素开始，向上找祖先，返回第一个匹配 CSS 选择器的祖先（包括自己）。
> 用途：用户可能点击了按钮内部的图标（`<svg>`），此时 `event.target` 是图标，
> 但真正有意义的是包裹它的 `<button>`，`closest('button')` 可以找到这个按钮。

过滤规则说明：
- `button / a / input / select / textarea`：浏览器原生交互元素，语义明确
- `[data-track]`：业务代码主动标注"这个元素值得监控"，适用于自定义组件

> 🏗️ **架构思考：data-track 的设计意图**
>
> 有时候重要的可交互元素不是 `<button>`，比如一个 `<div>` 实现的下拉菜单项。
> `[data-track]` 属性是一个"声明式埋点"的逃生口：
> 业务代码只需要在元素上加 `data-track` 属性（无需任何 JS），就能被 SDK 自动采集。
>
> 这避免了为了一个自定义组件就要调用 `trackBehavior()` 的侵入性。

### 9.4.3 提取元素路径与文字

```typescript
/** 提取 CSS 路径：向上最多 5 层，遇到 id 立即停止 */
function getElementPath(el: Element, maxDepth = 5): string {
  const parts: string[] = []
  let current: Element | null = el
  let depth = 0

  while (current && depth < maxDepth) {
    const tag = current.tagName.toLowerCase()

    if (current.id) {
      parts.unshift(`${tag}#${current.id}`)
      break // id 已唯一，无需继续向上
    }

    const classes = Array.from(current.classList).slice(0, 2).join('.')
    parts.unshift(classes ? `${tag}.${classes}` : tag)

    current = current.parentElement
    depth++
  }

  return parts.join(' > ')
}

/** 提取可读文本：优先级 aria-label > data-track-text > innerText */
function getElementText(el: Element): string {
  return (
    el.getAttribute('aria-label') ??
    el.getAttribute('data-track-text') ??
    (el as HTMLElement).innerText?.trim().slice(0, 50) ??
    ''
  )
}
```

> **为什么 innerText 要截取 50 字符？**
>
> 防止一个文章摘要段落被点击时，把几百字都上报进行为数据库，浪费存储，
> 也会让后端分析时数据不整洁。50 字通常足够描述"这是什么按钮"。

> **为什么优先用 aria-label？**
>
> 图标按钮（如 `<button><svg>...</svg></button>`）的 `innerText` 是空的，
> 但良好的可访问性实践会在按钮上加 `aria-label="关闭"` 或 `aria-label="删除"`，
> 利用这个信息可以还原出语义文字。

---

## 9.5 SPA 路由跳转采集：劫持 history API

### 9.5.1 为什么 history.pushState 默认"无声无息"？

浏览器有一个反直觉的设计：`history.pushState()` 调用后，**不会触发任何事件**。

```javascript
// Vue Router、React Router 底层都会调用这个
history.pushState({}, '', '/new-page')

// 但是：没有任何事件被触发！window 上什么都没发生
```

对比一下：

| 导航方式 | 触发事件 |
|---|---|
| 浏览器前进/后退按钮 | `popstate` |
| 修改 `location.hash` | `hashchange` |
| `history.pushState()` | **无原生事件** |
| `history.replaceState()` | **无原生事件** |

这就是为什么所有前端路由库（Vue Router、React Router）的底层都要对 `pushState` 做处理——因为浏览器原生不通知你。

> 📖 **术语：Monkey Patching（猴子补丁）**
>
> 白话：在程序运行时，偷偷把一个已有的函数换成自己的版本，让调用方以为什么都没变，
> 但实际上执行的是你的代码。就像把别人的杯子换掉，但外观一模一样。
> 术语：在运行时动态修改对象的属性或方法，通常用于在不修改源码的情况下增加行为。

### 9.5.2 劫持实现

```typescript
// 第一步：保存原始方法（必须！teardown 时需要还原）
_originalPushState = history.pushState.bind(history)

// 第二步：用包装函数替换原始方法
history.pushState = function (...args: Parameters<typeof history.pushState>) {
  _originalPushState!(...args)              // 先执行原始逻辑
  reportRouteChange(location.href)          // 再上报路由变化
}
```

> **为什么要先执行原始方法，再读取 location.href？**
>
> `pushState` 执行后，`location.href` 才会更新为新 URL。
> 如果先读 `location.href` 再调用 `pushState`，读到的还是旧 URL，上报的就是错误的跳转目标。

### 9.5.3 三种路由方式全覆盖

```typescript
// Hash 路由（Vue Router hash 模式、老式 SPA）
window.addEventListener('hashchange', () => reportRouteChange(location.href))

// History API 路由（Vue Router history 模式、React Router）
history.pushState = ...    // 劫持
history.replaceState = ... // 劫持

// 浏览器前进/后退
window.addEventListener('popstate', () => reportRouteChange(location.href))
```

> 🏗️ **架构思考：同一份逻辑为什么要同时处理三种路由方式？**
>
> 现实中你不知道接入方用的是哪种路由：
> - 老项目可能用 Hash 路由（URL 里有 `#`）
> - 新项目通常用 History API 路由（干净的 `/` 路径）
> - 浏览器前进/后退是独立的事件，任何路由方式都可能触发
>
> SDK 的职责是：**覆盖所有场景，让接入方不用关心底层细节**。

### 9.5.4 URL 防重检测

```typescript
function reportRouteChange(to: string) {
  const from = _prevUrl
  _prevUrl = to
  if (from === to) return  // URL 没变，不上报（replaceState 可能只更新 state 对象）
  // ...
}
```

`replaceState` 有时只是更新 state 对象而不改变 URL（比如 React 用它保存滚动位置），
这种情况不应该被当作路由跳转上报。

---

## 9.6 行为栈（Breadcrumbs）：让每条错误报告自带剧情

### 9.6.1 设计思路

行为栈是一个**固定长度的 FIFO 队列**：

> 📖 **术语：FIFO（First In, First Out，先进先出）**
>
> 白话：就像排队，先来的先出去。队列满了，最先进来的那个被挤出去，新来的从尾部进入。
> 术语：一种数据结构策略，常用于有界缓冲区场景，保证不超过预设容量。

```typescript
// 全局行为栈（模块级别单例）
let _breadcrumbs: BehaviorPayload[] = []
let _maxBreadcrumbs = 20

function addBreadcrumb(payload: BehaviorPayload): void {
  _breadcrumbs.push(payload)
  if (_breadcrumbs.length > _maxBreadcrumbs) {
    _breadcrumbs.shift()  // 移除最旧的一条
  }
}

export function getBreadcrumbs(): readonly BehaviorPayload[] {
  return [..._breadcrumbs]  // 返回副本，防止外部修改内部状态
}
```

> **为什么行为栈要放在模块级别，而不是插件实例内部？**
>
> 因为 `getBreadcrumbs()` 需要从 `@monitor/browser` 包的 `index.ts` 直接导出，
> 供业务代码在任意位置调用（不只是插件内部）。
>
> 如果封在插件实例里，`index.ts` 就无法访问它。
> 而 SDK 在一个页面只初始化一次，模块单例不会产生"多实例共享状态混乱"的问题。

### 9.6.2 使用场景：报错时附带行为路径

```typescript
// 实际错误上报时可以这样做（第 11 章完善，这里演示思路）：
import { getBreadcrumbs } from '@monitor/browser'

monitor.capture('error', {
  ...errorPayload,
  breadcrumbs: getBreadcrumbs(),  // 附带最近 20 条用户行为
})
```

---

## 9.7 手动埋点 API：trackBehavior()

### 9.7.1 为什么需要 trackBehavior()？

自动采集能覆盖**通用行为**（点击、路由、PV），但无法表达**业务语义**：

- SDK 不知道"用户点击了某个按钮"意味着"加入购物车"
- SDK 不知道"页面加载完成"意味着"完成了一次支付"

`trackBehavior()` 就是为这类场景设计的：

```typescript
// packages/browser/src/index.ts（片段）
import { addBreadcrumb } from './plugins/behavior'
import type { CustomPayload } from '@monitor/core'

export function trackBehavior(name: string, extra?: Record<string, unknown>): void {
  if (!_monitor) return
  const payload: CustomPayload = { subType: 'custom', name, extra }
  _monitor.capture('behavior', payload)
  addBreadcrumb(payload)  // 同步写入行为栈，让这条埋点也出现在 Breadcrumbs 中
}
```

> 🏗️ **架构思考：为什么 trackBehavior() 在 index.ts 而不是 behavior.ts 插件里？**
>
> `trackBehavior()` 是**用户对外的 API**，是 `@monitor/browser` 包的一等公民。
> 而 behavior 插件是内部实现细节，接入方只需要在 `init()` 时注册插件，
> 之后调用 `trackBehavior()` 即可，不需要关心插件内部结构。
>
> 这种设计保持了**关注点分离**：
> - `createBehaviorPlugin()`：负责"自动采集"
> - `trackBehavior()`：负责"手动埋点"
> - `getBreadcrumbs()`：负责"读取行为历史"
>
> 三个职责独立，API 清晰。

### 9.7.2 使用示例

```typescript
import { trackBehavior } from '@monitor/browser'

// 用户完成了一次支付
function onPaymentSuccess(orderId: string, amount: number) {
  trackBehavior('payment_success', { orderId, amount, currency: 'CNY' })
}

// 用户将商品加入购物车
function addToCart(productId: string) {
  trackBehavior('add_to_cart', { productId, quantity: 1 })
}
```

> **命名建议：事件名使用 snake_case 业务语义命名**
>
> - ✅ `'payment_success'`、`'add_to_cart'`、`'video_play'`
> - ❌ `'click'`（太泛，无法区分是什么点击）、`'button_click'`（描述了行为，但没有业务语义）
>
> 好的埋点命名原则：**名词+动词，描述用户完成的事情，而不是用户做了什么动作**。

---

## 9.8 插件完整实现

### 9.8.1 插件配置项

```typescript
interface BehaviorPluginOptions {
  pv?: boolean           // 是否自动采集 PV，默认 true
  click?: boolean        // 是否自动采集点击，默认 true
  routeChange?: boolean  // 是否监听路由跳转，默认 true
  maxBreadcrumbs?: number // 行为栈容量，默认 20
}
```

### 9.8.2 新建文件

```
packages/browser/src/plugins/behavior.ts  ← 新建
```

### 9.8.3 核心代码结构

```typescript
// packages/browser/src/plugins/behavior.ts

// 模块级行为栈（供 getBreadcrumbs 和 trackBehavior 共享）
let _breadcrumbs: BehaviorPayload[] = []
let _maxBreadcrumbs = 20

export function getBreadcrumbs(): readonly BehaviorPayload[] { ... }
export function addBreadcrumb(payload: BehaviorPayload): void { ... }

function getElementPath(el: Element, maxDepth = 5): string { ... }
function getElementText(el: Element): string { ... }

export function createBehaviorPlugin(options?: BehaviorPluginOptions): Plugin {
  return {
    name: 'behavior',
    setup(monitor) {
      // 1. 立即上报 PV
      // 2. document.addEventListener('click', ...) 事件委托
      // 3. 劫持 history.pushState / replaceState
      // 4. 监听 popstate + hashchange
    },
    teardown() {
      // 清理所有监听器，还原 history 方法，清空行为栈
    },
  }
}
```

### 9.8.4 teardown() 的重要性：防止资源泄漏

```typescript
teardown() {
  // 清理点击监听
  if (_clickHandler) {
    document.removeEventListener('click', _clickHandler)
    _clickHandler = null
  }

  // 还原被劫持的 history 方法（关键！）
  if (_originalPushState) {
    history.pushState = _originalPushState    // 还原为原始方法
    _originalPushState = null
  }
  if (_originalReplaceState) {
    history.replaceState = _originalReplaceState
    _originalReplaceState = null
  }
  // ...
}
```

> **为什么必须还原 history 方法？**
>
> 设想这个场景：SPA 切换到一个完全不同的"租户"，需要先 `destroy()` 再 `init()`。
> 如果不还原 `history.pushState`，第二次 `init()` 会在已经被劫持的函数上再套一层，
> 最终调用栈变成：包装函数 → 包装函数 → 原始函数，形成"劫持叠加"，产生重复上报。

---

## 9.9 更新 @monitor/browser 导出

### 修改 `packages/browser/src/index.ts`

```typescript
// 新增：行为类型导出
export type {
  PVPayload, ClickPayload, RouteChangePayload, CustomPayload, BehaviorPayload,
} from '@monitor/core'

// 新增：行为采集插件
export { createBehaviorPlugin, getBreadcrumbs } from './plugins/behavior'
export type { BehaviorPluginOptions } from './plugins/behavior'

// 新增：手动埋点便捷 API
export function trackBehavior(name: string, extra?: Record<string, unknown>): void {
  if (!_monitor) return
  const payload: CustomPayload = { subType: 'custom', name, extra }
  _monitor.capture('behavior', payload)
  addBreadcrumb(payload)
}
```

---

## 9.10 接入 Demo

### 9.10.1 注册行为采集插件

```typescript
// demos/vue3-demo/src/main.ts（或 react-demo/main.tsx）

import { init, createBehaviorPlugin } from '@monitor/browser'

init({
  dsn: 'http://localhost:3001/collect',
  appId: 'vue3-demo',
  debug: true,
  plugins: [
    createErrorPlugin(),
    createWebVitalsPlugin(),

    // 第 09 章：行为采集插件
    createBehaviorPlugin({
      pv: true,
      click: true,
      routeChange: true,
      maxBreadcrumbs: 20,
    }),
  ],
})
```

### 9.10.2 使用手动埋点

```typescript
import { trackBehavior, getBreadcrumbs } from '@monitor/browser'

// 手动代码埋点
trackBehavior('add_to_cart', { productId: 'SKU_001', price: 299 })

// 查看当前行为栈（调试用）
console.log(getBreadcrumbs())
```

---

## 9.11 验证效果

```bash
pnpm --filter @monitor/vue3-demo dev
```

打开浏览器控制台，**观察以下输出**：

### 页面加载时（自动）
```
[Monitor] capture | type=behavior {
  payload: { subType: 'pv', page: 'http://localhost:5173/', referrer: '' }
}
```

### 点击任意按钮时（自动）
```
[Monitor] capture | type=behavior {
  payload: {
    subType: 'click',
    elementPath: 'div#app > div.container > section.section > div.actions > button.btn',
    elementText: '模拟跳转 /detail/1',
    page: 'http://localhost:5173/'
  }
}
```

### 点击路由跳转按钮时（自动）
```
[Monitor] capture | type=behavior {
  payload: {
    subType: 'route-change',
    from: 'http://localhost:5173/',
    to: 'http://localhost:5173/detail/1'
  }
}
```

### 调用 trackBehavior() 时（手动）
```
[Monitor] capture | type=behavior {
  payload: {
    subType: 'custom',
    name: 'add_to_cart',
    extra: { productId: 'SKU_001', price: 299, quantity: 2 }
  }
}
```

### 调用 getBreadcrumbs() 时
```
[Monitor] 当前行为栈（Breadcrumbs）
  [0] { subType: 'pv', page: '...', referrer: '' }
  [1] { subType: 'click', elementPath: '...', elementText: '触发 ReferenceError', page: '...' }
  [2] { subType: 'route-change', from: '...', to: '.../detail/1' }
  [3] { subType: 'click', elementPath: '...', elementText: '手动埋点 trackBehavior()', page: '...' }
  [4] { subType: 'custom', name: 'add_to_cart', extra: { ... } }
```

---

## 9.12 本章要点与架构总结

### 新增文件

| 文件 | 内容 |
|---|---|
| `packages/browser/src/plugins/behavior.ts` | 行为采集插件（新建） |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `packages/core/src/types.ts` | 新增 PVPayload / ClickPayload / RouteChangePayload / CustomPayload / BehaviorPayload |
| `packages/core/src/index.ts` | 重导出 5 个新类型 |
| `packages/browser/src/index.ts` | 新增类型导出 + createBehaviorPlugin + getBreadcrumbs + trackBehavior |
| `demos/vue3-demo/src/main.ts` | 注册 createBehaviorPlugin() |
| `demos/vue3-demo/src/App.vue` | 新增行为采集演示区域 |
| `demos/react-demo/src/main.tsx` | 注册 createBehaviorPlugin() |
| `demos/react-demo/src/App.tsx` | 新增行为采集演示区域 |

### 三类采集能力对比（第 09 章完成后）

```
@monitor/browser
├── createErrorPlugin()       → 错误采集（JS错误/资源错误/Promise/框架层）
├── createWebVitalsPlugin()   → 性能采集（Core Web Vitals + Navigation Timing）
├── createBehaviorPlugin()    → 行为采集（PV/点击/路由跳转）  ← 本章新增
└── trackBehavior()           → 手动埋点 API                  ← 本章新增
```

### 核心设计决策回顾

| 决策 | 原因 |
|---|---|
| 事件委托（document 级别监听） | 覆盖动态渲染的 SPA 元素，teardown 成本低 |
| Monkey Patch history API | pushState 不触发原生事件，必须劫持 |
| teardown 时还原 history 方法 | 防止 SDK 重新初始化时产生"劫持叠加"重复上报 |
| 行为栈放模块级别 | trackBehavior() 需要从外部写入，插件内部封不住 |
| getBreadcrumbs() 返回副本 | 防止调用方修改内部状态（不可变性原则） |
| 过滤只记录交互元素 | 减少噪声数据，避免每次鼠标移动点击都上报 |
| 元素路径最多 5 层 | 路径太长在数据库中占用大量空间，5 层已足够定位大多数元素 |

---

## 9.13 下一章预告：SDK 采集——API 请求监控

第 10 章将采集**网络请求数据**（XHR / Fetch），包括：
- 请求 URL / Method / Status Code / 响应时间
- 请求失败时关联行为栈（Breadcrumbs）
- 劫持 XMLHttpRequest 和 window.fetch

这是 SDK 四大采集能力（错误 / 性能 / 行为 / API）的最后一块拼图，
完成后整个数据采集层就全部就绪，第 11 章开始实现上报策略。
