/**
 * 设备信息快照
 * 每次上报时附带，帮助定位"哪种设备 / 浏览器上出了问题"
 */
export interface DeviceInfo {
  /** 完整的 User-Agent 字符串 */
  ua: string
  /** 屏幕分辨率，格式 "1920x1080" */
  screen: string
  /** 浏览器语言，如 "zh-CN" */
  language: string
  /** 当前是否在线 */
  online: boolean
}

/**
 * 采集当前设备信息快照
 *
 * 注意：此函数依赖浏览器 API（navigator / window.screen），
 * 不可在 Node.js / SSR 环境中调用。
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    ua: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    online: navigator.onLine,
  }
}
