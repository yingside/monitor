# 第 10 章：SDK 采集——API 请求监控

---

## 本章概述

### 这节课讲什么？

前面几章，我们的 SDK 已经能自动采集：JS 错误、资源加载错误、Promise 未捕获异常、框架层错误、页面性能指标、用户行为（PV / 点击 / 路由跳转）。

这节课完成 SDK 采集层的最后一块拼图：**API 请求监控**。

页面里所有对后端的 HTTP 请求，SDK 都能自动"旁听"——记录它的方法、URL、状态码、耗时、是否成功，一行业务代码都不需要改。

### 重点

1. **Monkey Patch（猴子补丁）思想**：为什么要"劫持"原生 API，而不是让业务代码自己上报？
2. **XHR 劫持**：如何在不破坏 XMLHttpRequest 原有功能的情况下悄悄"插一脚"？
3. **Fetch 劫持**：Fetch 是 Promise 风格 API，劫持方式和 XHR 完全不同，有哪些陷阱？
4. **无限循环防护**：SDK 本身上报数据也会发 HTTP 请求，如何防止"监控自己监控自己"？

### 难点

- TypeScript 下 XHR 重载签名的类型安全处理（`WeakMap` 状态管理 + 类型断言）
- Fetch 的"4xx/5xx 不是错误"的反直觉特性
- 模块级 Monkey Patch 的副作用边界与 teardown 还原策略

---

## 一、为什么要监控 API 请求？

在真实的前端应用中，绝大多数用户感知到的"慢"或"出错"，背后都是 API 请求出了问题：

| 现象 | 根因 |
|---|---|
| 页面白屏 | 首屏接口 500 / 超时 |
| 数据不刷新 | 接口返回 304 缓存数据 / 接口异常 |
| 操作无响应 | POST 请求网络错误，但前端没有错误提示 |
| 整体变慢 | 某个接口 P99 耗时从 200ms 飙升到 2s |

前端有了错误采集，能告诉你"出错了"；有了性能采集，能告诉你"慢了"；但真正要定位到"哪个接口出了问题"，必须有 API 请求监控。

> 📖 **术语：API 请求监控（API Monitoring）**
> 白话说就是：我们的 SDK "偷偷坐在"浏览器的 HTTP 请求旁边，每次请求发出和收到回复时，记录一条日志——发了什么、花了多久、成功还是失败。
> 专业术语叫"API 请求监控"或"接口性能采集"。

---

## 二、采集原理——Monkey Patch（猴子补丁）

### 什么是 Monkey Patch？

> 📖 **术语：Monkey Patch（猴子补丁）**
> 白话说：把别人家的函数"偷偷换掉"，换成一个"先做我自己的事，再执行原来逻辑"的包装函数。
> 因为这个技巧像猴子一样灵活（也像猴子一样调皮），所以叫猴子补丁。

浏览器里发 HTTP 请求有两种方式：

- `XMLHttpRequest`（XHR）：老派，axios 默认底层就是它
- `window.fetch`：现代，原生 fetch、React Query、SWR 都基于它

这两个都是浏览器内置 API，业务代码直接调用它们。SDK 不可能要求业务代码在每次 API 调用时"顺便"传给我们，所以我们的策略是：**在业务代码调用这些 API 之前，把它们替换成我们的版本，让"计时和记录"在透明状态下完成**。

```
原来的流程：
业务代码 → fetch('/api/users') → 浏览器原生 fetch → 服务器

劫持后的流程：
业务代码 → fetch('/api/users') → [SDK wrapper: 开始计时] → 浏览器原生 fetch → 服务器
                                                          ↓ 收到响应
                                                 [SDK: 记录耗时/状态/上报] → monitor.capture()
                                                          ↓
                                                 返回真正的 Response 给业务代码
```

> 🏗️ **架构思考：为什么在 SDK 里做，而不是让业务代码自己上报？**
>
> - **零侵入**：业务代码不需要改任何一行，SDK init 之后自动生效
> - **覆盖全面**：无论是 axios、jQuery、手写 fetch，只要走浏览器底层 API，一律能采集到
> - **职责分离**：监控逻辑不散落在业务代码里，统一在 SDK 中维护
>
> 备选方案：要求业务代码在每次请求里手动调用 `monitor.capture('api', {...})`。
> 这种方式代码耦合度高，团队里漏报一次就少一条数据，实际不可维护。

---

## 三、ApiPayload 类型设计

在 `packages/core/src/types.ts` 中新增：

```typescript
export interface ApiPayload {
  subType: 'xhr' | 'fetch'  // 请求发起方式
  method: string             // HTTP 方法（统一大写）
  url: string                // 请求 URL
  status: number             // HTTP 状态码（0 = 网络错误）
  duration: number           // 耗时（ms，向下取整）
  success: boolean           // status >= 200 && status < 300
}
```

### 为什么只采集这 6 个字段？

> 🏗️ **架构思考：最小数据原则**
>
> 很多同学第一反应：应该也采集 `requestBody`、`responseBody`，这样排查问题更方便啊？
>
> **不行，有两个理由：**
> 1. **隐私风险**：请求/响应体可能包含密码、身份证、Token、业务数据等敏感信息，SDK 不应该碰这些。这是 GDPR 等法规的基本要求。
> 2. **包体积**：一个 JSON 响应体可能有几百 KB，如果每次请求都上报，监控数据量会爆炸，费用和存储成本飙升。
>
> **采集元信息（method/url/status/duration）已足够回答最重要的问题**：哪个接口慢了？哪个接口挂了？失败率多少？这些才是监控的核心价值。

---

## 四、XHR 劫持实现

### 4.1 劫持哪些方法？

XMLHttpRequest 发一个请求的完整流程：

```
① new XMLHttpRequest()   — 创建实例
② xhr.open(method, url)  — 设置方法和 URL，还没发送
③ xhr.send(body?)        — 真正发送请求
④ xhr.onload / onerror   — 请求完成的回调
```

我们需要在 `open()` 里记录 method 和 url，在 `send()` 里开始计时，在 `loadend` 事件里结束计时并上报。

### 4.2 为什么用 WeakMap 存状态？

每个 XHR 实例都有自己的 method、url、开始时间。存状态有两种思路：

**方案 A：直接往 XHR 实例上加属性（如 `xhr._monitorUrl`）**

```typescript
// ❌ 不推荐
xhr._monitorUrl = url  // TypeScript 报错：XHR 上没有 _monitorUrl
```

- TypeScript 会报类型错误，必须用 `as any` 绕过
- 污染了 XMLHttpRequest 的公共接口，有命名冲突风险

**方案 B：WeakMap（本 SDK 的选择）**

```typescript
// ✅ 推荐
const _xhrStateMap = new WeakMap<XMLHttpRequest, XhrState>()
_xhrStateMap.set(xhr, { method, url, startTime })
```

> 📖 **术语：WeakMap**
> 白话说：一个特殊的字典，key 必须是对象（不能是字符串/数字），当 key 对象被垃圾回收了，对应的条目也自动消失，不会内存泄漏。
> 对比普通 Map：普通 Map 会阻止 key 对象被回收（因为 Map 持有引用），WeakMap 不会。

用 WeakMap 的好处：
- TypeScript 类型安全（WeakMap 有完整的泛型类型）
- 不污染 XHR 实例
- XHR 用完销毁后，WeakMap 里的记录也自动清理，不内存泄漏

### 4.3 为什么监听 loadend 而不是 onload/onerror/ontimeout？

XHR 有三个"完成"事件：
- `onload`：请求成功响应（包含 4xx/5xx，只要有响应就触发）
- `onerror`：网络错误（断网、CORS 失败等，没有 HTTP 响应）
- `ontimeout`：超时

如果三个都监听，需要写三份逻辑。但有一个事件无论哪种情况都会触发：

> 📖 **术语：loadend**
> `loadend` 是 XMLHttpRequest 的"最终事件"——无论成功、失败、超时，它总是最后触发一次。就像"不管怎样，这件事最终结束了"的信号。

```typescript
this.addEventListener('loadend', () => {
  // 这里无论成功/失败/超时都会执行
  const status = this.status  // 成功时是 2xx/3xx/4xx/5xx，网络错误时是 0
})
```

用 `loadend` + `this.status === 0` 判断网络错误，代码简洁，逻辑清晰。

### 4.4 关键代码解析

```typescript
// 劫持 open：记录 method + url
XMLHttpRequest.prototype.open = function (method, url, async = true, username, password) {
  const resolvedUrl = resolveUrl(String(url))  // 把相对路径转绝对路径
  _xhrStateMap.set(this, { method: method.toUpperCase(), url: resolvedUrl, startTime: 0 })
  _originalXhrOpen.call(this, method, url, async, username, password)  // 透传给原始方法
}

// 劫持 send：开始计时，注册 loadend
XMLHttpRequest.prototype.send = function (body) {
  const state = _xhrStateMap.get(this)
  if (state && !shouldSkip(state.url, filterList)) {
    state.startTime = Date.now()
    this.addEventListener('loadend', () => {
      const duration = Math.floor(Date.now() - state.startTime)
      monitor.capture('api', {
        subType: 'xhr', method: state.method, url: state.url,
        status: this.status, duration, success: this.status >= 200 && this.status < 300,
      })
    })
  }
  _originalXhrSend.call(this, body)
}
```

**为什么 startTime 在 open 里初始化为 0，而不是直接记录时间？**

因为 `open()` 只是"设置请求"，并没有真正发出去。HTTP 请求真正开始的时刻是 `send()` 调用时。如果在 `open()` 里计时，会多算 `open` 到 `send` 之间的业务代码耗时，导致 duration 不准确。

---

## 五、Fetch 劫持实现

### 5.1 Fetch 的特殊性

Fetch API 和 XHR 最大的不同：

```typescript
// XHR 是"事件驱动"的：发请求 → 等事件 → 处理
const xhr = new XMLHttpRequest()
xhr.open('GET', '/api/users')
xhr.onload = () => { /* 处理响应 */ }
xhr.send()

// Fetch 是"Promise 驱动"的：发请求 → 返回 Promise → 链式处理
const response = await fetch('/api/users')
```

劫持 Fetch 的方式是"包装 Promise"：

```typescript
const originalFetch = window.fetch.bind(window)  // 保存原始引用

window.fetch = function(input, init) {
  const startTime = Date.now()
  return originalFetch(input, init).then(
    (response) => {
      // 成功路径：记录并返回原始 response
      monitor.capture('api', { ..., status: response.status })
      return response  // ⚠️ 必须 return！否则调用方拿不到数据
    },
    (error) => {
      // 失败路径（网络错误）：记录并重新抛出
      monitor.capture('api', { ..., status: 0 })
      throw error  // ⚠️ 必须重新 throw！否则调用方的 catch 收不到错误
    }
  )
}
```

### 5.2 Fetch 最大的反直觉陷阱

> ⚠️ **重要**：Fetch 的 HTTP 4xx/5xx 响应**不是 Promise reject**！

```typescript
// XHR 里：
// - 2xx → onload 触发，this.status = 200
// - 4xx/5xx → onload 也触发，this.status = 404/500（不是 onerror！）
// - 网络错误 → onerror 触发，this.status = 0

// Fetch 里：
fetch('/api/error')  // 假设服务器返回 500
  .then(res => {
    console.log(res.ok)     // false（500 不是 ok）
    console.log(res.status) // 500
    // ⚠️ 这里 Promise 是 resolved 状态，不是 rejected！
  })
  .catch(err => {
    // 只有断网、CORS 失败、DNS 解析失败才走这里
    // HTTP 4xx/5xx 不会走到这里！
  })
```

这就是为什么我们在 `.then` 的成功回调里，也要记录 `response.status` 并用 `response.ok` 判断成功失败——因为 `.then` 会同时处理 2xx 和 4xx/5xx。

```typescript
// 正确判断方式：
const success = response.ok  // response.ok = status 在 200-299 范围内
```

### 5.3 为什么必须 return response？

这是新手最容易犯的错误：

```typescript
// ❌ 错误写法
window.fetch = function(input, init) {
  return originalFetch(input, init).then((response) => {
    monitor.capture('api', { ... })
    // 忘记 return response！
  })
}

// 业务代码：
const data = await fetch('/api/users').then(r => r.json())
// data 是 undefined！因为 .then 没有返回值，Promise resolve 了 undefined
```

```typescript
// ✅ 正确写法：必须原样返回 response
return response
```

---

## 六、URL 过滤——防无限循环

### 为什么要过滤？

SDK 收集到数据后，会上报到 DSN 地址（`http://localhost:3001/collect`）。
这个上报动作本身也是一次 HTTP 请求（fetch/XHR）。
如果不过滤，就会出现：

```
发 API 请求 → 采集到 → 上报到 DSN（也是 API 请求）→ 采集到 → 再上报 → 无限循环
```

> 📖 **术语：无限循环（Infinite Loop）**
> 白话说：A 触发 B，B 又触发 A，循环往复，停不下来，直到程序崩溃。
> 在监控 SDK 里，如果"上报行为"本身也被监控采集，就会产生这个问题。

### 解决方案

在插件 setup 时，把 DSN 地址自动加入过滤列表：

```typescript
setup(monitor: MonitorInstance): void {
  const filterList: (string | RegExp)[] = [
    monitor.options.dsn,        // ← 自动加入，不需要用户手动填写
    ...(options?.filterUrls ?? []),
  ]
  _patchXhr(monitor, filterList)
  _patchFetch(monitor, filterList)
}
```

过滤规则支持**字符串前缀**和**正则**两种形式：

```typescript
// 字符串：前缀匹配（适合过滤某个域名的所有接口）
filterUrls: ['https://analytics.example.com']

// 正则：灵活匹配（适合过滤特定路径模式）
filterUrls: [/\/health-check$/, /\/ping/]
```

```typescript
function shouldSkip(url: string, filterList: (string | RegExp)[]): boolean {
  return filterList.some(filter =>
    typeof filter === 'string' ? url.startsWith(filter) : filter.test(url)
  )
}
```

---

## 七、插件完整结构

```
packages/browser/src/plugins/api.ts
├── ApiPluginOptions          // 配置类型
├── shouldSkip()              // URL 过滤工具
├── resolveUrl()              // 相对路径转绝对路径
├── XhrState + WeakMap        // XHR 状态存储
├── 原始方法备份               // _originalXhrOpen/Send/Fetch（用于 teardown）
├── createApiPlugin()         // 插件工厂
│   ├── setup()               // 调用 _patchXhr + _patchFetch
│   └── teardown()            // 还原所有被劫持的方法
├── _patchXhr()               // XHR 劫持实现
└── _patchFetch()             // Fetch 劫持实现
```

> 🏗️ **架构思考：为什么原始方法要在模块顶层保存？**
>
> 如果每次 `setup()` 时才保存，就会有一个 Bug：
> - 第一次 setup：`_original = XMLHttpRequest.prototype.open`（正确，保存的是原生方法）
> - 调用 `teardown()` 后
> - 第二次 setup（如重新初始化 SDK）：`_original = XMLHttpRequest.prototype.open`（❌ 此时已经是上次的劫持版本了！）
>
> 在模块加载时（文件 import 的时候）立即保存一次，保证保存的永远是浏览器原生方法，不受后续劫持影响。

---

## 八、Mock 服务器

为了验证 API 监控功能，本章新增了一个本地 Mock API 服务器（`demos/mock-server/server.ts`）。

### 为什么要单独建一个 Mock 服务器？

第 11 章才会实现 DSN 数据接收服务，现在没有真实服务器。如果 demo 里的按钮发出的请求目标不存在，统统只会得到"网络错误（status: 0）"，无法演示不同 status code 下的采集效果。

Mock 服务器的职责：
- **提供真实可调用的 HTTP 接口**，让 demo 能触发各种场景
- **端口 3002**，与 DSN 占位端口 3001 区分，不冲突
- **不是 DSN 服务器**，不接收监控数据，只提供测试用的业务接口

> ⚠️ **课程深度说明**
> Mock 服务器使用 Node.js 内置 `node:http` 模块实现，不引入任何第三方依赖。
> Node.js 25 原生支持运行 TypeScript 文件（`--experimental-strip-types` 默认开启）。
> 本章只使用它来演示，不深入 Node.js HTTP 服务的内部原理。

### 可用接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 返回 200，用户列表 |
| POST | `/api/login` | 返回 200，模拟登录 token |
| GET | `/api/slow` | 延迟 1500ms 后返回 200（演示慢请求） |
| GET | `/api/error` | 返回 500（演示服务端错误） |
| 其他 | 任意 | 返回 404 |

### 启动方式

```bash
# 从根目录（推荐）
pnpm mock-server

# 或指定 filter
pnpm --filter @monitor/mock-server dev
```

---

## 九、接入 Demo

### main.ts / main.tsx 新增注册

```typescript
import { createApiPlugin } from '@monitor/browser'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  plugins: [
    // ... 之前的插件
    createApiPlugin({
      // DSN 地址会自动加入过滤，无需手动填写
      filterUrls: [],  // 可按需添加其他需要排除的 URL
    }),
  ],
})
```

### Demo 中演示的场景

| 按钮 | 预期采集结果 |
|------|------|
| Fetch GET /api/users | `subType: 'fetch', status: 200, success: true` |
| Fetch POST /api/login | `subType: 'fetch', method: 'POST', status: 200, success: true` |
| Fetch GET /api/slow | `duration ≈ 1500ms, status: 200, success: true` |
| Fetch GET /api/error | `status: 500, success: false` |
| XHR GET /api/users | `subType: 'xhr', status: 200, success: true` |
| XHR GET /api/error | `subType: 'xhr', status: 500, success: false` |
| Fetch 网络错误 | `status: 0, success: false`（端口不存在，网络错误） |

---

## 十、运行验证

### 步骤

```bash
# 终端 1：启动 Mock 服务器
cd '10.SDK 采集——API 请求监控/代码/monitor'
pnpm mock-server
# 期望输出：[mock-server] 已启动，监听端口 3002

# 终端 2：启动 Vue3 Demo
pnpm --filter @monitor/vue3-demo dev
# 打开浏览器，找到"🟤 自动采集——API 请求监控"区域
# 点击各个按钮，观察控制台输出
```

### 控制台预期输出格式

```
[Monitor] capture api {
  subType: 'fetch',
  method: 'GET',
  url: 'http://localhost:3002/api/users',
  status: 200,
  duration: 23,
  success: true
}
```

---

## 十一、构建验证

```bash
cd '10.SDK 采集——API 请求监控/代码/monitor'
pnpm build
# 期望：Tasks: 10 successful, 10 total（已验证通过）
```

---

## 十二、本章小结

| 知识点 | 核心思想 |
|--------|---------|
| Monkey Patch | 替换原生 API，透明插入采集逻辑，业务代码零改动 |
| XHR 劫持 | 劫持 `open`（记录元数据）+ `send`（计时 + `loadend` 回调） |
| Fetch 劫持 | 包装 Promise 链，`.then` 处理成功/4xx/5xx，第二参数处理网络错误 |
| WeakMap | 类型安全地在 XHR 实例上附加状态，无内存泄漏 |
| 无限循环防护 | 自动将 DSN URL 加入过滤列表 |
| 最小数据原则 | 只采集元信息（method/url/status/duration），不碰请求/响应体 |
| teardown 还原 | 模块加载时即刻保存原始引用，确保还原的是真正的浏览器原生方法 |

---

## 十三、下一章预告

**第 11 章：SDK 上报——数据结构设计与上报策略**

现在 SDK 采集到的每条数据都通过 `monitor.capture()` 进入队列，然后直接打印到控制台（因为 `_flush` 还只是个 log）。

下一章，我们来解决"如何把数据发到服务器"这个问题：
- 采集数据封装成什么格式上报？（最终的 `MonitorEvent` 结构）
- 什么时候上报？（即时上报 vs 批量上报）
- 用什么方式上报？（`Beacon API` / `fetch` / `XHR` 的对比）
- 如何避免上报丢失？（页面关闭时的可靠上报策略）
