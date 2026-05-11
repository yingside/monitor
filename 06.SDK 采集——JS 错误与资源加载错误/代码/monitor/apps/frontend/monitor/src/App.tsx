// 第 03 章：骨架占位
// 前端监控平台 UI 将在第 17 章开始实现
// 设计风格参考：Sentry（暗紫 #1f1633，交互色 #6a5fc1，强调 lime #c2ef4e）

export default function App() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1f1633',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#c2ef4e', fontSize: '2rem', marginBottom: '0.5rem' }}>
          Monitor
        </h1>
        <p style={{ color: '#a89ec9', fontSize: '1rem' }}>
          前端监控平台 · 骨架占位（第 17 章实现完整 UI）
        </p>
      </div>
    </div>
  )
}
