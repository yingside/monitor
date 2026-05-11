import { createApp } from 'vue'
import { init, createErrorPlugin } from '@monitor/browser'
import { createMonitorVue } from '@monitor/vue'
import App from './App.vue'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'vue3-demo',
  debug: true,
  sampleRate: 1,
  plugins: [
    // 自动采集：JS 运行时错误 + 资源加载失败 + Promise 未捕获异常
    // promise: true（默认开启），dedupWindow: 1000ms（默认 1 秒去重窗口）
    createErrorPlugin(),
  ],
})

createApp(App)
  // 接入 Vue 框架层错误捕获，捕获组件内部（setup/生命周期/渲染）的错误
  .use(createMonitorVue(monitor))
  .mount('#app')
