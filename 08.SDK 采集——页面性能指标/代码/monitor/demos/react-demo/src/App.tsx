import React, { useState } from 'react'
import { capture, MONITOR_VERSION } from '@monitor/browser'
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
        <code style={codeStyle}>subType: 'navigation-timing'</code> — 导航时序
      </p>
    </div>
  )
}
