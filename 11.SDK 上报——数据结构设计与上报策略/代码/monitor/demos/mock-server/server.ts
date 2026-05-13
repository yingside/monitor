/**
 * 本地 Mock API 服务器
 *
 * 用途：为 vue3-demo 和 react-demo 提供真实可调用的 HTTP 接口，
 * 以便演示 createApiPlugin 的 XHR / Fetch 自动采集能力。
 *
 * 端口：3002（与 DSN 占位端口 3001 区分，避免冲突）
 *
 * 运行方式：
 *   pnpm --filter @monitor/mock-server dev
 *   # 或从根目录：pnpm mock-server
 *
 * 可用接口：
 *   GET  /api/users     → 200，返回用户列表
 *   POST /api/login     → 200，返回模拟 token
 *   GET  /api/slow      → 1500ms 延迟后返回 200（演示慢请求采集）
 *   GET  /api/error     → 500，服务端错误
 *   GET  /api/not-found → 404，资源不存在
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http'

const PORT = 3002

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function setCorsHeaders(res: ServerResponse): void {
  // 允许来自任意来源的跨域请求（仅开发测试用，生产环境务必限定白名单）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  setCorsHeaders(res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data, null, 2))
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 路由处理
// ─────────────────────────────────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? '/'
  const method = req.method ?? 'GET'

  // 处理 CORS 预检请求（浏览器发 POST/PUT 等跨域请求前会先发 OPTIONS）
  if (method === 'OPTIONS') {
    setCorsHeaders(res)
    res.writeHead(204)
    res.end()
    return
  }

  // ── GET /api/users ──────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/users') {
    sendJson(res, 200, {
      code: 0,
      message: 'ok',
      data: [
        { id: 1, name: 'Alice', role: 'admin' },
        { id: 2, name: 'Bob', role: 'editor' },
        { id: 3, name: 'Carol', role: 'viewer' },
      ],
    })
    return
  }

  // ── POST /api/login ─────────────────────────────────────────────────────
  if (method === 'POST' && url === '/api/login') {
    const body = await readBody(req)
    let username = 'unknown'
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>
      if (typeof parsed.username === 'string') username = parsed.username
    } catch {
      // body 解析失败时使用默认值
    }
    sendJson(res, 200, {
      code: 0,
      message: 'login success',
      data: {
        token: `mock-token-${username}-${Date.now()}`,
        expiresIn: 3600,
      },
    })
    return
  }

  // ── GET /api/slow ───────────────────────────────────────────────────────
  // 模拟慢接口：延迟 1500ms 后响应，用于演示 duration 字段的采集效果
  if (method === 'GET' && url === '/api/slow') {
    await delay(1500)
    sendJson(res, 200, {
      code: 0,
      message: 'slow response',
      data: { elapsed: 1500 },
    })
    return
  }

  // ── GET /api/error ──────────────────────────────────────────────────────
  // 模拟服务端错误：返回 500，演示 success: false 的采集
  if (method === 'GET' && url === '/api/error') {
    sendJson(res, 500, {
      code: 500,
      message: 'Internal Server Error',
      data: null,
    })
    return
  }

  // ── 404 兜底 ─────────────────────────────────────────────────────────────
  sendJson(res, 404, {
    code: 404,
    message: `Not Found: ${method} ${url}`,
    data: null,
  })
})

server.listen(PORT, () => {
  console.log(`[mock-server] 已启动，监听端口 ${PORT}`)
  console.log(`[mock-server] 可用接口：`)
  console.log(`  GET  http://localhost:${PORT}/api/users`)
  console.log(`  POST http://localhost:${PORT}/api/login`)
  console.log(`  GET  http://localhost:${PORT}/api/slow    (1500ms 延迟)`)
  console.log(`  GET  http://localhost:${PORT}/api/error   (500 错误)`)
  console.log(`  GET  http://localhost:${PORT}/api/not-found (404 错误)`)
})
