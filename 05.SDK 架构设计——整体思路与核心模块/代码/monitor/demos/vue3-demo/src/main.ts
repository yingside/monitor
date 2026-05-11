import { createApp } from 'vue'
import { init } from '@monitor/browser'
import App from './App.vue'

// debug: true → 控制台可以看到每条采集事件，方便本地验证采集结果
// plugins: [] → 后续逐章接入各类采集插件（错误、性能、行为...）
init({
  dsn: 'http://localhost:3001/collect', // DSN 服务地址，后续课程会实现真正的接收服务
  appId: 'vue3-demo',
  debug: true,
  sampleRate: 1,
  plugins: [],
})

createApp(App).mount('#app')
