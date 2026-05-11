import { capture, MONITOR_VERSION } from '@monitor/browser'

const btnStyle: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  borderRadius: 8,
  border: '1px solid #d2d2d7',
  background: '#f5f5f7',
  color: '#1d1d1f',
  fontSize: '0.875rem',
  cursor: 'pointer',
  margin: '0 0.375rem',
}

export default function App() {
  function sendError() {
    capture('error', {
      type: 'manual',
      message: '手动触发的测试错误',
      stack: 'Error: test\n  at App.tsx:sendError',
    })
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1d1d1f',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          React Demo
        </h1>
        <p style={{ color: '#6e6e73', fontSize: '1rem' }}>Monitor SDK v{MONITOR_VERSION}</p>
        <p style={{ color: '#0066cc', fontSize: '0.875rem', margin: '0.5rem 0 1.5rem' }}>
          打开浏览器控制台，点击下方按钮，观察 SDK 数据管道输出
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button style={btnStyle} onClick={sendError}>模拟错误事件 (error)</button>
          <button style={btnStyle} onClick={sendBehavior}>模拟行为事件 (behavior)</button>
          <button style={btnStyle} onClick={sendPerf}>模拟性能事件 (performance)</button>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#6e6e73', maxWidth: 480, lineHeight: 1.6 }}>
          ⓘ 打开控制台后，点击任意按钮，应出现{' '}
          <code style={{ background: '#f5f5f7', padding: '0.1em 0.4em', borderRadius: 4, fontFamily: 'Menlo, Monaco, monospace', fontSize: '0.85em' }}>
            [Monitor] capture
          </code>{' '}
          和{' '}
          <code style={{ background: '#f5f5f7', padding: '0.1em 0.4em', borderRadius: 4, fontFamily: 'Menlo, Monaco, monospace', fontSize: '0.85em' }}>
            [Monitor] flush
          </code>{' '}
          日志，说明数据管道运转正常。HTTP 真实上报能力在后续接入 DSN 服务时实现。
        </p>
      </div>
    </div>
  )
}

