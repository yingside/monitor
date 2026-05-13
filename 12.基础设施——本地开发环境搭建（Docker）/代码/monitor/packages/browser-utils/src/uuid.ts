/**
 * 生成一个符合 UUID v4 规范的随机字符串
 *
 * 优先使用 Web Crypto API（crypto.randomUUID）：
 *   - 由浏览器底层的安全随机数生成器提供，不可预测
 *   - 支持：Chrome 92+、Firefox 95+、Safari 15.4+、Node.js 15.6+
 *
 * 降级到 Math.random() 实现：
 *   - 用于极少数老旧环境
 *   - 随机性弱于 Crypto API，但对监控 ID 的场景已足够
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // 降级实现：手动拼接 UUID v4 格式（xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    // 'y' 位置固定高两位为 10xx（即 8/9/a/b），符合 UUID v4 规范
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
