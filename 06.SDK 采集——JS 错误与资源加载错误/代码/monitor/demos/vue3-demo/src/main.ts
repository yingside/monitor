import { createApp } from 'vue'
import { init, createErrorPlugin } from '@monitor/browser'
import App from './App.vue'

init({
  dsn: 'http://localhost:3001/collect',
  appId: 'vue3-demo',
  debug: true,
  sampleRate: 1,
  plugins: [
    // 第 06 章：自动采集 JS 运行时错误 + 静态资源加载失败
    // 无需改动任何业务代码，插件通过捕获阶段监听全局 error 事件实现无痕采集
    createErrorPlugin(),
  ],
})

createApp(App).mount('#app')
