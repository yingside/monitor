import type { Config } from 'tailwindcss'
import tailwindAnimate from 'tailwindcss-animate'

/**
 * Tailwind CSS 配置 —— Sentry 暗紫主题
 *
 * 颜色系统说明：
 *  - 所有 shadcn/ui 的语义色（background / foreground / primary ...）
 *    通过 CSS 变量（HSL 格式）引入，与 src/index.css 中的 :root 变量对应
 *  - sentry.* 是直接使用 hex 的品牌色，可在组件中用 bg-sentry-purple 等形式调用
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // ─── shadcn/ui 语义色（CSS 变量驱动）───────────────────────────────────
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
        },
        // ─── Sentry 品牌色（直接 hex）──────────────────────────────────────────
        sentry: {
          bg: '#1f1633',          // 主背景 —— 深紫黑
          'bg-deep': '#150f23',   // 更深背景（footer / 嵌套区域）
          border: '#362d59',      // 分割线 / 边框
          purple: '#6a5fc1',      // 主交互色（链接 / 悬停 / 聚焦环）
          'purple-muted': '#79628c', // 次级交互（按钮背景）
          violet: '#422082',      // 活跃态 / 高亮面
          lime: '#c2ef4e',        // 强调 accent（Lime）
          coral: '#ffb287',       // 温暖强调 / 聚焦背景
          pink: '#fa7faa',        // 聚焦描边
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          'Rubik',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['Monaco', 'Menlo', 'Ubuntu Mono', 'monospace'],
      },
      boxShadow: {
        'inset-sm': 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px inset',
        'hover-lg': 'rgba(0, 0, 0, 0.18) 0px 0.5rem 1.5rem',
        card: 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px',
        glass: 'rgba(0, 0, 0, 0.08) 0px 2px 8px',
        ambient: 'rgba(22, 15, 36, 0.9) 0px 4px 4px 9px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config
