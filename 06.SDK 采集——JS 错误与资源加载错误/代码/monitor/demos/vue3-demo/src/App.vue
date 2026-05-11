<template>
  <div class="container">
    <h1>Vue3 Demo</h1>
    <p class="subtitle">Monitor SDK v{{ version }}</p>
    <p class="hint">打开浏览器控制台，点击下方按钮，观察 SDK 数据管道输出</p>

    <!-- 第 06 章：错误采集验证 -->
    <section class="section">
      <h2 class="section-title">🔴 无痕采集（自动捕获）</h2>
      <p class="section-desc">以下按钮会触发真实的 JS 错误 / 资源加载失败，由 createErrorPlugin 自动捕获，无需手动调用 capture()</p>
      <div class="actions">
        <button class="btn btn-danger" @click="triggerJsError">
          触发 JS 运行时错误
        </button>
        <button class="btn btn-danger" @click="triggerTypeError">
          触发 TypeError
        </button>
        <button class="btn btn-danger" @click="triggerBadImage">
          加载不存在的图片
        </button>
        <button class="btn btn-danger" @click="triggerBadScript">
          加载不存在的脚本
        </button>
      </div>
    </section>

    <!-- 手动埋点区域 -->
    <section class="section">
      <h2 class="section-title">🟡 手动埋点（代码埋点）</h2>
      <p class="section-desc">以下按钮调用 capture() 手动上报自定义业务异常，适合需要精确控制上报内容的场景</p>
      <div class="actions">
        <button class="btn" @click="manualCapture">
          手动上报业务异常
        </button>
        <button class="btn" @click="sendBehavior">
          模拟行为事件 (behavior)
        </button>
        <button class="btn" @click="sendPerf">
          模拟性能事件 (performance)
        </button>
      </div>
    </section>

    <p class="tip">
      ⓘ 控制台应出现 <code>[Monitor] capture | type=error</code> 日志，<br />
      <code>subType: 'js'</code> 表示 JS 运行时错误，<code>subType: 'resource'</code> 表示资源加载失败。<br />
      Promise 异常（unhandledrejection）和框架层错误将在第 07 章接入。
    </p>
  </div>
</template>

<script setup lang="ts">
import { capture, MONITOR_VERSION } from '@monitor/browser'
import type { JsErrorPayload } from '@monitor/browser'

const version = MONITOR_VERSION

// ── 无痕采集演示 ────────────────────────────────────────────────────────────

/**
 * 触发 ReferenceError：访问未定义的变量
 * 使用 setTimeout 确保错误在当前调用栈之外抛出，
 * 能够被 window.addEventListener('error') 稳定捕获
 */
function triggerJsError() {
  setTimeout(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).undefinedFunctionThatDoesNotExist()
  }, 0)
}

/**
 * 触发 TypeError：对 null 调用方法
 */
function triggerTypeError() {
  setTimeout(() => {
    const obj: null = null
    // @ts-expect-error 故意调用 null 的方法触发 TypeError
    obj.toString()
  }, 0)
}

/**
 * 加载一个不存在的图片 URL，触发资源 error 事件
 * 图片不会渲染（opacity: 0），仅用于触发错误
 */
function triggerBadImage() {
  const img = document.createElement('img')
  img.src = 'http://localhost:9999/not-exist-image.png'
  img.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(img)
  // 1 秒后移除，保持 DOM 干净
  setTimeout(() => img.parentNode?.removeChild(img), 1000)
}

/**
 * 加载一个不存在的 JS 文件，触发 <script> 的 error 事件
 */
function triggerBadScript() {
  const script = document.createElement('script')
  script.src = 'http://localhost:9999/not-exist-script.js'
  document.head.appendChild(script)
  setTimeout(() => script.parentNode?.removeChild(script), 1000)
}

// ── 手动埋点演示 ────────────────────────────────────────────────────────────

/**
 * 手动上报：模拟业务逻辑中的自定义异常
 * 场景示例：用户提交表单时，接口返回业务错误码，手动上报到监控系统
 */
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

function sendPerf() {
  capture('performance', {
    metric: 'FCP',
    value: 850,
    unit: 'ms',
  })
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
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6e6e73;
  font-size: 1rem;
}

.hint {
  color: #0066cc;
  font-size: 0.875rem;
  margin-top: 0.5rem;
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

.btn:hover {
  background: #e8e8ed;
}

.btn-danger {
  border-color: #ff3b30;
  color: #ff3b30;
}

.btn-danger:hover {
  background: #fff1f0;
}

.tip {
  font-size: 0.8rem;
  color: #6e6e73;
  max-width: 560px;
  text-align: center;
  line-height: 1.8;
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
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6e6e73;
  font-size: 1rem;
}

.hint {
  color: #0066cc;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  border: 1px solid #d2d2d7;
  background: #f5f5f7;
  color: #1d1d1f;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn:hover {
  background: #e8e8ed;
}

.tip {
  font-size: 0.8rem;
  color: #6e6e73;
  max-width: 480px;
  text-align: center;
  line-height: 1.6;
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
