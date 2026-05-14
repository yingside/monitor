/**
 * SDK 上报接收服务器（第 11 章端到端验证专用）
 *
 * 职责：
 *   模拟未来第 14 章的 dsn-server（NestJS），在本地接收 SDK 上报的数据并打印，
 *   让学生可以直观地看到 SDK 发出的完整 JSON 数据结构。
 *
 * 端口：3001（与 demos 中 dsn 配置的 'http://localhost:3001/collect' 对齐）
 *
 * 运行方式：
 *   pnpm collect-server
 *   # 或
 *   pnpm --filter @monitor/collect-server dev
 *
 * 接口：
 *   POST /collect   → 接收 MonitorEvent[] 批量数据，打印并返回 { code: 0 }
 *   GET  /health    → 健康检查
 *
 * ⚠️ 注意：这是开发验证用的极简服务器，不做任何数据持久化。
 *   第 14 章的 dsn-server（NestJS）才是正式的上报接收服务。
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http'

const PORT = 3001

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function setCorsHeaders(res: ServerResponse): void {
  // 开发验证用，允许来自任意来源（真实 DSN Server 应限制白名单）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  setCorsHeaders(res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}

/** 将 eventType 映射为彩色 tag（终端 ANSI 颜色） */
function colorTag(type: string): string {
  const colors: Record<string, string> = {
    error:       '\x1b[31m[error]\x1b[0m',       // 红色
    performance: '\x1b[33m[perf]\x1b[0m',         // 黄色
    behavior:    '\x1b[32m[behavior]\x1b[0m',     // 绿色
    api:         '\x1b[36m[api]\x1b[0m',           // 青色
  }
  return colors[type] ?? `[${type}]`
}

// ─────────────────────────────────────────────────────────────────────────────
// 服务器
// ─────────────────────────────────────────────────────────────────────────────

/** 已接收的事件总数（用于展示统计） */
let totalReceived = 0

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? '/'
  const method = req.method ?? 'GET'

  // CORS 预检
  if (method === 'OPTIONS') {
    setCorsHeaders(res)
    res.writeHead(204)
    res.end()
    return
  }

  // ── GET /health ─────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/health') {
    sendJson(res, 200, { status: 'ok', totalReceived })
    return
  }

  // ── POST /collect ────────────────────────────────────────────────────────
  if (method === 'POST' && url === '/collect') {
    const body = await readBody(req)

    let events: unknown[]
    try {
      const parsed: unknown = JSON.parse(body)
      events = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      sendJson(res, 400, { code: 1, message: 'Invalid JSON' })
      return
    }

    totalReceived += events.length

    // 打印每条事件（让学生直观看到上报的数据结构）
    const timestamp = new Date().toLocaleTimeString()
    console.log(`\n${'─'.repeat(60)}`)
    console.log(
      `\x1b[90m${timestamp}\x1b[0m  收到批次：${events.length} 条事件`,
      `（累计 ${totalReceived} 条）`,
    )

    for (const event of events) {
      const e = event as Record<string, unknown>
      const tag = colorTag(String(e['type'] ?? ''))
      const subType = (e['payload'] as Record<string, unknown>)?.['subType'] ?? ''
      console.log(`  ${tag} subType=${subType}  traceId=${String(e['traceId'] ?? '').slice(0, 8)}...`)
      console.log(`    page: ${e['page']}`)
      console.log(`    payload: ${JSON.stringify(e['payload'])}`)
    }

    sendJson(res, 200, { code: 0, message: 'ok', received: events.length })
    return
  }

  // 404
  sendJson(res, 404, { code: 404, message: 'Not Found' })
})

server.listen(PORT, () => {
  console.log(`\x1b[32m✓\x1b[0m [collect-server] 监听 http://localhost:${PORT}`)
  console.log(`  POST /collect  → 接收 SDK 上报数据`)
  console.log(`  GET  /health   → 健康检查`)
  console.log(`\n等待 SDK 上报数据...（默认每 5 秒发一次批量）\n`)
})
