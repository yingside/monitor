<template>
  <div class="container">
    <h1>Vue3 Demo</h1>
    <p class="subtitle">Monitor SDK v{{ version }} 已接入（骨架占位）</p>
    <p class="hint">第 06 章开始逐步添加错误监控、性能监控等功能</p>
  </div>
</template>

<script setup lang="ts">
import { MONITOR_VERSION } from '@monitor/browser'

// 第 03 章：骨架占位
const version = MONITOR_VERSION
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
}
</style>
