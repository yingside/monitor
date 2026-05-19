import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 配合 tsconfig.json 的 paths，让 @/xxx 解析到 src/xxx
      '@': resolve(__dirname, './src'),
    },
  },
  // 预打包常用依赖，减少开发模式首屏 HTTP 请求数量（解决冷启动慢问题）
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'axios',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-avatar',
      // 第 19 章新增：recharts 体积较大，预打包避免首次加载卡顿
      'recharts',
    ],
  },
  server: {
    // 服务启动后预转换关键入口文件，首次访问不再等待
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/router/index.tsx',
        './src/pages/auth/LoginPage.tsx',
        './src/pages/ProjectsPage.tsx',
        // 第 19 章新增
        './src/pages/errors/ErrorsPage.tsx',
        // 第 20 章新增
        './src/pages/performance/PerformancePage.tsx',
      ],
    },
  },
})
