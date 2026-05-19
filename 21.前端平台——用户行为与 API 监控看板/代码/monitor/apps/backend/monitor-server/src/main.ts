/**
 * Monitor Server · 应用入口
 *
 * 职责：
 *   - 用户注册 / 登录（JWT 签发）
 *   - 项目（App）管理 CRUD（PostgreSQL / TypeORM）
 *   - 从 ClickHouse 查询监控数据（错误 / 性能 / 行为 / API）
 *
 * 端口：3002（可通过环境变量 PORT 覆盖）
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { ResponseInterceptor } from './common/response.interceptor'
import { HttpExceptionFilter } from './common/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // ── CORS 配置 ────────────────────────────────────────────────────────────
  // 开发阶段允许前端平台（localhost:5173）跨域访问
  // 生产环境应改为实际的前端域名
  app.enableCors({
    origin: true,
    credentials: true,
  })

  // ── 全局数据校验管道 ──────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  // ── 全局响应拦截器（统一格式 { code, data, message }）───────────────────
  app.useGlobalInterceptors(new ResponseInterceptor())

  // ── 全局异常过滤器 ────────────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter())

  const port = process.env.PORT ?? 3003
  await app.listen(port)
  console.log(`[Monitor Server] 运行中 → http://localhost:${port}`)
  console.log(`[Monitor Server] 文档建议用 Apifox 测试各接口`)
}

bootstrap()

