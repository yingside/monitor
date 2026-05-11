# 第 08 章：SDK 采集——页面性能指标

> **本章目标**：采集 Core Web Vitals 与 Navigation Timing，量化页面性能，为后续可视化看板提供完整的性能数据来源。

---

## 课程元信息

```json
{
  "chapter": 8,
  "title": "SDK 采集——页面性能指标",
  "duration": "约 90 分钟",
  "skills": [
    "PerformanceObserver",
    "paint entry（first-contentful-paint）",
    "largest-contentful-paint entry",
    "layout-shift entry",
    "event entry（Event Timing API）",
    "PerformanceNavigationTiming",
    "navigation entry（Navigation Timing Level 2）",
    "Session Window 算法（CLS）",
    "visibilitychange 上报时机",
    "web-vitals onFCP / onLCP / onCLS / onINP / onTTFB",
    "createWebVitalsPlugin（web-vitals 实现）",
    "createPerformancePlugin（原生 PerformanceObserver 实现）",
    "Lighthouse Performance 面板"
  ],
  "prerequisites": ["第 05-07 章 SDK 插件机制"]
}
```

---

## 8.1 性能为什么是相对的——指标比感觉更可靠

我们先问一个问题：**"页面快不快"怎么算？**

直觉上，用户等了 2 秒会觉得慢。但同样是 2 秒：
- 一个白屏 2 秒然后内容瞬间出来 → 感觉**很慢**
- 每隔 0.5 秒渐进加载一块内容 → 感觉**还好**

所以"快不快"是用户感知的问题，**纯时间不够，还要看内容什么时候出来、布局稳不稳定、点击有没有及时响应**。

为了量化这些用户感知，Google 提出了 **Core Web Vitals**，用精确的指标替代模糊的感觉：

| 用户感知的问题 | 对应指标 |
|---|---|
| 页面内容什么时候出来？ | FCP（首次内容绘制） |
| 主要内容什么时候加载完？ | LCP（最大内容绘制） |
| 布局会不会突然跳动？ | CLS（累积布局偏移） |
| 点击有没有及时响应？ | INP（交互响应延迟） |
| 服务端有多快？ | TTFB（首字节时间） |

> 📖 **术语：Core Web Vitals（核心网页指标）**
>
> 白话：Google 定义的一套"衡量网页体验好不好"的标准指标，就像给网页体验打分的量尺。
> 术语：Core Web Vitals 是 Google 在 2020 年推出的页面质量信号，直接影响 SEO 排名，也是前端性能监控的行业基准。

---

## 8.2 浏览器导航时序模型（Navigation Timing Level 2）

> 🏗️ **架构思考**
>
> 在实现性能采集插件之前，我们需要先理解**浏览器是怎么加载一个页面的**。
>
> 这不只是为了知道 API 怎么用，更重要的是：一旦发现性能问题，你要知道是哪个阶段出了问题——是 DNS 慢？服务端慢？还是 JS 执行慢？

### 页面加载的完整时序

```
用户输入 URL
     │
     ▼
fetchStart ──────────────────────────────────────────────────────────────────►
     │                                                                        │
     ├── DNS 解析 ──────────────────────────────────────────────────────────  │
     │   domainLookupStart ──► domainLookupEnd                                │
     │                                                                        │
     ├── TCP 连接 ──────────────────────────────────────────────────────────  │
     │   connectStart ──► (secureConnectionStart ──►) connectEnd              │
     │                                                                        │
     ├── 发送请求 ──────────────────────────────────────────────────────────  │
     │   requestStart                                                         │
     │                                                                        │
     ├── 首字节到达 ─────────────────────────────────────────────────────────  │
     │   responseStart   ← TTFB = responseStart - fetchStart                 │
     │                                                                        │
     ├── 响应下载完成 ────────────────────────────────────────────────────────  │
     │   responseEnd                                                          │
     │                                                                        │
     ├── DOM 解析完成（可交互）──────────────────────────────────────────────  │
     │   domInteractive                                                       │
     │                                                                        │
     ├── DOM + 子资源完成 ────────────────────────────────────────────────────  │
     │   domComplete                                                          │
     │                                                                        │
     └── load 事件触发 ──────────────────────────────────────────────────────►
         loadEventEnd
```

### 各阶段计算公式

```typescript
// 通过 PerformanceNavigationTiming 对象取值
const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

const metrics = {
  dns:            nav.domainLookupEnd - nav.domainLookupStart,   // DNS 解析
  tcp:            nav.connectEnd - nav.connectStart,              // TCP 握手
  ssl:            nav.connectEnd - nav.secureConnectionStart,     // SSL 握手（HTTPS）
  ttfb:           nav.responseStart - nav.fetchStart,             // 等待首字节
  download:       nav.responseEnd - nav.responseStart,            // 响应下载
  domInteractive: nav.domInteractive - nav.fetchStart,            // DOM 可交互
  domComplete:    nav.domComplete - nav.fetchStart,               // DOM 完全解析
  loadTime:       nav.loadEventEnd - nav.fetchStart,              // 页面完全加载
}
```

> 📖 **术语：Navigation Timing Level 2**
>
> 白话：浏览器在页面加载过程中记录的一系列时间戳，像一个精确的"页面加载计时器"，告诉你每个阶段花了多少时间。
> 术语：W3C 规范，通过 `performance.getEntriesByType('navigation')` 获取 `PerformanceNavigationTiming` 对象，包含 20+ 个时间点。

---

## 8.3 Core Web Vitals 核心指标详解

### FCP — First Contentful Paint（首次内容绘制）

**白话**：页面从白屏到第一次出现文字或图片的时间。用户看到"页面开始有内容了"的时刻。

**采集方式**：`PerformanceObserver` 监听 `paint` 类型的 entry，取 `name === 'first-contentful-paint'` 的那条记录。

| 评级 | 阈值 |
|------|------|
| 🟢 good | < 1.8 秒 |
| 🟡 needs-improvement | 1.8 ~ 3 秒 |
| 🔴 poor | > 3 秒 |

```typescript
const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'first-contentful-paint') {
      console.log('FCP:', entry.startTime, 'ms')
    }
  }
})
obs.observe({ type: 'paint', buffered: true })
//                            ↑ buffered: true 非常重要！
// 如果 SDK 初始化时 FCP 已经发生了（FCP 通常在 SDK 加载之前），
// buffered: true 会让 PerformanceObserver 把"历史缓冲区"里的记录也回放给你。
```

> 🏗️ **架构思考：为什么 `buffered: true` 如此关键？**
>
> SDK 通常在页面加载的早期才初始化，但 FCP 可能在 SDK 初始化之前就已发生。
> 没有 `buffered: true`，我们就会错过这次 FCP 事件。
> 所有对页面早期性能指标的监听，都必须加 `buffered: true`。

---

### LCP — Largest Contentful Paint（最大内容绘制）

**白话**：页面上"最大块内容"（通常是主图、大标题）加载完成的时间。这是用户感知"页面主体出来了"的时刻。

**特殊之处**：LCP 的值会**随着页面渲染不断更新**（用户滚动时可能出现更大的图片），必须等到用户第一次交互或页面隐藏时才能确定最终值。

| 评级 | 阈值 |
|------|------|
| 🟢 good | < 2.5 秒 |
| 🟡 needs-improvement | 2.5 ~ 4 秒 |
| 🔴 poor | > 4 秒 |

```typescript
let latestLCP: number | null = null

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries()
  // 始终取最新的一条（LCP 会随时更新为更大的元素）
  latestLCP = entries[entries.length - 1].startTime
})
obs.observe({ type: 'largest-contentful-paint', buffered: true })

// 用户交互或页面隐藏时，锁定 LCP 的最终值
const reportLCP = () => {
  if (latestLCP !== null) {
    console.log('LCP (final):', latestLCP, 'ms')
  }
}
addEventListener('click', reportLCP, { once: true })
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') reportLCP()
}, { once: true })
```

---

### CLS — Cumulative Layout Shift（累积布局偏移）

**白话**：页面元素突然"蹦位"的程度。比如你正要点一个按钮，突然一张广告图加载出来把按钮往下推了——这就是布局偏移。

**CLS 是无单位的比值**，不是毫秒，值越小越好。

| 评级 | 阈值 |
|------|------|
| 🟢 good | < 0.1 |
| 🟡 needs-improvement | 0.1 ~ 0.25 |
| 🔴 poor | > 0.25 |

**Session Window 算法**（Google 推荐）：

> 📖 **术语：Session Window（会话窗口）**
>
> 白话：把连续发生的布局偏移归为一组（窗口），计算每组的累积值，取所有组的最大值作为最终 CLS。避免一次偶发的大偏移撑高整体分数。
> 术语：Session Window 算法要求：相邻两次偏移间隔 < 1000ms 且窗口总时长 < 5000ms，否则开启新窗口。

```typescript
let clsValue = 0        // 最终 CLS（取所有窗口最大值）
let sessionValue = 0    // 当前窗口的累积偏移
let sessionEntries: PerformanceEntry[] = []

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const ls = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
    
    // 排除"用户主动触发"的布局偏移（500ms 内有输入事件）
    if (ls.hadRecentInput) continue

    const first = sessionEntries[0]
    const last = sessionEntries[sessionEntries.length - 1]
    
    if (
      sessionEntries.length === 0 ||
      (last && entry.startTime - last.startTime < 1000) &&
      (first && entry.startTime - first.startTime < 5000)
    ) {
      sessionValue += ls.value    // 加入当前窗口
      sessionEntries.push(entry)
    } else {
      sessionValue = ls.value     // 开启新窗口
      sessionEntries = [entry]
    }
    clsValue = Math.max(clsValue, sessionValue)
  }
})
obs.observe({ type: 'layout-shift', buffered: true })

// 页面隐藏时上报
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    console.log('CLS (final):', clsValue)
  }
}, { once: true })
```

> 🏗️ **架构思考：为什么等到页面隐藏才上报 CLS 和 INP？**
>
> CLS 和 INP 是"页面生命周期内的累积指标"——用户使用页面的过程中，值可能随时更新。
> 如果提前上报，得到的是中间状态而不是最终值，数据会失真。
> `visibilitychange` 事件是当前浏览器能感知"用户离开当前页面"的最可靠时机（切换标签页/最小化/关闭都会触发）。

---

### INP — Interaction to Next Paint（交互响应延迟）

**白话**：用户点击/键盘/触摸后，页面多久更新了一帧（用户"感觉到"响应了）。这是 2024 年取代 FID 的新指标。

> 📖 **术语：INP vs FID**
>
> - **FID（First Input Delay）**：只测量第一次交互的"输入延迟"（从用户点击到浏览器开始处理的时间），已于 2024 年退出 Core Web Vitals。
> - **INP（Interaction to Next Paint）**：测量整个页面生命周期内**所有交互**的延迟（p98，取近似最大值），更能反映真实用户体验。

| 评级 | 阈值 |
|------|------|
| 🟢 good | < 200 ms |
| 🟡 needs-improvement | 200 ~ 500 ms |
| 🔴 poor | > 500 ms |

```typescript
let maxINP = 0

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    const ev = entry as PerformanceEntry & {
      duration: number
      interactionId?: number
    }
    // interactionId > 0：用户主动交互（非合成事件）
    if ((ev.interactionId ?? 0) > 0) {
      maxINP = Math.max(maxINP, ev.duration)
    }
  }
})
// durationThreshold: 16 → 只采集超过一帧（16ms）的事件，减少噪音
obs.observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit)
```

> ⚠️ **课程深度说明**
>
> INP 的严格计算算法（p98 百分位 + 分组去重）在生产级实现中较为复杂。
> 本 SDK 采用**简化的最大值**实现，适合教学理解。生产环境可替换为 `web-vitals` 库的 `onINP()` 函数。

---

### TTFB — Time to First Byte（首字节时间）

**白话**：从浏览器发出请求，到服务器返回第一个字节的时间。主要衡量**服务端响应速度**（包含网络传输）。

| 评级 | 阈值 |
|------|------|
| 🟢 good | < 800 ms |
| 🟡 needs-improvement | 800 ~ 1800 ms |
| 🔴 poor | > 1800 ms |

```typescript
// TTFB 直接从 Navigation Timing 读取，无需 PerformanceObserver
const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
const ttfb = nav.responseStart - nav.fetchStart   // 含重定向时间

// 等 DOM 加载完成后读取（确保数据就绪）
addEventListener('load', () => {
  console.log('TTFB:', ttfb, 'ms')
}, { once: true })
```

---

## 8.4 PerformanceObserver 原生采集详解

> 🏗️ **架构思考：为什么用 PerformanceObserver 而不是 performance.getEntries()？**
>
> `performance.getEntries()` 是同步读取，必须在数据就绪后才能调用。
> `PerformanceObserver` 是事件驱动的，数据一旦产生就会自动回调——这对 LCP、CLS、INP 这类**延迟或累积型指标**至关重要，因为它们的值会在页面生命周期内持续变化。
>
> 可替换方案：`web-vitals` 库（见 8.5 节）封装了所有上述逻辑，API 更简洁，但需要额外依赖。

### 监听器生命周期管理

性能插件需要在 `teardown()` 时断开所有 `PerformanceObserver`，否则在 SPA（单页应用）中页面路由切换后，旧页面的 observer 会继续产生数据：

```typescript
const observers: PerformanceObserver[] = []

// setup() 中注册，push 到数组
const obs = new PerformanceObserver(...)
observers.push(obs)

// teardown() 中统一断开
teardown() {
  for (const obs of observers) {
    obs.disconnect()
  }
  observers.length = 0
}
```

### 浏览器兼容性处理

并非所有浏览器都支持所有 entry type（Safari 对 `event` 类型的支持较晚），观察时需要做安全捕获：

```typescript
function _observeSafely(fn: () => void): void {
  try {
    fn()
  } catch {
    // 浏览器不支持该 entry type，静默忽略
  }
}

_observeSafely(() => {
  const obs = new PerformanceObserver(...)
  obs.observe({ type: 'largest-contentful-paint', buffered: true })
})
```

---

## 8.5 集成 `web-vitals` 库（对比原生采集，展示插件可互换性）

[google/web-vitals](https://github.com/GoogleChrome/web-vitals) 是 Google 官方维护的库，封装了所有 Core Web Vitals 的采集逻辑。

### 原生 PerformanceObserver vs web-vitals 库

| 对比项 | 原生 PerformanceObserver | web-vitals 库 |
|--------|--------------------------|----------------|
| **额外依赖** | 无 | 需要安装 (~2.6 KB gzip) |
| **代码量** | ~250 行（每个指标需单独处理） | ~40 行（5 行搞定全部指标） |
| **边界处理** | 需要手动处理各种 edge case | Google 官方已处理（bfcache 等） |
| **INP 算法** | 简化版（取最大值） | 严格 p98 算法 |
| **适合场景** | 教学 / 深度定制 | **生产环境首选** |

### `createWebVitalsPlugin` 实现

SDK 同时提供了基于 web-vitals 库的插件实现，**与原生插件的接口完全相同**：

```typescript
// packages/browser/src/plugins/performance-web-vitals.ts
import { onFCP, onLCP, onCLS, onINP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'
import type { MonitorInstance, PerformanceMetricPayload, Plugin } from '@monitor/core'

export interface WebVitalsPluginOptions {
  vitals?: boolean      // Core Web Vitals（默认 true）
  navigation?: boolean  // 导航时序（默认 true，web-vitals 不提供，仍用原生 API）
}

export function createWebVitalsPlugin(options: WebVitalsPluginOptions = {}): Plugin {
  const { vitals = true, navigation = true } = options

  return {
    name: 'performance',  // ← 与原生插件同名！体现"相同能力，不同实现"

    setup(monitor: MonitorInstance): void {
      if (vitals) {
        // 5 行代码完成全部 Core Web Vitals 采集
        // web-vitals 内部处理所有边界情况，API 极为简洁
        onFCP((metric) => monitor.capture('performance', toPayload('FCP', metric)))
        onLCP((metric) => monitor.capture('performance', toPayload('LCP', metric)))
        onCLS((metric) => monitor.capture('performance', toCLSPayload(metric)))
        onINP((metric) => monitor.capture('performance', toPayload('INP', metric)))
        onTTFB((metric) => monitor.capture('performance', toPayload('TTFB', metric)))
      }
      // navigation timing 部分与原生实现完全相同（略）
    },
  }
}
```

### 插件可互换：接入方只需改一行

这正是**插件模式**的核心优势——实现细节变了，接入方完全不感知：

```typescript
// main.ts（Vue3 Demo）

// ① web-vitals 库实现（生产推荐，Google 官方算法，代码简洁）
import { init, createErrorPlugin, createWebVitalsPlugin } from '@monitor/browser'

// ② 原生 PerformanceObserver 实现（无依赖，适合教学与深度定制）
// import { init, createErrorPlugin, createPerformancePlugin } from '@monitor/browser'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'my-app',
  plugins: [
    createErrorPlugin(),

    createWebVitalsPlugin(),    // ← 只改这一行就完成了实现切换
    // createPerformancePlugin(),  // ← 两者 payload 结构完全相同，后端无需改动
  ],
})
```

> 💡 **插件设计的好处**
>
> 外部调用方（`main.ts`、后端接口、数据看板）**完全不知道** performance 插件内部是用原生 API 还是第三方库实现的。  
> 只要 `name`、`payload` 结构相同，切换实现不需要改任何其他代码——这就是插件模式的价值所在。
>
> - 教学环节：先讲原生 PerformanceObserver，理解底层原理
> - 生产建议：换用 `createWebVitalsPlugin()`，减少维护负担，精度更高

---

## 8.6 资源加载性能采集（`getEntriesByType('resource')`）

除了页面级别的指标，还可以采集各个资源（JS、CSS、图片、API 接口）的加载耗时：

```typescript
// 在 load 事件后获取所有资源的加载时序
addEventListener('load', () => {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  
  resources
    .filter(r => r.duration > 500)  // 只关注超过 500ms 的慢资源
    .forEach(r => {
      console.log({
        name: r.name,                                      // 资源 URL
        type: r.initiatorType,                             // 'script' / 'img' / 'fetch' 等
        duration: Math.round(r.duration),                  // 总耗时（ms）
        ttfb: Math.round(r.responseStart - r.fetchStart),  // 资源的首字节时间
      })
    })
}, { once: true })
```

> ⚠️ **课程深度说明**
>
> 资源加载性能数据量很大（一个页面可能有几十上百个资源），本 SDK **暂不默认采集**，由 `createPerformancePlugin` 的 `options` 预留扩展接入点。
> 生产场景可按需开启，或只采集 `duration > 阈值` 的慢资源。

---

## 8.7 Lighthouse 实战：解读 Performance 面板

> ⚠️ **课程深度说明**：本节为工具使用演示，不深入 Lighthouse 评分算法细节。

打开 Chrome DevTools → Lighthouse 标签 → 勾选 Performance → 生成报告。

报告中关键部分：

```
Performance Score: 67
     ↓
Metrics（指标）：
  First Contentful Paint      1.2 s   🟢
  Largest Contentful Paint    3.8 s   🔴   ← 需要优化
  Total Blocking Time           0 ms  🟢
  Cumulative Layout Shift    0.014    🟢
  Speed Index                 1.2 s   🟢
     ↓
Opportunities（优化机会）：
  Reduce unused JavaScript        Potential savings: 450 KiB
  Serve images in next-gen formats
     ↓
Diagnostics（诊断信息）：
  Avoid enormous network payloads
  Minimize main-thread work
```

### 如何用 SDK 数据验证 Lighthouse 结论

Lighthouse 是在受控实验室环境中运行的（单个用户，固定网络），而 SDK 采集的是**真实用户的数据（RUM）**。

两者结合使用才能看全貌：
- Lighthouse 发现问题（在实验室中复现）
- SDK 数据验证规模（多少真实用户受到影响）

> 📖 **术语：RUM（Real User Monitoring，真实用户监控）**
>
> 白话：从真实用户的浏览器里采集数据，而不是用模拟工具测试。你的监控 SDK 采集的就是 RUM 数据。
> 术语：RUM 与 Synthetic Monitoring（合成监控，如 Lighthouse）相对，前者反映真实分布，后者用于发现和复现问题。

---

## 8.8 将性能采集封装为独立的 Plugin

### 插件设计回顾

与错误插件的设计保持一致：**工厂函数返回 Plugin 对象**，`setup()` 注册监听器，`teardown()` 统一清理。

```typescript
// packages/browser/src/plugins/performance.ts

export interface PerformancePluginOptions {
  vitals?: boolean       // Core Web Vitals（FCP/LCP/CLS/INP/TTFB），默认 true
  navigation?: boolean   // 页面导航时序，默认 true
}

export function createPerformancePlugin(options?: PerformancePluginOptions): Plugin {
  return {
    name: 'performance',
    setup(monitor) { /* 注册所有 PerformanceObserver */ },
    teardown() { /* 断开所有 PerformanceObserver */ },
  }
}
```

### 新增的类型定义（`packages/core/src/types.ts`）

```typescript
// Core Web Vitals 指标载荷
interface PerformanceMetricPayload {
  subType: 'web-vital'
  metric: 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  navigationType: string    // navigate / reload / back_forward / prerender
}

// 页面导航时序载荷
interface NavigationTimingPayload {
  subType: 'navigation-timing'
  dns: number           // DNS 解析耗时（ms）
  tcp: number           // TCP 连接耗时（ms）
  ssl: number           // SSL 握手耗时（ms，非 HTTPS 为 0）
  ttfb: number          // Time to First Byte（ms）
  download: number      // 响应下载耗时（ms）
  domInteractive: number // DOM 可交互时间（ms，从 fetchStart 起算）
  domComplete: number   // DOM 完成解析时间（ms）
  loadTime: number      // 完整加载时间（ms）
}

type PerformancePayload = PerformanceMetricPayload | NavigationTimingPayload
```

> 🏗️ **架构思考：为什么设计两个 subType 而不是一个大的 payload？**
>
> - `web-vital`：每个指标独立上报，数据库按 metric 字段建索引，方便按指标查询和聚合
> - `navigation-timing`：一次性上报页面加载的所有阶段，是完整的快照，适合整体分析
>
> 把两类数据混在一个结构里会让后端处理逻辑和查询 SQL 变复杂。分开设计，每种数据结构清晰、独立演进。

### 接入方式（只需在 main.ts / main.tsx 添加一行）

**两种插件均已导出，接口完全一致，可随时互换：**

```typescript
// main.ts（Vue3 Demo）
import {
  init,
  createErrorPlugin,
  createWebVitalsPlugin,    // 方案一：web-vitals 库（生产推荐）
  // createPerformancePlugin, // 方案二：原生 PerformanceObserver（教学用）
} from '@monitor/browser'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'my-app',
  debug: true,
  plugins: [
    createErrorPlugin(),
    createWebVitalsPlugin(),           // ← 替换为 createPerformancePlugin() 效果相同
    // 按需定制：
    // createWebVitalsPlugin({ navigation: false })  // 只采集 Web Vitals
    // createWebVitalsPlugin({ vitals: false })       // 只采集导航时序
  ],
})
```

---

## 本章实操步骤

### 前置条件

- 已完成第 07 章代码（或使用本章 `代码/` 快照）
- 在 `08.SDK 采集——页面性能指标/代码/monitor/` 目录下操作

### 步骤 1：新增性能载荷类型

在 `packages/core/src/types.ts` 末尾添加 `PerformanceMetricPayload`、`NavigationTimingPayload`、`PerformancePayload`。

### 步骤 2：从 core 导出新类型

在 `packages/core/src/index.ts` 中补充导出：

```typescript
export type {
  PerformanceMetricPayload,
  NavigationTimingPayload,
  PerformancePayload,
} from './types'
```

### 步骤 3：创建性能采集插件（两种实现）

**方案一（原生实现，教学用）**：新建 `packages/browser/src/plugins/performance.ts`，实现 `createPerformancePlugin()`，用原生 PerformanceObserver 手动处理 FCP/LCP/CLS/INP/TTFB。

**方案二（web-vitals，生产推荐）**：先安装依赖，再新建 `packages/browser/src/plugins/performance-web-vitals.ts`，实现 `createWebVitalsPlugin()`：

```bash
# 只在 @monitor/browser 包内安装
pnpm add web-vitals --filter @monitor/browser
```

```typescript
// 核心实现只需 5 行（相比原生的 ~250 行）
import { onFCP, onLCP, onCLS, onINP, onTTFB } from 'web-vitals'

setup(monitor) {
  onFCP((m) => monitor.capture('performance', { subType: 'web-vital', metric: 'FCP', value: Math.round(m.value), rating: m.rating, navigationType: m.navigationType }))
  onLCP((m) => monitor.capture('performance', { subType: 'web-vital', metric: 'LCP', value: Math.round(m.value), rating: m.rating, navigationType: m.navigationType }))
  onCLS((m) => monitor.capture('performance', { subType: 'web-vital', metric: 'CLS', value: Math.round(m.value * 10000) / 10000, rating: m.rating, navigationType: m.navigationType }))
  onINP((m) => monitor.capture('performance', { subType: 'web-vital', metric: 'INP', value: Math.round(m.value), rating: m.rating, navigationType: m.navigationType }))
  onTTFB((m) => monitor.capture('performance', { subType: 'web-vital', metric: 'TTFB', value: Math.round(m.value), rating: m.rating, navigationType: m.navigationType }))
}
```

### 步骤 4：从 browser 包导出两种插件

在 `packages/browser/src/index.ts` 中补充：

```typescript
// 方案一：原生 PerformanceObserver 实现
export { createPerformancePlugin } from './plugins/performance'
export type { PerformancePluginOptions } from './plugins/performance'
// 方案二：web-vitals 库实现
export { createWebVitalsPlugin } from './plugins/performance-web-vitals'
export type { WebVitalsPluginOptions } from './plugins/performance-web-vitals'
// 共用类型
export type { PerformanceMetricPayload, NavigationTimingPayload, PerformancePayload } from '@monitor/core'
```

### 步骤 5：在 demos 中接入

**vue3-demo**（`demos/vue3-demo/src/main.ts`）和 **react-demo**（`demos/react-demo/src/main.tsx`）：

```typescript
// 当前使用 web-vitals 插件（注释换一行即可切换到原生实现）
import { init, createErrorPlugin, createWebVitalsPlugin } from '@monitor/browser'
// import { init, createErrorPlugin, createPerformancePlugin } from '@monitor/browser'

const monitor = init({
  plugins: [
    createErrorPlugin(),
    createWebVitalsPlugin(),     // 替换为 createPerformancePlugin() 效果完全相同
    // createPerformancePlugin(), // ← 注释切换
  ],
  // ...
})
```

### 步骤 6：验证

```bash
# 验证构建（需全部 10 个任务成功）
pnpm build

# 启动 demo 观察控制台输出
pnpm --filter @monitor/vue3-demo dev
# 或
pnpm --filter @monitor/react-demo dev
```

---

## 本章验证：控制台预期输出

启动 vue3-demo 或 react-demo，打开浏览器控制台，几秒内应看到：

```
# FCP（页面首次绘制后立即上报）
[Monitor] capture | type=performance {
  payload: { subType: 'web-vital', metric: 'FCP', value: 312, rating: 'good', navigationType: 'navigate' }
}

# TTFB（DOM 加载完成后上报）
[Monitor] capture | type=performance {
  payload: { subType: 'web-vital', metric: 'TTFB', value: 4, rating: 'good', navigationType: 'navigate' }
}

# Navigation Timing（load 事件后上报完整时序）
[Monitor] capture | type=performance {
  payload: {
    subType: 'navigation-timing',
    dns: 0, tcp: 0, ssl: 0, ttfb: 4,
    download: 2, domInteractive: 285, domComplete: 310, loadTime: 311
  }
}

# LCP（用户点击或切换标签页后上报最终值）
[Monitor] capture | type=performance {
  payload: { subType: 'web-vital', metric: 'LCP', value: 318, rating: 'good', navigationType: 'navigate' }
}

# CLS / INP（切换标签页后上报，触发 triggerLayoutShift 后 CLS > 0）
[Monitor] capture | type=performance {
  payload: { subType: 'web-vital', metric: 'CLS', value: 0.0312, rating: 'good', navigationType: 'navigate' }
}
```

---

## 本章要点总结

| 知识点 | 核心结论 |
|--------|----------|
| Core Web Vitals | 用 5 个指标量化用户感知，Google 官方标准，影响 SEO |
| FCP / TTFB | 页面加载后立即上报，无需等待用户交互 |
| LCP | 等待首次用户交互或 visibilitychange 后上报最终值 |
| CLS | Session Window 算法累积，visibilitychange 时上报 |
| INP | 2024 替代 FID，测量所有交互的响应延迟 |
| `buffered: true` | 确保 SDK 初始化晚于指标产生时也能采集到历史数据 |
| Navigation Timing | 一次性快照，在 load 事件后读取，覆盖 DNS/TCP/TTFB 等全阶段 |
| 插件设计 | 与错误插件保持一致：工厂函数 + setup/teardown 生命周期 |

---

## 下一章预告

第 09 章将实现**用户行为与埋点采集**：
- PV/UV 统计
- SPA 路由变更监听（pushState / popstate 劫持）
- 点击行为采集（事件委托）
- Vue Router / React Router 适配
