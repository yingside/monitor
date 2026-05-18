/**
 * DSN Server · 应用入口
 *
 * 职责：
 *   - 接收 SDK 通过 HTTP / Beacon API 上报的监控数据
 *   - 验证 appId 合法性（第 16 章接入 PostgreSQL 后升级为数据库查询）
 *   - 数据格式校验（class-validator）
 *   - 写入 Kafka 消息队列（由下游 Consumer 持久化到 ClickHouse）
 *
 * 端口：3000（可通过环境变量 PORT 覆盖）
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // ── CORS 配置 ────────────────────────────────────────────────────────────
  // SDK 从浏览器端跨域上报数据，必须开启 CORS
  //
  // origin: '*' 为什么可以用？
  //   SDK 的 fetch 上报使用 credentials: 'omit'（不携带 cookie/auth header），
  //   此时浏览器允许服务端用通配符 '*' 响应 Access-Control-Allow-Origin。
  //   若上报请求携带了 credentials，通配符会被浏览器拒绝，需改为明确的域名列表。
  //
  // 生产环境建议：将 origin 改为实际的前端域名，防止无关域名构造虚假监控数据
  app.enableCors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })

  // ── 全局数据校验管道 ──────────────────────────────────────────────────────
  // 配合 class-validator 装饰器，对 DTO 进行自动校验
  // whitelist: true → 剔除 DTO 未声明的多余字段
  // transform: true → 自动将请求体的原始数据转成 DTO 类实例
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )

  const port = process.env.PORT ?? 3000
  await app.listen(port)
  console.log(`[DSN Server] 运行中 → http://localhost:${port}`)
  console.log(`[DSN Server] 上报端点 → POST http://localhost:${port}/report`)
}

bootstrap()

