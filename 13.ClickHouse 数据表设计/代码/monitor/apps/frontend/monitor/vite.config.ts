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
})
