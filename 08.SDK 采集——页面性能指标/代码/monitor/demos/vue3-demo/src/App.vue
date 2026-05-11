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

    <p class="tip">
      ⓘ 控制台预期输出：<br />
      <code>subType: 'js'</code> — JS 运行时错误　
      <code>subType: 'resource'</code> — 资源加载失败<br />
      <code>subType: 'promise'</code> — Promise 未捕获异常　
      <code>subType: 'vue'</code> — Vue 框架层错误<br />
      <code>subType: 'web-vital'</code> — Core Web Vitals 指标　
      <code>subType: 'navigation-timing'</code> — 导航时序
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, defineComponent, h } from 'vue'
import { capture, MONITOR_VERSION } from '@monitor/browser'
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
