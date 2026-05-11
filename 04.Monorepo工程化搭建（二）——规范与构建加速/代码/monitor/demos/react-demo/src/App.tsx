import { MONITOR_VERSION } from '@monitor/browser'

// 第 03 章：骨架占位
// SDK 接入演示将在第 06 章开始完善

export default function App() {
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
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          React Demo
        </h1>
        <p style={{ color: '#6e6e73', fontSize: '1rem' }}>
          Monitor SDK v{MONITOR_VERSION} 已接入（骨架占位）
        </p>
        <p style={{ color: '#0066cc', fontSize: '0.875rem', marginTop: '0.5rem' }}>
          第 06 章开始逐步添加错误监控、性能监控等功能
        </p>
      </div>
    </div>
  )
}
