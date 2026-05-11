import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init } from '@monitor/browser'
import App from './App'

// debug: true → 控制台可以看到每条采集事件，方便本地验证采集结果
init({
  dsn: 'http://localhost:3001/collect',
  appId: 'react-demo',
  debug: true,
  sampleRate: 1,
  plugins: [],
})

const container = document.getElementById('root')!
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
