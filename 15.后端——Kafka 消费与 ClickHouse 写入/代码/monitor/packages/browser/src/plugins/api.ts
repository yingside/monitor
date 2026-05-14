// 职责：API 请求自动采集插件——劫持 XHR 和 Fetch，记录每次请求的元信息

import type { MonitorInstance, Plugin, ApiPayload } from '@monitor/core'

// ─────────────────────────────────────────────────────────────────────────────
// 插件配置项
// ─────────────────────────────────────────────────────────────────────────────

/**
 * API 监控插件配置
 *
 * 最重要的配置项是 filterUrls：
 * 监控 SDK 在上报数据时，本身也会发出 HTTP 请求（到 DSN 地址）。
 * 如果不排除这个地址，就会形成"上报 → 采集 → 再上报 → 再采集"的无限循环。
 * DSN 地址会被自动加入过滤列表，无需手动填写。
 */
export interface ApiPluginOptions {
  /**
   * 需要跳过监控的 URL 前缀或正则
   *
   * 默认已自动排除 monitor.options.dsn，此处可额外配置：
   * - 字符串：前缀匹配（如 'https://analytics.example.com'）
   * - 正则：灵活匹配（如 /\/health-check/）
   *
   * @example
   * filterUrls: ['https://internal-metrics.co', /\/ping$/]
   */
  filterUrls?: (string | RegExp)[]
}

// ─────────────────────────────────────────────────────────────────────────────
// URL 过滤工具
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 判断某个 URL 是否需要跳过采集
 *
 * 两种匹配规则：
 * - 字符串：检查 url 是否以该字符串开头（startsWith）
 * - 正则：检查 url 是否匹配（RegExp.test）
 */
function shouldSkip(url: string, filterList: (string | RegExp)[]): boolean {
  return filterList.some(filter =>
    typeof filter === 'string' ? url.startsWith(filter) : filter.test(url)
  )
}

/**
 * 标准化 URL —— 把相对路径转成绝对路径
 *
 * 为什么要做这一步？
 * XHR/Fetch 允许传入相对路径（如 '/api/users'），
 * 但过滤规则通常写的是完整 URL（如 'http://localhost:3001'）。
 * 统一转成绝对路径后，过滤规则才能正确匹配。
 */
function resolveUrl(input: string): string {
  try {
    return new URL(input, location.href).href
  } catch {
    return input
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XHR 劫持状态存储（WeakMap）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 为什么用 WeakMap 而不是在 XHR 实例上直接添加属性？
 *
 * XMLHttpRequest 是浏览器内置对象，直接给它添加自定义属性（如 this._monitorUrl）
 * 在 TypeScript 下会报类型错误，且会污染对象的公共接口。
 * WeakMap 以 XHR 实例为 key，把监控状态存在外部映射表里：
 * - 不污染 XHR 对象本身
 * - 不影响垃圾回收（XHR 实例销毁后，WeakMap 条目自动回收）
 * - TypeScript 类型安全
 */
interface XhrState {
  method: string
  url: string
  startTime: number
}

const _xhrStateMap = new WeakMap<XMLHttpRequest, XhrState>()

// ─────────────────────────────────────────────────────────────────────────────
// 原始方法备份（用于 teardown 还原）
// ─────────────────────────────────────────────────────────────────────────────

// 说明：XMLHttpRequest.prototype.open 有两个重载签名，
// TypeScript 在 .call() 时对重载函数的类型推导较严格，
// 此处用 unknown[] 统一透传参数，避免误导性的类型错误。
// 被调用方（浏览器原生实现）本身没有问题，只是 TS 类型层面的妥协。
const _originalXhrOpen = XMLHttpRequest.prototype.open as unknown as (
  this: XMLHttpRequest, ...args: unknown[]
) => void
// teardown 时需要用 as 还原原始类型赋值回 prototype
const _originalXhrOpenRef: typeof XMLHttpRequest.prototype.open =
  XMLHttpRequest.prototype.open

const _originalXhrSend = XMLHttpRequest.prototype.send as unknown as (
  this: XMLHttpRequest, body?: unknown
) => void
const _originalXhrSendRef: typeof XMLHttpRequest.prototype.send =
  XMLHttpRequest.prototype.send

const _originalFetch = window.fetch.bind(window)

// ─────────────────────────────────────────────────────────────────────────────
// 插件工厂函数
// ─────────────────────────────────────────────────────────────────────────────

export function createApiPlugin(options?: ApiPluginOptions): Plugin {
  return {
    name: 'api',

    setup(monitor: MonitorInstance): void {
      // DSN 地址自动加入过滤列表，防止上报请求被自身再次采集（无限循环）
      const filterList: (string | RegExp)[] = [
        monitor.options.dsn,
        ...(options?.filterUrls ?? []),
      ]

      _patchXhr(monitor, filterList)
      _patchFetch(monitor, filterList)
    },

    teardown(): void {
      // 还原 XHR 原始方法
      XMLHttpRequest.prototype.open = _originalXhrOpenRef
      XMLHttpRequest.prototype.send = _originalXhrSendRef
      // 还原 fetch
      window.fetch = _originalFetch
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XHR 劫持实现
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 劫持 XMLHttpRequest 的两个核心方法：
 *
 * ① open(method, url)：记录请求方法和 URL
 * ② send()：记录开始时间，注册 loadend 事件（响应完成 / 网络错误 / 超时均触发）
 *
 * 为什么选 loadend 而不是 onload / onerror / ontimeout 分别监听？
 * loadend 是"最终事件"——无论请求成功、失败、网络错误、超时中止，
 * 它总会被触发一次，是最简洁的统一收口。
 */
function _patchXhr(monitor: MonitorInstance, filterList: (string | RegExp)[]): void {
  // 劫持 open：在这里拿到 method 和 url，存到 WeakMap
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    // 提供默认值 true，确保 async 始终是 boolean（不是 boolean | undefined）
    // 这样调用原始 open 时类型匹配不会报错
    async = true,
    username?: string | null,
    password?: string | null
  ): void {
    const resolvedUrl = resolveUrl(String(url))
    _xhrStateMap.set(this, {
      method: method.toUpperCase(),
      url: resolvedUrl,
      startTime: 0, // send() 时才记录真正的开始时间
    })
    _originalXhrOpen.call(this, method, url, async, username, password)
  }

  // 劫持 send：在这里记录开始时间，并注册 loadend 回调
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    const state = _xhrStateMap.get(this)

    if (state && !shouldSkip(state.url, filterList)) {
      // 记录发出请求的时间点
      state.startTime = Date.now()

      this.addEventListener('loadend', () => {
        const duration = Math.floor(Date.now() - state.startTime)
        const status = this.status // 0 = 网络错误 / 中止 / CORS 失败

        const payload: ApiPayload = {
          subType: 'xhr',
          method: state.method,
          url: state.url,
          status,
          duration,
          success: status >= 200 && status < 300,
        }
        monitor.capture('api', payload)
      })
    }

    _originalXhrSend.call(this, body)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch 劫持实现
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 劫持 window.fetch：
 *
 * Fetch 是基于 Promise 的现代 API，劫持方式与 XHR 完全不同：
 * - 不需要 WeakMap，因为 fetch 调用是无状态的（一个调用 = 一次请求）
 * - 用 Promise 链（.then + 第二个参数）处理成功和失败两条路径
 *
 * 注意：HTTP 4xx / 5xx 在 Fetch 中不是"失败"——Promise 仍然 resolve，
 * 只有网络错误（断网、CORS、DNS 失败）才会 reject。
 * 所以我们在 resolve 时也需要检查 response.ok / response.status。
 */
function _patchFetch(monitor: MonitorInstance, filterList: (string | RegExp)[]): void {
  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // 从 input 中提取 URL 字符串
    let rawUrl: string
    if (typeof input === 'string') {
      rawUrl = input
    } else if (input instanceof URL) {
      rawUrl = input.href
    } else {
      // Request 对象
      rawUrl = input.url
    }

    const resolvedUrl = resolveUrl(rawUrl)

    // 过滤掉不需要监控的 URL，直接走原始 fetch
    if (shouldSkip(resolvedUrl, filterList)) {
      return _originalFetch(input, init)
    }

    // 提取请求方法：优先从 init 取，其次从 Request 对象取，默认 GET
    const method =
      (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

    const startTime = Date.now()

    return _originalFetch(input, init).then(
      // 响应到达（含 4xx / 5xx）
      (response: Response) => {
        const duration = Math.floor(Date.now() - startTime)
        const payload: ApiPayload = {
          subType: 'fetch',
          method,
          url: resolvedUrl,
          status: response.status,
          duration,
          success: response.ok, // response.ok = status 200-299
        }
        monitor.capture('api', payload)
        return response // 必须把 response 原样返回，否则调用方拿不到数据
      },
      // 网络错误（断网 / CORS 预检失败 / DNS 解析失败等）
      (error: unknown) => {
        const duration = Math.floor(Date.now() - startTime)
        const payload: ApiPayload = {
          subType: 'fetch',
          method,
          url: resolvedUrl,
          status: 0, // 网络错误没有 HTTP 状态码，统一用 0
          duration,
          success: false,
        }
        monitor.capture('api', payload)
        throw error // 必须重新抛出，否则调用方的 catch 收不到错误
      }
    )
  }
}
