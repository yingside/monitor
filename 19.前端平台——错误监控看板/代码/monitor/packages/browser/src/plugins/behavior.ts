// 职责：用户行为自动采集插件（PV / 点击 / SPA 路由跳转）+ 手动埋点支持
// 同时维护"行为栈"（Breadcrumbs），为错误报告提供用户操作路径上下文

import type {
  MonitorInstance,
  Plugin,
  BehaviorPayload,
  PVPayload,
  ClickPayload,
  RouteChangePayload,
  CustomPayload,
} from '@monitor/core'

// ─────────────────────────────────────────────────────────────────────────────
// 行为栈（Breadcrumbs）——模块级别单例
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 行为栈：记录最近 N 条用户行为，为错误报告提供上下文。
 *
 * 为什么放模块级别而不是插件实例内部？
 * 因为 getBreadcrumbs() 和 addBreadcrumb() 需要被 @monitor/browser 的
 * trackBehavior() 直接调用——如果封在插件实例里，外部就无法访问。
 * 由于 SDK 在一个页面内只初始化一次，模块单例不会产生多实例问题。
 */
let _breadcrumbs: BehaviorPayload[] = []
let _maxBreadcrumbs = 20

/**
 * 获取当前行为栈的只读快照
 *
 * 通常在捕获错误时附带调用，把行为栈作为"面包屑"随错误一起上报，
 * 方便复现用户在出错前的操作路径。
 */
export function getBreadcrumbs(): readonly BehaviorPayload[] {
  return [..._breadcrumbs]
}

/**
 * 向行为栈追加一条记录（内部使用，也供 trackBehavior() 调用）
 * 超出 maxBreadcrumbs 时，移除最旧的一条（FIFO 策略）
 */
export function addBreadcrumb(payload: BehaviorPayload): void {
  _breadcrumbs.push(payload)
  if (_breadcrumbs.length > _maxBreadcrumbs) {
    _breadcrumbs.shift()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 元素信息提取工具
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 提取被点击元素的 CSS 路径
 *
 * 从目标元素向上最多遍历 maxDepth 层，拼接 tag / id / classList，
 * 形如：`div#app > section.actions > button.btn-danger`
 *
 * 遇到带 id 的元素时立即停止向上追溯（id 已足够唯一定位）。
 */
function getElementPath(el: Element, maxDepth = 5): string {
  const parts: string[] = []
  let current: Element | null = el
  let depth = 0

  while (current && depth < maxDepth) {
    const tag = current.tagName.toLowerCase()

    if (current.id) {
      parts.unshift(`${tag}#${current.id}`)
      break // id 已可唯一定位，不再向上追溯
    }

    // 最多取前 2 个 class，避免路径过长
    const classes = Array.from(current.classList).slice(0, 2).join('.')
    parts.unshift(classes ? `${tag}.${classes}` : tag)

    current = current.parentElement
    depth++
  }

  return parts.join(' > ')
}

/**
 * 提取被点击元素的可读文本
 *
 * 优先级：aria-label > data-track-text > innerText（截取前 50 字符）
 *
 * 为什么提供 data-track-text？
 * 有时按钮内只有图标（如 <svg>），innerText 为空；
 * 业务代码可以通过 data-track-text 属性主动标注语义文本。
 */
function getElementText(el: Element): string {
  return (
    el.getAttribute('aria-label') ??
    el.getAttribute('data-track-text') ??
    (el as HTMLElement).innerText?.trim().slice(0, 50) ??
    ''
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 插件配置项
// ─────────────────────────────────────────────────────────────────────────────

export interface BehaviorPluginOptions {
  /**
   * 是否自动采集 PV（页面访问），默认 true
   * 在 SDK init() 时立即上报一次，记录用户进入当前页面的动作
   */
  pv?: boolean

  /**
   * 是否自动采集点击行为，默认 true
   * 使用事件委托，只对可交互元素（button/a/input 或带 data-track 属性）记录
   */
  click?: boolean

  /**
   * 是否自动监听 SPA 路由跳转，默认 true
   * 劫持 history.pushState / replaceState，并监听 popstate + hashchange
   */
  routeChange?: boolean

  /**
   * 行为栈最大长度，默认 20
   * 超出时自动移除最早的一条（FIFO）
   */
  maxBreadcrumbs?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 插件工厂
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 行为采集插件工厂函数
 *
 * 自动采集三类行为：
 * 1. PV（页面访问）：init() 时立即上报，记录 referrer 来源
 * 2. 点击行为：事件委托，只记录可交互元素，提取元素路径与文本
 * 3. SPA 路由跳转：劫持 history API + popstate / hashchange
 *
 * 同时维护行为栈（Breadcrumbs），供错误上报时附带用户操作路径。
 */
export function createBehaviorPlugin(options: BehaviorPluginOptions = {}): Plugin {
  const {
    pv = true,
    click = true,
    routeChange = true,
    maxBreadcrumbs = 20,
  } = options

  // 初始化全局行为栈配置
  _maxBreadcrumbs = maxBreadcrumbs

  // 以下变量用于在 teardown() 中清理副作用
  let _clickHandler: ((e: MouseEvent) => void) | null = null
  let _popstateHandler: (() => void) | null = null
  let _hashchangeHandler: (() => void) | null = null
  // 保存原始 history 方法，teardown 时还原
  let _originalPushState: typeof history.pushState | null = null
  let _originalReplaceState: typeof history.replaceState | null = null

  return {
    name: 'behavior',

    setup(monitor: MonitorInstance) {
      // 每次 init 时重置行为栈（支持单页内重新初始化的场景）
      _breadcrumbs = []

      // ── 1. PV 采集 ────────────────────────────────────────────────────────
      // 在 setup() 的同步阶段立即上报，确保一定比后续任何行为早
      if (pv) {
        const pvPayload: PVPayload = {
          subType: 'pv',
          page: location.href,
          referrer: document.referrer,
        }
        monitor.capture('behavior', pvPayload)
        addBreadcrumb(pvPayload)
      }

      // ── 2. 点击行为采集（事件委托）─────────────────────────────────────────
      //
      // 为什么用事件委托而不是给每个按钮单独绑定？
      // 1. SPA 的 DOM 是动态渲染的，提前绑定会漏掉后续添加的元素
      // 2. document 级别的单一监听器，相比给每个元素绑定性能开销极小
      // 3. 插件 teardown() 时只需要移除一个监听器，清理成本低
      if (click) {
        _clickHandler = (e: MouseEvent) => {
          const target = e.target as Element | null
          if (!target) return

          // 过滤：只对可交互元素或主动标注 data-track 的元素记录
          // closest() 会向上查找，即使点击的是按钮内部的图标也能匹配到按钮
          const interactiveEl = target.closest(
            'button, a, input, select, textarea, [data-track]',
          )
          if (!interactiveEl) return

          const clickPayload: ClickPayload = {
            subType: 'click',
            elementPath: getElementPath(interactiveEl),
            elementText: getElementText(interactiveEl),
            page: location.href,
          }
          monitor.capture('behavior', clickPayload)
          addBreadcrumb(clickPayload)
        }

        document.addEventListener('click', _clickHandler)
      }

      // ── 3. SPA 路由变更采集 ──────────────────────────────────────────────
      //
      // Vue Router / React Router 等框架路由底层都依赖 history.pushState。
      // 但 pushState 本身不会触发任何原生事件，所以必须"劫持"它。
      // 方法：保存原始函数 → 替换为包装函数 → 包装函数调用原始函数后再上报
      if (routeChange) {
        let _prevUrl = location.href

        function reportRouteChange(to: string) {
          const from = _prevUrl
          _prevUrl = to
          // URL 没有变化时不上报（replaceState 可能用同一 URL 只更新 state）
          if (from === to) return

          const routePayload: RouteChangePayload = {
            subType: 'route-change',
            from,
            to,
          }
          monitor.capture('behavior', routePayload)
          addBreadcrumb(routePayload)
        }

        // 保存原始方法
        _originalPushState = history.pushState.bind(history)
        _originalReplaceState = history.replaceState.bind(history)

        // 劫持 pushState
        history.pushState = function (...args: Parameters<typeof history.pushState>) {
          _originalPushState!(...args)
          // pushState 执行后，location.href 已更新，此时读取即为新 URL
          reportRouteChange(location.href)
        }

        // 劫持 replaceState
        history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
          _originalReplaceState!(...args)
          reportRouteChange(location.href)
        }

        // 浏览器前进 / 后退（popstate）
        _popstateHandler = () => reportRouteChange(location.href)
        window.addEventListener('popstate', _popstateHandler)

        // Hash 路由（hashchange）
        _hashchangeHandler = () => reportRouteChange(location.href)
        window.addEventListener('hashchange', _hashchangeHandler)
      }
    },

    teardown() {
      // 清理点击监听
      if (_clickHandler) {
        document.removeEventListener('click', _clickHandler)
        _clickHandler = null
      }

      // 清理 popstate / hashchange 监听
      if (_popstateHandler) {
        window.removeEventListener('popstate', _popstateHandler)
        _popstateHandler = null
      }
      if (_hashchangeHandler) {
        window.removeEventListener('hashchange', _hashchangeHandler)
        _hashchangeHandler = null
      }

      // 还原被劫持的 history 方法，防止影响页面其他逻辑
      if (_originalPushState) {
        history.pushState = _originalPushState
        _originalPushState = null
      }
      if (_originalReplaceState) {
        history.replaceState = _originalReplaceState
        _originalReplaceState = null
      }

      // 清空行为栈
      _breadcrumbs = []
    },
  }
}

// 导出类型供外部使用
export type { BehaviorPayload, PVPayload, ClickPayload, RouteChangePayload, CustomPayload }
