import { createApp } from 'vue'
import { init, createErrorPlugin, createWebVitalsPlugin } from '@monitor/browser'
import { createMonitorVue } from '@monitor/vue'
import App from './App.vue'

const monitor = init({
  dsn: 'http://localhost:3001/collect',
  appId: 'vue3-demo',
  debug: true,
  sampleRate: 1,
  plugins: [
    // 第 06-07 章：自动采集 JS 错误 + 资源错误 + Promise 未捕获异常
    createErrorPlugin(),

    // 第 08 章：性能指标采集 — 两种实现，接口相同，可以直接互换
    //
    // ① web-vitals 库实现（应该优先使用，Google 官方算法，代码简洁）
    createWebVitalsPlugin(),
    //
    // ② 原生 PerformanceObserver 实现（无代价依赖，深度可定制）
    // createPerformancePlugin(),
  ],
})

createApp(App)
  // 接入 Vue 框架层错误捕获，捕获组件内部（setup/生命周期/渲染）的错误
  .use(createMonitorVue(monitor))
  .mount('#app')
