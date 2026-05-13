# 第 11 章：SDK 上报——数据结构设计与上报策略

> **本章目标**：把前面 6 章采集到的数据真正"发出去"——设计统一的上报数据包格式，实现可靠、高效的批量 HTTP 上报机制。
>
> **本章完成后**，SDK 具备从采集到上报的完整闭环，可以通过本地验证服务器 `collect-server` 观察到每一条监控数据发往后端的全过程。

---

## 本章主要内容

| 节 | 内容 | 重点/难点 |
|---|---|---|
| 11.1 | 上报数据通用结构设计 | 理解为什么要有这些字段 |
| 11.2 | traceId / spanId 的生成策略 | UUID v4 原理与 crypto API |
| 11.3 | 上报方式对比：fetch vs sendBeacon | ⭐ 难点：为什么关页面时 fetch 会丢数据 |
| 11.4 | Transport 核心实现：批量 + 定时 + 满批 | ⭐ 难点：三种触发上报的时机设计 |
| 11.5 | 上报优化策略：采样率、离线缓存预留 | 架构拓展思维 |
| 11.6 | 端到端验证：从采集到 collect-server 收到数据 | 实操验证 |

> **重点**：Transport 类的设计（11.3-11.4）——这是 SDK 最容易出 Bug 的地方，也是最能体现架构思维的地方。
>
> **难点**：`navigator.sendBeacon` 的工作机制，以及为什么不能在所有场景都用 `fetch`。

---

## 11.1 上报数据通用结构设计

### 先回顾：前面做了什么

前面 6 章（第 06-10 章）的工作，本质上都是在回答一个问题：**"采集什么数据？"**

- 第 06-07 章：采集 JS 错误、资源错误、Promise 异常、框架层错误
- 第 08 章：采集 Web Vitals 性能指标、导航时序
- 第 09 章：采集 PV、点击行为、路由跳转、手动埋点
- 第 10 章：采集 XHR/Fetch API 请求的状态、耗时

这些采集的数据（`JsErrorPayload` / `PerformanceMetricPayload` / `ApiPayload` 等），都是"具体内容"，也就是我们关注的业务信息。

### 问题：仅有业务内容还不够

想象你收到一封快递，只有一个箱子，没有寄件人地址、没有运单号、没有时间戳——即使内容物完好，你也不知道：

- 这是哪个应用发来的？（不同项目的数据要分开）
- 这是哪个用户触发的？（问题定位需要 userId）
- 这发生在什么页面？（复现 Bug 的第一要素）
- 这是什么时候发生的？（排查时序问题必须有时间戳）
- 这次会话的其他事件在哪里？（需要 traceId 把同一次浏览会话的事件关联起来）

所以，上报的数据包不能只有"具体内容"，还需要一个**通用信封（Envelope）**。

> 📖 **术语：Envelope（信封结构）**
>
> 白话：快递箱外面的那层包装，写着"从哪来、发给谁、运单号、寄出时间"。
> 技术：在监控系统里，Envelope 指包裹业务数据（payload）的通用字段集合，所有类型的监控事件共享同一套信封格式。

### MonitorEvent：我们的信封结构

这个结构早在第 05 章已经在 `types.ts` 中定义，前面各章节的采集结果都通过它封装：

```typescript
interface MonitorEvent {
  traceId: string    // 会话 ID：同一次页面访问共享同一个 traceId（打开→关闭）
  appId: string      // 项目标识：来自 init({ appId })，区分不同应用
  userId?: string    // 用户标识（可选）：来自 init({ userId })，关联具体用户
  type: EventType    // 事件大类：'error' | 'performance' | 'behavior' | 'api'
  payload: unknown   // 事件具体内容：由各插件填充（JsErrorPayload / ApiPayload 等）
  timestamp: number  // 发生时间（毫秒级 Unix 时间）：Date.now()
  page: string       // 事件发生时的完整 URL：location.href
  ua: string         // 采集时的 User-Agent：navigator.userAgent
}
```

**本章的关键变化**：前 10 章只是把 `MonitorEvent` 放进了一个内存队列（`TODO: 接入 Transport`），本章要把它真正发出去。

> 🏗️ **架构思考：为什么 MonitorEvent 里没有 spanId？**
>
> 课程大纲里提到了 `traceId / spanId`。当前实现只有 `traceId`（会话维度），没有 `spanId`（单次操作维度）。
>
> 这是有意为之的权衡：
> - **本课程场景**：前端监控的关联单位是"一次页面访问"（session），`traceId` 够用。
> - **分布式追踪场景**（如 Zipkin / Jaeger）：需要 `spanId` 标记某次 RPC 调用的唯一性，适合后端微服务追踪。
> - **当前阶段**：不引入 `spanId` 是为了降低复杂度。在 API 监控日志里，每条 `ApiPayload` 已经包含完整的 URL + timestamp + duration，后端可以用这些字段做关联分析。

---

## 11.2 traceId 的生成策略

### 白话解释

`traceId` 就是"这次打开浏览器到关闭之间"的唯一门牌号。同一个 traceId 下的所有事件，就是同一个用户同一次操作产生的。

### UUID v4

我们用 **UUID v4**（通用唯一标识符，版本 4）来生成 `traceId`。

格式：`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`（36 个字符，包括 4 个横线）

> 📖 **术语：UUID v4**
>
> 白话：一串随机数字字母，几乎不可能出现两个相同的（碰撞概率约为 $\frac{1}{5.3 \times 10^{36}}$）。
> 技术：UUID v4 是 RFC 4122 规范中的一个版本，由 122 位随机数生成，其中版本位固定为 `4`，变体位固定为 `8/9/a/b` 之一。

### 生成代码

```typescript
// packages/core/src/monitor.ts（内联实现）
function generateSessionId(): string {
  // 优先使用 Web Crypto API（更安全的随机数）
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 降级方案：Math.random（兼容老浏览器/Node.js 环境）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
```

> 🏗️ **架构思考：为什么 `core` 包内联了一份 UUID，而不是用 `browser-utils` 的？**
>
> `browser-utils` 包里也有 `generateUUID()`——这是对外暴露给业务代码使用的。
> `core` 包刻意不依赖任何内部包，保持依赖方向干净：
>
> ```
> core         → 不依赖任何内部包
> browser-utils → 不依赖任何内部包
> browser      → 依赖 core + browser-utils
> ```
>
> 如果 `core` 依赖 `browser-utils`，就形成了不必要的耦合，也违反了"包越小越纯"的原则。

---

## 11.3 上报方式对比

上报就是"把数据发给服务器"。前端有两种方式可以做到，它们的适用场景非常不同。

### 方式一：`fetch` POST（常规上报）

```typescript
fetch('https://dsn.example.com/collect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(events),
  keepalive: true,  // ⬅️ 关键：即使页面关闭，请求也会继续
})
```

**适用场景**：用户正常操作期间的定时批量上报。

**优点**：
- 异步，不阻塞主线程
- 可以获取服务器响应（用于重试、日志等）
- 使用简单，大家都熟悉

**致命缺陷**：**页面卸载时会被取消！**

> 📖 **术语：页面卸载（Page Unload）**
>
> 白话：用户关闭标签页、刷新、或者跳转到外部链接时，当前页面"消失"的那个瞬间。
> 技术：触发 `beforeunload` 事件。此时页面进入卸载流程，浏览器会取消所有正在进行的异步操作，包括进行中的 `fetch` 请求。

`keepalive: true` 可以让 fetch 在页面关闭后继续发送，但有 **64KB 的 body 大小限制**，超出则 `keepalive` 失效，请求仍可能被取消。

### 方式二：`navigator.sendBeacon`（页面卸载可靠上报）

```typescript
const blob = new Blob([JSON.stringify(events)], { type: 'application/json' })
const queued = navigator.sendBeacon('https://dsn.example.com/collect', blob)
// queued = true → 浏览器已接受，保证会发出
// queued = false → 被拒绝（通常是 body 超过 64KB）
```

**适用场景**：页面即将关闭时，必须保证数据能发出去。

**核心价值**：浏览器规范保证，即使页面已经卸载，`sendBeacon` 发出的请求**在后台一定会完成**，不会被中断。

> 📖 **术语：navigator.sendBeacon**
>
> 白话："临死前发出的最后一条消息"——这名字取得很贴切，就是页面关闭时还能把数据可靠地发出去。
> 技术：W3C Beacon API 规范定义的浏览器原生接口，HTTP POST 方式，浏览器将请求放入独立的传输队列，与页面生命周期解耦，保证在 unload 后也能完成发送。

**限制**：
- 只支持 POST
- 不支持自定义请求头（用 `Blob` 绕过 Content-Type 限制）
- Body 大小通常 64KB 上限
- 无法获取响应

### 对比表

| 维度 | `fetch POST` | `navigator.sendBeacon` |
|------|-------------|------------------------|
| 使用场景 | 正常操作期间定时上报 | 页面关闭 / 切换后台 |
| 页面关闭后能否发出 | 不保证（keepalive 有大小限制） | **浏览器保证** |
| 能否获取响应 | ✅ 能 | ❌ 不能 |
| Body 大小限制 | 无明确限制 | 通常 64KB |
| 自定义请求头 | ✅ 自由设定 | 需要用 Blob 绑定 Content-Type |

> 🏗️ **架构思考：为什么不全程用 sendBeacon？**
>
> 因为 sendBeacon 无法获取响应状态，无法实现错误重试，也无法感知上报成功与否。
> 而且它更适合"小批量最终数据"，不适合频繁调用。
>
> **最佳实践（我们的策略）**：
> - **正常期间**：用 `fetch POST` 定时批量上报（可以日后加重试逻辑）
> - **卸载时机**：用 `sendBeacon` 发送剩余队列（可靠性优先）
> - **两者互补**，各司其职

---

## 11.4 Transport 核心实现

### 为什么不直接在 Monitor 里发 fetch？

这是本章最重要的架构问题。

> 🏗️ **架构思考：单一职责分离**
>
> - **Monitor** 的职责：管理插件、驱动数据管道（`capture → 采样 → 规范化`）
> - **Transport** 的职责：维护上报队列、定时/满批发送、页面卸载保护
>
> 如果把上报逻辑堆在 Monitor 里，Monitor 就同时负责"数据加工"和"网络传输"两件事，违反单一职责原则（SRP）。
>
> 将来想换成 WebSocket、或者加入 IndexedDB 离线缓存，只需要改 Transport 一个类，Monitor 完全不需要动。

### 三种触发上报的时机

Transport 实现了三条"数据发送触发路径"：

```
┌─────────────────────────────────────────────────────────────┐
│                   Transport 内部状态                         │
│                                                             │
│   queue: MonitorEvent[]   ← capture() → enqueue() 不断写入  │
│                                                             │
│   触发路径 A：定时器      每 flushInterval 毫秒 → _sendFetch │
│   触发路径 B：满批立发    queue.length >= maxBatchSize → 立即 │
│   触发路径 C：页面卸载    visibilitychange + beforeunload   │
│              → _sendBeacon（更可靠）                        │
└─────────────────────────────────────────────────────────────┘
```

**路径 A（定时）**：防止数据"堆积太久"才发出

```typescript
this.timer = setInterval(() => {
  this._sendFetch()
}, this.config.flushInterval)  // 默认 5000ms
```

**路径 B（满批立发）**：防止突发大量事件时，队列无限膨胀

```typescript
enqueue(event: MonitorEvent): void {
  this.queue.push(event)
  if (this.queue.length >= this.config.maxBatchSize) {  // 默认 10 条
    this._sendFetch()  // 立刻发，不等定时器
  }
}
```

**路径 C（页面卸载）**：保证关页前的数据不丢失

```typescript
// 用户切换标签页、按 Home 键进后台 → document.visibilityState === 'hidden'
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') this._sendBeacon()
})

// 用户关闭页面、跳转外部链接、浏览器刷新 → beforeunload
window.addEventListener('beforeunload', () => {
  this._sendBeacon()
})
```

### ⚠️ 第 11 章对前面代码的变更说明

> ⚠️ **前 10 章代码变更点——请注意**

前 10 章的 `monitor.ts` 中，`_flush()` 方法是一个 TODO：

```typescript
// ❌ 之前（第 10 章结束时）
private _flush(): void {
  if (this.options.debug) {
    console.log('[Monitor] flush | pending upload to', this.options.dsn)
  }
  // TODO: 接入 Transport 层，实现真正的 HTTP 上报
  // this.queue = []
}
```

**第 11 章的变更：**

1. **删除了 `Monitor.queue`**（原来的内存缓冲区）和 `_flush()` 方法
2. **新增 `Monitor._transport`**（`Transport` 实例，在 `init()` 时创建）
3. **`capture()` 的第 [3] 步**从 `push 到 this.queue` 改为 `this._transport.enqueue(event)`
4. **新增公开方法 `Monitor.flush()`**（调用 `this._transport.flush()`）
5. **`MonitorOptions` 新增两个配置项**：

   ```typescript
   // init() 时可传入这两项控制上报策略（有默认值，不传也可以）
   flushInterval?: number   // 定时刷新间隔（ms），默认 5000
   maxBatchSize?: number    // 每批最多事件数，默认 10
   ```

6. **`@monitor/browser` 新导出 `flush()` 函数**

**对接入方（demos）的影响**：demos 的 `main.ts` / `main.tsx` 新增了 `flushInterval` 和 `maxBatchSize` 配置项（均已有默认值，不传不影响功能），其余代码**无需修改**。

---

## 11.5 上报优化策略

### 采样率控制（已在第 05 章实现）

```typescript
// capture() 最前面
if (Math.random() > this.options.sampleRate) return
```

`sampleRate: 0.5` 表示随机丢弃 50% 的事件，减少上报量。

**适用场景**：高流量应用（DAU > 100 万），全量采集会让后端压力很大，用采样率降低数据量。

**权衡**：采样会导致统计数据不精确（只是抽样，不是全量）。常见做法：
- 错误事件不采样（100% 上报，错误要尽量全量收集）
- 性能、行为、API 事件按比例采样

### 批量上报（本章实现）

前面已经详细讲了 `flushInterval` 和 `maxBatchSize`。

核心逻辑：`queue.splice(0, maxBatchSize)` 每次从队头取出最多 `maxBatchSize` 条，剩余的留在队列等下一轮。

```typescript
private _sendFetch(): void {
  if (this.queue.length === 0) return
  const batch = this.queue.splice(0, this.config.maxBatchSize)  // 取出 ≤10 条
  fetch(this.config.dsn, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify(batch),
  })
}
```

### 离线缓存（IndexedDB 方案预留）

> 📖 **术语：IndexedDB**
>
> 白话：浏览器里的"本地数据库"，可以存大量结构化数据，关闭浏览器也不丢失。
> 技术：W3C 标准的浏览器内置键值数据库，支持事务，适合存储需要持久化的数据。

当前 Transport 对 `fetch` 失败的处理是"丢弃"：

```typescript
fetch(...).catch((err) => {
  // 简单策略：上报失败直接丢弃，不重试
  // 生产级策略（本课程预留）：
  //   1. 将失败的 batch 写入 IndexedDB
  //   2. 下次 SDK 初始化时读取并重试
})
```

**为什么现在不实现？**

IndexedDB 的写入/读取是异步的，引入会增加代码复杂度 3-4 倍。对于本课程的目标（演示完整数据链路），当前实现已经够用。

生产级 SDK（如 Sentry）确实有这个能力，感兴趣的同学可以查阅 Sentry Browser SDK 的 Transport 实现。

### 跨域问题处理（CORS）

监控 SDK 的 DSN 通常和业务页面不在同一个域，例如：
- 业务页面：`https://www.myapp.com`
- DSN 服务：`https://dsn.monitor.io/collect`

浏览器会在发送 POST 请求前，先发一次 OPTIONS 预检请求。DSN 服务需要配置 CORS 响应头：

```http
Access-Control-Allow-Origin: *          // 或指定域名白名单
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

第 14 章实现 `dsn-server`（NestJS）时，会配置正确的 CORS 策略。

> ⚠️ **注意**：不要在生产环境用 `Access-Control-Allow-Origin: *`，应配置精确的白名单，防止任意来源向 DSN 服务发送垃圾数据。

---

## 11.6 端到端验证

### 启动流程

本章新增了一个验证用的本地服务器 `collect-server`，模拟第 14 章将要实现的 `dsn-server`。

**终端 1：启动 collect-server（端口 3001）**

```bash
cd 11.SDK上报——数据结构设计与上报策略/代码/monitor
pnpm collect-server
```

期望输出：

```
✓ [collect-server] 监听 http://localhost:3001
  POST /collect  → 接收 SDK 上报数据
  GET  /health   → 健康检查

等待 SDK 上报数据...（默认每 5 秒发一次批量）
```

**终端 2：启动 vue3-demo**

```bash
pnpm --filter @monitor/vue3-demo dev
```

打开浏览器 `http://localhost:5173`，页面加载时 SDK 会自动采集 PV 和 Web Vitals。等待约 5 秒，observe collect-server 终端：

```
────────────────────────────────────────────────────────────
14:32:18  收到批次：3 条事件（累计 3 条）
  [behavior] subType=pv  traceId=a1b2c3d4...
    page: http://localhost:5173/
    payload: {"subType":"pv","page":"http://localhost:5173/","referrer":""}
  [performance] subType=navigation-timing  traceId=a1b2c3d4...
    page: http://localhost:5173/
    payload: {"subType":"navigation-timing","dns":0,"tcp":0,...}
  [performance] subType=web-vital  traceId=a1b2c3d4...
    page: http://localhost:5173/
    payload: {"subType":"web-vital","metric":"FCP","value":82,...}
```

### 验证要点

| 验证项 | 操作 | 预期结果 |
|---|---|---|
| 定时上报（路径 A） | 页面加载后等待 5 秒 | collect-server 收到第一批数据 |
| 满批立发（路径 B） | 点击"填满批次（连发 10 条）"按钮 | collect-server 立刻收到 10 条（不等 5 秒） |
| 手动 flush（路径 D） | 点击"立即上报"按钮 | collect-server 立刻收到一批数据 |
| sendBeacon（路径 C） | 触发几个错误后**关闭标签页** | collect-server 收到最后一批数据（需在关页后几秒内出现） |
| traceId 一致性 | 查看同一次会话的多条日志 | 所有事件的 `traceId` 前 8 位相同 |

---

## 本章小结

### 本章新增代码

| 文件 | 变更类型 | 内容 |
|---|---|---|
| `packages/core/src/transport.ts` | **新建** | Transport 核心上报类（批量、定时、sendBeacon） |
| `packages/core/src/types.ts` | 修改 | `MonitorOptions` / `ResolvedOptions` 新增 `flushInterval` / `maxBatchSize` |
| `packages/core/src/monitor.ts` | 修改 | 接入 Transport；删除 `_flush()` TODO；新增 `flush()` 方法 |
| `packages/core/src/index.ts` | 修改 | 新导出 `Transport` 和 `TransportConfig` |
| `packages/browser/src/index.ts` | 修改 | 新导出 `flush()` 函数 |
| `demos/collect-server/server.ts` | **新建** | 本地上报接收服务器（端口 3001，端到端验证用） |
| `demos/vue3-demo/src/main.ts` | 修改 | 新增 `flushInterval` / `maxBatchSize` 配置 |
| `demos/react-demo/src/main.tsx` | 修改 | 新增 `flushInterval` / `maxBatchSize` 配置 |
| `demos/vue3-demo/src/App.vue` | 修改 | 新增"第 11 章上报策略演示"区块 |
| `demos/react-demo/src/App.tsx` | 修改 | 新增"第 11 章上报策略演示"区块 |

### 数据流完整闭环

```
用户操作 → 插件采集 → monitor.capture()
    ↓
[采样过滤] → sampleRate 随机丢弃
    ↓
[规范化] → 封装为 MonitorEvent（信封格式）
    ↓
transport.enqueue(event)
    ↓
┌─────── 三种上报时机 ────────┐
│ A. 定时器（5 秒）           │ → fetch POST  → DSN /collect
│ B. 满批（10 条）            │ → fetch POST  → DSN /collect
│ C. 页面卸载（关/切换标签）  │ → sendBeacon  → DSN /collect
└───────────────────────────┘
    ↓
collect-server（第 11 章验证）
    ↓
dsn-server NestJS（第 14 章实现）→ Kafka → Doris
```

### 下一章预告

第 12 章：基础设施搭建——用 Docker Desktop 在本地启动 Kafka + Apache Doris + PostgreSQL，为后端服务做好准备。

---

## 附：MonitorOptions 完整配置参考

```typescript
init({
  // ── 必填 ──────────────────────────────────────────────────────────────
  dsn: 'http://localhost:3001/collect',  // 上报地址
  appId: 'my-app',                        // 项目 ID

  // ── 用户信息 ──────────────────────────────────────────────────────────
  userId: 'user_001',                     // 用户 ID（可选，登录后动态设置）

  // ── 采样与调试 ────────────────────────────────────────────────────────
  sampleRate: 1,      // 采样率 0-1，默认 1（全量）
  debug: true,        // 调试模式，控制台打印所有事件

  // ── 上报策略（第 11 章新增） ──────────────────────────────────────────
  flushInterval: 5000,  // 定时刷新间隔（ms），默认 5000
  maxBatchSize: 10,     // 每批最多事件数，默认 10
  maxQueueSize: 20,     // 预初始化缓冲上限，默认 20

  // ── 插件 ──────────────────────────────────────────────────────────────
  plugins: [
    createErrorPlugin(),
    createWebVitalsPlugin(),
    createBehaviorPlugin({ pv: true, click: true, routeChange: true }),
    createApiPlugin(),
  ],
})
```
