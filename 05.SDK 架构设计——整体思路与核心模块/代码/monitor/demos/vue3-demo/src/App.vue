<template>
  <div class="container">
    <h1>Vue3 Demo</h1>
    <p class="subtitle">Monitor SDK v{{ version }}</p>
    <p class="hint">打开浏览器控制台，点击下方按钮，观察 SDK 数据管道输出</p>

    <div class="actions">
      <button class="btn" @click="sendError">
        模拟错误事件 (error)
      </button>
      <button class="btn" @click="sendBehavior">
        模拟行为事件 (behavior)
      </button>
      <button class="btn" @click="sendPerf">
        模拟性能事件 (performance)
      </button>
    </div>

    <p class="tip">
      ⓘ 打开控制台后，点击任意按钮，应出现 <code>[Monitor] capture</code> 和
      <code>[Monitor] flush</code> 日志，说明数据管道运转正常。
      HTTP 真实上报能力在后续接入 DSN 服务时实现。
    </p>
  </div>
</template>

<script setup lang="ts">
import { capture, MONITOR_VERSION } from '@monitor/browser'

const version = MONITOR_VERSION

function sendError() {
  capture('error', {
    type: 'manual',
    message: '手动触发的测试错误',
    stack: 'Error: test\n  at App.vue:sendError',
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
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, sans-serif;
  background: #fff;
  color: #1d1d1f;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6e6e73;
  font-size: 1rem;
}

.hint {
  color: #0066cc;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  border: 1px solid #d2d2d7;
  background: #f5f5f7;
  color: #1d1d1f;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn:hover {
  background: #e8e8ed;
}

.tip {
  font-size: 0.8rem;
  color: #6e6e73;
  max-width: 480px;
  text-align: center;
  line-height: 1.6;
}

code {
  background: #f5f5f7;
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 0.85em;
  color: #1d1d1f;
}
</style>
