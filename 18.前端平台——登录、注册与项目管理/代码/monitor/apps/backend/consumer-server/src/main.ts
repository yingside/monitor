/**
 * Consumer Server · 应用入口
 *
 * 职责：
 *   - 启动 Kafka Consumer，订阅四个监控 Topic
 *   - 将消费到的消息解析后写入 ClickHouse 对应表
 *   - 提供一个极简 HTTP 健康检查接口（/health）
 *
 * 端口：3001（可通过环境变量 PORT 覆盖）
 *
 * 与 dsn-server 的关系：
 *   dsn-server（生产者）←→ Kafka ←→ consumer-server（消费者）
 *   两个服务完全独立，可分别扩容，互不阻塞
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`[Consumer Server] 运行中 → http://localhost:${port}`)
  console.log(`[Consumer Server] 健康检查 → GET http://localhost:${port}/health`)
  console.log(`[Consumer Server] Kafka Consumer 正在监听 Topics：`)
  console.log(`  - monitor.error       → ClickHouse error_logs`)
  console.log(`  - monitor.performance → ClickHouse performance_logs`)
  console.log(`  - monitor.behavior    → ClickHouse behavior_logs`)
  console.log(`  - monitor.api         → ClickHouse api_logs`)
}

bootstrap()
