import type { ComponentType } from 'react'
import { Globe, Blocks } from 'lucide-react'
import type { ProjectPlatform } from '@/types/project'

// ── 品牌 SVG 图标 ──────────────────────────────────────────────────
// SVG 路径均来自 Simple Icons（simpleicons.org），viewBox="0 0 24 24"。

export function VueIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 261.76 226.69"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 外层深绿色三角 */}
      <path
        d="M161.096.001l-30.225 52.351L100.647.001H-.005l130.876 226.688L261.749.001z"
        fill="#41b883"
      />
      {/* 内层深色三角，形成双色 V 形 */}
      <path
        d="M161.096.001l-30.225 52.351L100.647.001H52.346l78.425 135.93L209.194.001z"
        fill="#34495e"
      />
    </svg>
  )
}

export function ReactIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 中心原子核 */}
      <circle cx="50" cy="50" r="9" fill="#61dafb" />
      {/* 三条轨道椭圆，每隔 60° 旋转一次 */}
      <ellipse cx="50" cy="50" rx="46" ry="17" fill="none" stroke="#61dafb" strokeWidth="5" />
      <ellipse
        cx="50" cy="50" rx="46" ry="17"
        fill="none" stroke="#61dafb" strokeWidth="5"
        transform="rotate(60,50,50)"
      />
      <ellipse
        cx="50" cy="50" rx="46" ry="17"
        fill="none" stroke="#61dafb" strokeWidth="5"
        transform="rotate(120,50,50)"
      />
    </svg>
  )
}

export function AngularIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 250 250"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 盾形外轮廓（双色渐变效果）*/}
      <path fill="#dd0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z" />
      <path fill="#c3002f" d="M125 30v22.2-.1V230l78.9-43.7 14.2-123.1L125 30z" />
      {/* 内部 A 字母镂空 */}
      <path
        fill="white"
        d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9 17 40.9z"
      />
    </svg>
  )
}

// ── 类型定义 ───────────────────────────────────────────────────────────────────
export type IconComponent = ComponentType<{ className?: string }>

export interface PlatformConfig {
  /** 用于 Badge 和下拉选项的显示文本 */
  label: string
  /** 图标组件（SVG 品牌图标或 lucide 图标，统一接受 className 属性） */
  icon: IconComponent
}
export function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      {/* Apple logo — 补咖苹果形，带叶片 */}
      <path
        fill="#A2AAAD"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  )
}

export function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      {/* Android 机器人头部，带天线和眼睛 */}
      <path
        fill="#3DDC84"
        d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.028.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z"
      />
    </svg>
  )
}

export function WechatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      {/* WeChat 峆形气泡图标，用于小程序平台 */}
      <path
        fill="#07C160"
        d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"
      />
    </svg>
  )
}
// ── 平台配置表 ─────────────────────────────────────────────────────────────────
/**
 * 统一的平台配置：图标 + 显示名称。
 *
 * 使用方（均从此处导入，避免重复维护）：
 *  - ProjectsPage  → 卡片头部大图标 + 底部 Badge 小图标
 *  - ProjectFormDialog → 平台选择器下拉选项 + 已选项触发器
 */
export const PLATFORM_CONFIG: Record<ProjectPlatform, PlatformConfig> = {
  web:         { label: 'Web',     icon: Globe },
  react:       { label: 'React',   icon: ReactIcon },
  vue:         { label: 'Vue',     icon: VueIcon },
  angular:     { label: 'Angular', icon: AngularIcon },
  ios:         { label: 'iOS',     icon: AppleIcon },
  android:     { label: 'Android', icon: AndroidIcon },
  miniprogram: { label: '小程序',  icon: WechatIcon },
  other:       { label: 'Other',   icon: Blocks },
}
