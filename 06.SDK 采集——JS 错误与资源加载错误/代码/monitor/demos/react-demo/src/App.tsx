import { capture, MONITOR_VERSION } from '@monitor/browser'
import type { JsErrorPayload } from '@monitor/browser'

const btnStyle: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  borderRadius: 8,
  border: '1px solid #d2d2d7',
  background: '#fff',
  color: '#1d1d1f',
  fontSize: '0.875rem',
  cursor: 'pointer',
}

const btnDangerStyle: React.CSSProperties = {
  ...btnStyle,
  border: '1px solid #ff3b30',
  color: '#ff3b30',
}

const sectionStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  background: '#f5f5f7',
  borderRadius: 12,
  padding: '1.25rem 1.5rem',
  marginBottom: '1rem',
}

const codeStyle: React.CSSProperties = {
  background: '#f5f5f7',
  padding: '0.1em 0.4em',
  borderRadius: 4,
  fontFamily: 'Menlo, Monaco, monospace',
  fontSize: '0.85em',
  color: '#1d1d1f',
}

export default function App() {
  // ── 无痕采集演示 ────────────────────────────────────────────────────────
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

  // ── 手动埋点演示 ────────────────────────────────────────────────────────
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

  function sendPerf() {
    capture('performance', { metric: 'FCP', value: 850, unit: 'ms' })
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
      <p style={{ color: '#6e6e73', fontSize: '1rem', margin: 0 }}>Monitor SDK v{MONITOR_VERSION}</p>
      <p style={{ color: '#0066cc', fontSize: '0.875rem', margin: 0 }}>
        打开浏览器控制台，点击下方按钮，观察 SDK 数据管道输出
      </p>

      {/* 无痕采集区域 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🔴 无痕采集（自动捕获）
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 1rem', lineHeight: 1.5 }}>
          以下按钮会触发真实的 JS 错误 / 资源加载失败，由 createErrorPlugin 自动捕获，无需手动调用 capture()
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button style={btnDangerStyle} onClick={triggerJsError}>触发 JS 运行时错误</button>
          <button style={btnDangerStyle} onClick={triggerTypeError}>触发 TypeError</button>
          <button style={btnDangerStyle} onClick={triggerBadImage}>加载不存在的图片</button>
          <button style={btnDangerStyle} onClick={triggerBadScript}>加载不存在的脚本</button>
        </div>
      </div>

      {/* 手动埋点区域 */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.4rem' }}>
          🟡 手动埋点（代码埋点）
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#6e6e73', margin: '0 0 1rem', lineHeight: 1.5 }}>
          以下按钮调用 capture() 手动上报自定义业务异常，适合需要精确控制上报内容的场景
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button style={btnStyle} onClick={manualCapture}>手动上报业务异常</button>
          <button style={btnStyle} onClick={sendBehavior}>模拟行为事件 (behavior)</button>
          <button style={btnStyle} onClick={sendPerf}>模拟性能事件 (performance)</button>
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#6e6e73', maxWidth: 560, textAlign: 'center', lineHeight: 1.8 }}>
        ⓘ 控制台应出现 <code style={codeStyle}>[Monitor] capture | type=error</code> 日志，<br />
        <code style={codeStyle}>subType: 'js'</code> 表示 JS 运行时错误，<code style={codeStyle}>subType: 'resource'</code> 表示资源加载失败。<br />
        Promise 异常（unhandledrejection）和框架层错误将在第 07 章接入。
      </p>
    </div>
  )
}

