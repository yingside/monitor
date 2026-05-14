import React, { useState } from 'react'
import { capture, trackBehavior, getBreadcrumbs, flush, MONITOR_VERSION } from '@monitor/browser'
import type { JsErrorPayload } from '@monitor/browser'

// ─────────────────────────────────────────────────────────────────────────────
// 样式常量（Apple 风格：极简 / 留白 / 无多余装饰）
// ─────────────────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  background: '#f5f5f7',
  borderRadius: 12,
  padding: '1.25rem 1.5rem',
}

const baseBtn: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  borderRadius: 8,
  border: '1px solid #d2d2d7',
  background: '#fff',
  color: '#1d1d1f',
  fontSize: '0.875rem',
  cursor: 'pointer',
}

const dangerBtn: React.CSSProperties = { ...baseBtn, border: '1px solid #ff3b30', color: '#ff3b30' }
const warningBtn: React.CSSProperties = { ...baseBtn, border: '1px solid #ff9500', color: '#ff9500' }
const purpleBtn: React.CSSProperties = { ...baseBtn, border: '1px solid #6a5fc1', color: '#6a5fc1' }
const greenBtn: React.CSSProperties = { ...baseBtn, border: '1px solid #34c759', color: '#34c759' }
const blueBtn: React.CSSProperties = { ...baseBtn, border: '1px solid #0066cc', color: '#0066cc' }
const violetBtn: React.CSSProperties = { ...baseBtn, border: '1px solid #8B5CF6', color: '#8B5CF6' }

const codeStyle: React.CSSProperties = {
  background: '#f5f5f7',
  padding: '0.1em 0.4em',
  borderRadius: 4,
  fontFamily: 'Menlo, Monaco, monospace',
  fontSize: '0.85em',
  color: '#1d1d1f',
}

// ─────────────────────────────────────────────────────────────────────────────
// 渲染时会抛错的子组件（演示 React ErrorBoundary 捕获）
// ─────────────────────────────────────────────────────────────────────────────

function BrokenComponent(): React.ReactElement {
  throw new Error('模拟 React 渲染错误：BrokenComponent render 阶段抛出异常')
}

// ─────────────────────────────────────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [showBroken, setShowBroken] = useState(false)

  // ── JS 错误 & 资源错误 ──────────────────────────────────────────────────
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

  // ── Promise 未捕获异常 ──────────────────────────────────────────────────
  function triggerPromiseReject() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.reject(new Error('模拟 Promise.reject：未捕获的异步错误'))
  }

  function triggerAsyncThrow() {
    async function fetchData() {
      throw new Error('模拟 async throw：接口请求失败 (500 Internal Server Error)')
    }
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

  // ── 手动埋点 ────────────────────────────────────────────────────────────
  function manualCapture() {
    const payload: JsErrorPayload = {
      subType: 'js',
      message: '手动埋点：业务异常 - 支付接口返回错误码 PAY_FAILED',
      filename: 'App.tsx',
      lineno: 0,
      colno: 0,
      stack: '',
      errorType: 'BusinessError',
    }
    capture('error', payload)
  }

  function sendBehavior() {
    capture('behavior', { action: 'click', target: '模拟行为事件按钮', page: location.href })
  }

  // ── 性能指标演示 ─────────────────────────────────────────────────────────
  // 触发布局偏移：动态插入再删除一个占位元素，产生可观测的 CLS
  function triggerLayoutShift() {
    const div = document.createElement('div')
    div.style.cssText =
      'height:80px;background:#0066cc20;border-radius:8px;margin:8px 0;padding:12px;font-size:14px;color:#0066cc'
    div.textContent = '布局偏移元素（此块会导致 CLS 增加）'
    const root = document.getElementById('root')
    root?.insertBefore(div, root.firstChild)
    setTimeout(() => div.parentNode?.removeChild(div), 1500)
    console.info('[Demo] 已触发布局偏移，切换标签页可观察 CLS 上报')
  }

  // 触发长任务：占用主线程 ~200ms，模拟高 CPU 负载下的交互响应延迟
  function triggerLongTask() {
    const start = Date.now()
    // eslint-disable-next-line no-empty
    while (Date.now() - start < 200) { /* 故意占用主线程 */ }
    console.info('[Demo] 长任务执行完成（~200ms），此期间点击不响应将记入 INP')
  }

  // ── 用户行为采集（第 09 章新增）──────────────────────────────────────────

  /** 模拟 SPA 路由跳转（history.pushState） */
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

  // ── API 请求监控（第 10 章新增）──────────────────────────────────────────

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

  /** XHR GET /api/error — XHR 服务端 500 */
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

  // ── 第 11 章：上报策略演示 ──────────────────────────────────────────────

  function triggerFlush() {
    capture('behavior', {
      subType: 'custom',
      name: 'manual_flush_test',
      extra: { trigger: 'button_click', timestamp: Date.now() },
    })
    flush()
    console.info('[Demo] 调用 flush()，队列事件已立即发往 collect-server（http://localhost:3001/collect）')
  }

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

  async function checkHealth() {
    try {
      const res = await fetch('http://localhost:3001/health')
      const data = await res.json()
      console.info('[Demo] collect-server 健康检查：', data)
    } catch {
      console.warn('[Demo] collect-server 未启动，请先运行：pnpm collect-server')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1d1d1f',
        padding: '2rem',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>React Demo</h1>
      <p style={{ color: '#6e6e73', fontSize: '1rem', margin: 0 }}>
        Monitor SDK v{MONITOR_VERSION}
      </p>
      <p style={{ color: '#0066cc', fontSize: '0.875rem', margin: 0 }}>
        打开浏览器控制台，点击下方按钮，观察 SDK 数据管道输出
      </p>

      {/* JS 错误 & 资源错误 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🔴 无痕采集——JS 错误 & 资源错误
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 1rem', lineHeight: 1.5 }}>
          触发真实的 JS 错误 / 资源加载失败，由 createErrorPlugin 自动捕获
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button style={dangerBtn} onClick={triggerJsError}>触发 ReferenceError</button>
          <button style={dangerBtn} onClick={triggerTypeError}>触发 TypeError</button>
          <button style={dangerBtn} onClick={triggerBadImage}>加载不存在的图片</button>
          <button style={dangerBtn} onClick={triggerBadScript}>加载不存在的脚本</button>
        </div>
      </div>

      {/* Promise 未捕获异常 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🟠 无痕采集——Promise 未捕获异常
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 1rem', lineHeight: 1.5 }}>
          触发 unhandledrejection 事件，对应 Promise reject 后没有任何处理的场景
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button style={warningBtn} onClick={triggerPromiseReject}>Promise.reject（无 catch）</button>
          <button style={warningBtn} onClick={triggerAsyncThrow}>async 函数 throw（无 try-catch）</button>
          <button style={warningBtn} onClick={triggerPromiseRejectDedupTest}>去重测试（连续触发）</button>
        </div>
      </div>

      {/* React 框架层错误 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🟣 框架层错误——React ErrorBoundary 捕获
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 1rem', lineHeight: 1.5 }}>
          渲染阶段抛出的错误由外层 MonitorErrorBoundary 捕获并上报，同时展示降级 UI
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <button style={purpleBtn} onClick={() => setShowBroken(true)}>
            渲染出错的子组件
          </button>
          {showBroken && (
            <button style={baseBtn} onClick={() => setShowBroken(false)}>
              重置
            </button>
          )}
        </div>
        {/* 用独立的 try-render 区域演示：子组件错误不蔓延到整个页面 */}
        {showBroken && (
          // 注意：这里内部的 BrokenComponent 会抛错，但外层 main.tsx 的
          // MonitorErrorBoundary 会捕获并展示 fallback，整个页面不崩溃
          <BrokenComponent />
        )}
      </div>

      {/* 性能指标采集 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🟢 自动采集——Core Web Vitals & 导航时序
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
          createPerformancePlugin 已在 main.tsx 注册，页面加载后自动上报
          FCP / LCP / TTFB / Navigation Timing；切换标签页时上报 CLS / INP
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <button style={greenBtn} onClick={triggerLayoutShift}>触发布局偏移（CLS）</button>
          <button style={greenBtn} onClick={triggerLongTask}>触发长任务（影响 INP）</button>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#6e6e73', margin: 0 }}>
          ⓘ 切换标签页 / 最小化窗口可触发 visibilitychange，观察 CLS / INP 上报
        </p>
      </div>

      {/* 手动埋点 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🟡 手动埋点（代码埋点）
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 1rem', lineHeight: 1.5 }}>
          调用 capture() 手动上报自定义业务异常
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button style={baseBtn} onClick={manualCapture}>手动上报业务异常</button>
          <button style={baseBtn} onClick={sendBehavior}>模拟行为事件 (behavior)</button>
        </div>
      </div>

      {/* 用户行为采集（第 09 章新增） */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🔵 自动采集——用户行为与埋点
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
          createBehaviorPlugin 已在 main.tsx 中注册：<br />
          ① PV 已在页面加载时自动上报；② 点击下方按钮会自动被采集；
          ③ 模拟 SPA 路由跳转会触发 route-change 事件
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <button style={blueBtn} onClick={() => simulatePushState('/detail/1')}>
            模拟跳转 /detail/1
          </button>
          <button style={blueBtn} onClick={() => simulatePushState('/detail/2')}>
            模拟跳转 /detail/2
          </button>
          <button style={blueBtn} onClick={simulatePopState}>
            模拟浏览器后退
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* data-track 属性让即使没有默认 interactive 标签的元素也能被采集 */}
          <button style={blueBtn} data-track="true" onClick={trackCustomEvent}>
            手动埋点 trackBehavior()
          </button>
          <button style={blueBtn} onClick={showBreadcrumbs}>
            打印当前行为栈（getBreadcrumbs）
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#6e6e73', margin: '0.75rem 0 0' }}>
          ⓘ 所有点击 <code style={codeStyle}>button / a / input</code> 或含{' '}
          <code style={codeStyle}>data-track</code> 属性的元素都会被自动记录
        </p>
      </div>

      {/* API 请求监控（第 10 章新增） */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🟤 自动采集——API 请求监控
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
          createApiPlugin 已在 main.tsx 中注册，自动劫持 XHR 和 Fetch。<br />
          先启动 Mock 服务器：<code style={codeStyle}>pnpm mock-server</code>（端口 3002），再点击下方按钮触发请求。
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <button style={violetBtn} onClick={fetchUsers}>Fetch GET /api/users（成功）</button>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <button style={violetBtn} onClick={fetchLogin}>Fetch POST /api/login（成功）</button>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <button style={violetBtn} onClick={fetchSlow}>Fetch GET /api/slow（慢请求 ~1500ms）</button>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <button style={violetBtn} onClick={fetchError}>Fetch GET /api/error（服务端 500）</button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button style={violetBtn} onClick={xhrUsers}>XHR GET /api/users（成功）</button>
          <button style={violetBtn} onClick={xhrError}>XHR GET /api/error（服务端 500）</button>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <button style={violetBtn} onClick={fetchNetworkError}>Fetch 网络错误（status: 0）</button>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#6e6e73', margin: '0.75rem 0 0' }}>
          ⓘ 控制台预期输出：<code style={codeStyle}>type: 'api'</code>，
          字段含 <code style={codeStyle}>subType / method / url / status / duration / success</code>
        </p>
      </div>

      <p
        style={{
          fontSize: '0.8rem',
          color: '#6e6e73',
          maxWidth: 560,
          textAlign: 'center',
          lineHeight: 2,
        }}
      >
        ⓘ 控制台预期输出：<br />
        <code style={codeStyle}>subType: 'js'</code> — JS 运行时错误&nbsp;&nbsp;
        <code style={codeStyle}>subType: 'resource'</code> — 资源加载失败<br />
        <code style={codeStyle}>subType: 'promise'</code> — Promise 未捕获异常&nbsp;&nbsp;
        <code style={codeStyle}>subType: 'react'</code> — React 框架层错误<br />
        <code style={codeStyle}>subType: 'web-vital'</code> — Core Web Vitals&nbsp;&nbsp;
        <code style={codeStyle}>subType: 'navigation-timing'</code> — 导航时序<br />
        <code style={codeStyle}>subType: 'pv'</code> — 页面访问&nbsp;&nbsp;
        <code style={codeStyle}>subType: 'click'</code> — 点击行为<br />
        <code style={codeStyle}>subType: 'route-change'</code> — 路由跳转&nbsp;&nbsp;
        <code style={codeStyle}>subType: 'custom'</code> — 手动埋点<br />
        <code style={codeStyle}>subType: 'xhr'</code> — XHR 请求&nbsp;&nbsp;
        <code style={codeStyle}>subType: 'fetch'</code> — Fetch 请求<br />
        <br />
        ⓘ 第 11 章新增上报验证：先启动 <code style={codeStyle}>pnpm collect-server</code>，再操作，观察服务器终端日志
      </p>

      {/* 第 11 章：上报策略演示 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🔵 第 11 章——上报策略演示
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
          先启动接收服务：<code style={codeStyle}>pnpm collect-server</code>（端口 3001）<br />
          采集到的事件不会立刻发出，而是缓存到 Transport 队列。每 5 秒 或 满 10 条时批量上报。<br />
          页面切换 / 关闭时，会用 <code style={codeStyle}>navigator.sendBeacon</code> 发出最后一批数据。
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button style={blueBtn} onClick={triggerFlush}>
            立即上报（手动 flush）
          </button>
          <button style={blueBtn} onClick={triggerBatchFill}>
            填满批次（连发 10 条）
          </button>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <button style={blueBtn} onClick={checkHealth}>
            检查 collect-server 健康状态
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#6e6e73', margin: '0.75rem 0 0' }}>
          ⓘ 观察 collect-server 终端：每批数据以 JSON 格式打印，包含完整的 <code style={codeStyle}>MonitorEvent</code> 字段
        </p>
      </div>
    </div>
  )
}
