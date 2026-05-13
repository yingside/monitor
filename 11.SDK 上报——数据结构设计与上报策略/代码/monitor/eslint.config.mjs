// eslint.config.mjs
// 第 04 章新增：ESLint v9 flat config，单份配置覆盖全仓库
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // ——— 全局忽略 ———
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/pnpm-lock.yaml',
    ],
  },

  // ——— TypeScript 文件（所有 .ts / .tsx）———
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    rules: {
      // 未使用变量：以 _ 开头的允许（用于占位参数）
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 禁止 any，SDK 代码边界处用 unknown
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // ——— React 相关文件（监控平台 + React Demo + React 适配包）———
  {
    files: [
      'apps/frontend/**/*.{ts,tsx}',
      'demos/react-demo/**/*.{ts,tsx}',
      'packages/react/**/*.{ts,tsx}',
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Vite HMR 要求：组件文件只导出组件（或允许常量导出）
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ——— Vue 文件（Vue3 适配包 + Vue3 Demo）———
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        // vue-eslint-parser 内部用 typescript-eslint 解析 <script> 块
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      // Vue3 官方推荐规则集
      ...pluginVue.configs['vue3-recommended'].rules,
    },
  },

  // ——— 最后应用 Prettier：关闭所有格式化冲突规则 ———
  prettier,
)
