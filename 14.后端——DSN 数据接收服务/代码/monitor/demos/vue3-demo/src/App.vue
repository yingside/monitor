<template>
  <div class="container">
    <h1>Vue3 Demo</h1>
    <p class="subtitle">Monitor SDK v{{ version }}</p>
    <p class="hint">打开浏览器控制台，点击下方按钮，观察 SDK 数据管道输出</p>

    <!-- JS 错误 & 资源加载错误 -->
    <section class="section">
      <h2 class="section-title">🔴 无痕采集——JS 错误 & 资源错误</h2>
      <p class="section-desc">触发真实的 JS 错误 / 资源加载失败，由 createErrorPlugin 自动捕获</p>
      <div class="actions">
        <button class="btn btn-danger" @click="triggerJsError">触发 ReferenceError</button>
        <button class="btn btn-danger" @click="triggerTypeError">触发 TypeError</button>
        <button class="btn btn-danger" @click="triggerBadImage">加载不存在的图片</button>
        <button class="btn btn-danger" @click="triggerBadScript">加载不存在的脚本</button>
      </div>
    </section>

    <!-- Promise 未捕获异常 -->
    <section class="section">
      <h2 class="section-title">🟠 无痕采集——Promise 未捕获异常</h2>
      <p class="section-desc">触发 unhandledrejection 事件，对应 Promise reject 后没有任何处理的场景</p>
      <div class="actions">
        <button class="btn btn-warning" @click="triggerPromiseReject">Promise.reject（无 catch）</button>
        <button class="btn btn-warning" @click="triggerAsyncThrow">async 函数 throw（无 await try-catch）</button>
        <button class="btn btn-warning" @click="triggerPromiseRejectDedupTest">去重测试（连续触发同一错误）</button>
      </div>
    </section>

    <!-- Vue 框架层错误 -->
    <section class="section">
      <h2 class="section-title">🟣 框架层错误——Vue errorHandler 捕获</h2>
      <p class="section-desc">
        在 Vue 组件的 setup() / 生命周期 / 渲染函数中抛出的错误，由 createMonitorVue 接管并上报
      </p>
      <div class="actions">
        <button class="btn btn-purple" @click="triggerVueSetupError">setup() 中抛出错误</button>
        <button class="btn btn-purple" @click="showBrokenComponent = true">渲染出错的子组件</button>
        <button v-if="showBrokenComponent" class="btn" @click="showBrokenComponent = false">
          隐藏出错组件
        </button>
      </div>
      <BrokenComponent v-if="showBrokenComponent" />
    </section>

    <!-- 性能指标采集 -->
    <section class="section">
      <h2 class="section-title">🟢 自动采集——Core Web Vitals & 导航时序</h2>
      <p class="section-desc">
        createPerformancePlugin 已在 main.ts 中注册，页面加载完成后自动上报
        FCP / LCP / TTFB / Navigation Timing；页面隐藏时上报 CLS / INP
      </p>
      <div class="actions">
        <button class="btn btn-green" @click="triggerLayoutShift">触发布局偏移（CLS）</button>
        <button class="btn btn-green" @click="triggerLongTask">触发长任务（影响 INP）</button>
      </div>
      <p class="section-desc" style="margin-top: 0.75rem; margin-bottom: 0;">
        ℹ️ 切换标签页 / 小化窗口可触发 visibilitychange，观察 CLS / INP 上报
      </p>
    </section>

    <!-- 手动埋点 -->
    <section class="section">
      <h2 class="section-title">🟡 手动埋点（代码埋点）</h2>
      <p class="section-desc">调用 capture() 手动上报自定义业务异常</p>
      <div class="actions">
        <button class="btn" @click="manualCapture">手动上报业务异常</button>
        <button class="btn" @click="sendBehavior">模拟行为事件 (behavior)</button>
      </div>
    </section>

    <!-- 用户行为采集（第 09 章新增） -->
    <section class="section">
      <h2 class="section-title">🔵 自动采集——用户行为与埋点</h2>
      <p class="section-desc">
        createBehaviorPlugin 已在 main.ts 中注册：<br />
        ① PV 已在页面加载时自动上报；② 点击下方按钮会自动被采集；
        ③ 模拟 SPA 路由跳转会触发 route-change 事件
      </p>
      <div class="actions">
        <button class="btn btn-blue" @click="simulatePushState('/detail/1')">
          模拟跳转 /detail/1
        </button>
        <button class="btn btn-blue" @click="simulatePushState('/detail/2')">
          模拟跳转 /detail/2
        </button>
        <button class="btn btn-blue" @click="simulatePopState">
          模拟浏览器后退
        </button>
      </div>
      <div class="actions" style="margin-top: 0.75rem;">
        <button class="btn btn-blue" data-track @click="trackCustomEvent">
          手动埋点 trackBehavior()
        </button>
        <button class="btn btn-blue" @click="showBreadcrumbs">
          打印当前行为栈（getBreadcrumbs）
        </button>
      </div>
      <p class="section-desc" style="margin-top: 0.75rem; margin-bottom: 0;">
        ℹ️ 所有点击 <code>button / a / input</code> 或含 <code>data-track</code> 属性的元素都会被自动记录
      </p>
    </section>

    <!-- API 请求监控（第 10 章新增） -->
    <section class="section">
      <h2 class="section-title">🟤 自动采集——API 请求监控</h2>
      <p class="section-desc">
        createApiPlugin 已在 main.ts 中注册，自动劫持 XHR 和 Fetch。<br />
        先启动 Mock 服务器：<code>pnpm mock-server</code>（端口 3002），再点击下方按钮触发请求。
      </p>
      <div class="actions">
        <button class="btn btn-brown" @click="fetchUsers">Fetch GET /api/users（成功）</button>
        <button class="btn btn-brown" @click="fetchLogin">Fetch POST /api/login（成功）</button>
        <button class="btn btn-brown" @click="fetchSlow">Fetch GET /api/slow（慢请求 ~1500ms）</button>
        <button class="btn btn-brown" @click="fetchError">Fetch GET /api/error（服务端 500）</button>
      </div>
      <div class="actions" style="margin-top: 0.75rem;">
        <button class="btn btn-brown" @click="xhrUsers">XHR GET /api/users（成功）</button>
        <button class="btn btn-brown" @click="xhrError">XHR GET /api/error（服务端 500）</button>
        <button class="btn btn-brown" @click="fetchNetworkError">Fetch 网络错误（status: 0）</button>
      </div>
      <p class="section-desc" style="margin-top: 0.75rem; margin-bottom: 0;">
        ℹ️ 控制台预期输出：<code>type: 'api'</code>，字段含 <code>subType / method / url / status / duration / success</code>
      </p>
    </section>

    <p class="tip">
      ⓘ 控制台预期输出：<br />
      <code>subType: 'js'</code> — JS 运行时错误　
      <code>subType: 'resource'</code> — 资源加载失败<br />
      <code>subType: 'promise'</code> — Promise 未捕获异常　
      <code>subType: 'vue'</code> — Vue 框架层错误<br />
      <code>subType: 'web-vital'</code> — Core Web Vitals 指标　
      <code>subType: 'navigation-timing'</code> — 导航时序<br />
      <code>subType: 'pv'</code> — 页面访问　
      <code>subType: 'click'</code> — 点击行为　
      <code>subType: 'route-change'</code> — 路由跳转　
      <code>subType: 'custom'</code> — 手动埋点<br />
      <code>subType: 'xhr'</code> — XHR 请求　
      <code>subType: 'fetch'</code> — Fetch 请求<br />
      <br />
      ⓘ 第 11 章新增上报验证：先启动 <code>pnpm collect-server</code>，再操作，观察服务器终端的上报日志
    </p>

    <!-- 第 11 章：上报策略演示 -->
    <section class="section">
      <h2 class="section-title">🔵 第 11 章——上报策略演示</h2>
      <p class="section-desc">
        先启动接收服务：<code>pnpm collect-server</code>（端口 3001）<br />
        采集到的事件不会立刻发出，而是缓存到 Transport 队列。每 5 秒 或 满 10 条时批量上报。<br />
        页面切换 / 关闭时，会用 <code>navigator.sendBeacon</code> 发出最后一批数据。
      </p>
      <div class="actions">
        <button class="btn btn-blue" @click="triggerFlush">立即上报（手动 flush）</button>
        <button class="btn btn-blue" @click="triggerBatchFill">填满批次（连发 10 条）</button>
        <button class="btn btn-blue" @click="checkHealth">检查 collect-server 健康状态</button>
      </div>
      <p class="section-desc" style="margin-top: 0.75rem; margin-bottom: 0;">
        ℹ️ 观察 collect-server 终端：每批数据以 JSON 格式打印，包含完整的 <code>MonitorEvent</code> 字段
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, defineComponent, h } from 'vue'
import { capture, trackBehavior, getBreadcrumbs, flush, MONITOR_VERSION } from '@monitor/browser'
import type { JsErrorPayload } from '@monitor/browser'

// 性能指标采集由 createPerformancePlugin 自动完成，无需手动操作

const version = MONITOR_VERSION
const showBrokenComponent = ref(false)

// ── JS 错误 & 资源错误 ────────────────────────────────────────────────────────

function triggerJsError() {
  setTimeout(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).undefinedFunctionThatDoesNotExist()
  }, 0)
}

function triggerTypeError() {
  setTimeout(() => {
    const obj: null = null
    // @ts-expect-error 故意调用 null 的方法触发 TypeError
    obj.toString()
  }, 0)
}

function triggerBadImage() {
  const img = document.createElement('img')
  img.src = 'http://localhost:9999/not-exist-image.png'
  img.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(img)
  setTimeout(() => img.parentNode?.removeChild(img), 1000)
}

function triggerBadScript() {
  const script = document.createElement('script')
  script.src = 'http://localhost:9999/not-exist-script.js'
  document.head.appendChild(script)
  setTimeout(() => script.parentNode?.removeChild(script), 1000)
}

// ── Promise 未捕获异常 ────────────────────────────────────────────────────────

function triggerPromiseReject() {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  Promise.reject(new Error('模拟 Promise.reject：未捕获的异步错误'))
}

function triggerAsyncThrow() {
  async function fetchData() {
    throw new Error('模拟 async throw：接口请求失败 (500 Internal Server Error)')
  }
  // 故意不加 await，让 Promise 悄悄 reject
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  fetchData()
}

function triggerPromiseRejectDedupTest() {
  const count = 5
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.reject(new Error('去重测试：相同错误'))
  }
  console.info(`[Demo] 触发了 ${count} 次相同 Promise 错误，SDK 去重后预期只上报 1 次`)
}

// ── Vue 框架层错误 ────────────────────────────────────────────────────────────

function triggerVueSetupError() {
  throw new Error('模拟 Vue 事件处理器错误：购物车结算失败')
}

const BrokenComponent = defineComponent({
  name: 'BrokenComponent',
  setup() {
    throw new Error('模拟 Vue 渲染错误：BrokenComponent setup() 抛出异常')
  },
  render() {
    return h('div', '这里不会被渲染')
  },
})

// ── 手动埋点 ──────────────────────────────────────────────────────────────────

function manualCapture() {
  const payload: JsErrorPayload = {
    subType: 'js',
    message: '手动埋点：业务异常 - 支付接口返回错误码 PAY_FAILED',
    filename: 'App.vue',
    lineno: 0,
    colno: 0,
    stack: '',
    errorType: 'BusinessError',
  }
  capture('error', payload)
}

function sendBehavior() {
  capture('behavior', {
    action: 'click',
    target: '模拟行为事件按钮',
    page: location.href,
  })
}

// 触发布局偏移：动态插入一个占位元素再移除，产生可观测的 CLS
function triggerLayoutShift() {
  const div = document.createElement('div')
  div.style.cssText = 'height:80px;background:#0066cc20;border-radius:8px;margin:8px 0;transition:none'
  div.textContent = '布局偏移元素（此块会导致 CLS 增加）'
  const container = document.querySelector('.container')
  container?.insertBefore(div, container.firstChild)
  setTimeout(() => div.parentNode?.removeChild(div), 1500)
  console.info('[Demo] 已触发布局偏移，切换标签页可观察 CLS 上报')
}

// 触发长任务：占用主线程 ~200ms，模拟高 CPU 负载场景下的交互响应延迟
function triggerLongTask() {
  const start = Date.now()
  // eslint-disable-next-line no-empty
  while (Date.now() - start < 200) { /* 故意占用主线程 */ }
  console.info('[Demo] 长任务执行完成（~200ms），此期间点击不响应将记入 INP')
}

// ── 用户行为采集（第 09 章新增）─────────────────────────────────────────────

/**
 * 模拟 SPA 路由跳转（history.pushState）
 * Vue Router / React Router 底层都会调用这个 API，
 * behavior 插件劫持了它，所以能捕获到路由变化
 */
function simulatePushState(path: string) {
  history.pushState({}, '', path)
  console.info(`[Demo] 触发 history.pushState → ${path}，观察 subType: 'route-change' 输出`)
}

/** 模拟浏览器后退（popstate 事件） */
function simulatePopState() {
  history.back()
  console.info('[Demo] 调用 history.back()，观察 subType: \'route-change\' 输出')
}

/** 手动代码埋点示例 */
function trackCustomEvent() {
  trackBehavior('add_to_cart', { productId: 'SKU_001', price: 299, quantity: 2 })
  console.info('[Demo] trackBehavior() 调用完成，观察 subType: \'custom\' 输出')
}

/** 打印当前行为栈快照 */
function showBreadcrumbs() {
  const crumbs = getBreadcrumbs()
  console.group('[Monitor] 当前行为栈（Breadcrumbs）')
  crumbs.forEach((c, i) => console.log(`  [${i}]`, c))
  console.groupEnd()
}

// ── API 请求监控（第 10 章新增）──────────────────────────────────────────────

const MOCK_BASE = 'http://localhost:3002'

/** Fetch GET /api/users — 正常成功请求 */
async function fetchUsers() {
  try {
    const res = await fetch(`${MOCK_BASE}/api/users`)
    const data = await res.json()
    console.info('[Demo] Fetch GET /api/users 响应：', data)
  } catch (e) {
    console.warn('[Demo] 请先启动 mock-server：pnpm mock-server', e)
  }
}

/** Fetch POST /api/login — 带 body 的 POST 请求 */
async function fetchLogin() {
  try {
    const res = await fetch(`${MOCK_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: '123456' }),
    })
    const data = await res.json()
    console.info('[Demo] Fetch POST /api/login 响应：', data)
  } catch (e) {
    console.warn('[Demo] 请先启动 mock-server：pnpm mock-server', e)
  }
}

/** Fetch GET /api/slow — 慢请求，观察 duration 字段 */
async function fetchSlow() {
  console.info('[Demo] 发起慢请求，预计 ~1500ms 后收到响应...')
  try {
    const res = await fetch(`${MOCK_BASE}/api/slow`)
    const data = await res.json()
    console.info('[Demo] Fetch GET /api/slow 响应：', data)
  } catch (e) {
    console.warn('[Demo] 请先启动 mock-server：pnpm mock-server', e)
  }
}

/** Fetch GET /api/error — 服务端 500，success: false */
async function fetchError() {
  try {
    const res = await fetch(`${MOCK_BASE}/api/error`)
    const data = await res.json()
    console.info('[Demo] Fetch GET /api/error 响应（500）：', data)
  } catch (e) {
    console.warn('[Demo] 请先启动 mock-server：pnpm mock-server', e)
  }
}

/** XHR GET /api/users — 用原始 XHR 发请求，演示 subType: 'xhr' */
function xhrUsers() {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', `${MOCK_BASE}/api/users`)
  xhr.onload = () => {
    console.info('[Demo] XHR GET /api/users 响应：', JSON.parse(xhr.responseText))
  }
  xhr.onerror = () => {
    console.warn('[Demo] XHR 网络错误，请先启动 mock-server：pnpm mock-server')
  }
  xhr.send()
}

/** XHR GET /api/error — XHR 服务端 500，success: false */
function xhrError() {
  const xhr = new XMLHttpRequest()
  xhr.open('GET', `${MOCK_BASE}/api/error`)
  xhr.onload = () => {
    console.info('[Demo] XHR GET /api/error 响应（500）：', JSON.parse(xhr.responseText))
  }
  xhr.onerror = () => {
    console.warn('[Demo] XHR 网络错误，请先启动 mock-server：pnpm mock-server')
  }
  xhr.send()
}

/** Fetch 网络错误 — 访问不存在的端口，触发 status: 0 */
async function fetchNetworkError() {
  console.info('[Demo] 发起注定失败的请求（端口 19999 不存在），触发网络错误采集...')
  try {
    await fetch('http://localhost:19999/api/unreachable')
  } catch {
    console.info('[Demo] 网络错误已触发，观察控制台 status: 0, success: false')
  }
}

// ── 第 11 章：上报策略演示 ────────────────────────────────────────────────────

/**
 * 手动立即上报
 *
 * 调用 flush() 后，Transport 会立刻把队列里所有事件 POST 到 collect-server，
 * 无需等待 5 秒的定时器。
 */
function triggerFlush() {
  // 先采集一条手动埋点事件，确保队列里有数据
  capture('behavior', {
    subType: 'custom',
    name: 'manual_flush_test',
    extra: { trigger: 'button_click', timestamp: Date.now() },
  })
  flush()
  console.info('[Demo] 调用 flush()，队列事件已立即发往 collect-server（http://localhost:3001/collect）')
}

/**
 * 填满批次，触发"满了就发"策略
 *
 * 连发 10 条自定义事件，达到 maxBatchSize(10) 后 Transport 会立即触发 fetch，
 * 不用等 5 秒定时器。可以在 collect-server 终端观察到立刻收到这批数据。
 */
function triggerBatchFill() {
  for (let i = 0; i < 10; i++) {
    capture('behavior', {
      subType: 'custom',
      name: 'batch_fill_test',
      extra: { index: i },
    })
  }
  console.info('[Demo] 已发送 10 条事件，达到 maxBatchSize 上限，Transport 应立即触发批量上报')
}

/**
 * 检查 collect-server 健康状态
 */
async function checkHealth() {
  try {
    const res = await fetch('http://localhost:3001/health')
    const data = await res.json()
    console.info('[Demo] collect-server 健康检查：', data)
  } catch {
    console.warn('[Demo] collect-server 未启动，请先运行：pnpm collect-server')
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, sans-serif;
  background: #fff;
  color: #1d1d1f;
  padding: 2rem;
  gap: 1.5rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  color: #6e6e73;
  font-size: 1rem;
  margin: 0;
}

.hint {
  color: #0066cc;
  font-size: 0.875rem;
  margin: 0;
}

.section {
  width: 100%;
  max-width: 560px;
  background: #f5f5f7;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.4rem;
}

.section-desc {
  font-size: 0.8rem;
  color: #6e6e73;
  margin: 0 0 1rem;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  border: 1px solid #d2d2d7;
  background: #fff;
  color: #1d1d1f;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn:hover { background: #e8e8ed; }

.btn-danger { border-color: #ff3b30; color: #ff3b30; }
.btn-danger:hover { background: #fff1f0; }

.btn-warning { border-color: #ff9500; color: #ff9500; }
.btn-warning:hover { background: #fff8ee; }

.btn-purple { border-color: #6a5fc1; color: #6a5fc1; }
.btn-purple:hover { background: #f3f0ff; }

.btn-green { border-color: #34c759; color: #34c759; }
.btn-green:hover { background: #f0fff4; }

.btn-blue { border-color: #0066cc; color: #0066cc; }
.btn-blue:hover { background: #f0f4ff; }

.btn-brown { border-color: #8B5CF6; color: #8B5CF6; }
.btn-brown:hover { background: #f5f0ff; }

.tip {
  font-size: 0.8rem;
  color: #6e6e73;
  max-width: 560px;
  text-align: center;
  line-height: 2;
}

code {
  background: #f5f5f7;
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 0.85em;
  color: #1d1d1f;
}
</style>
