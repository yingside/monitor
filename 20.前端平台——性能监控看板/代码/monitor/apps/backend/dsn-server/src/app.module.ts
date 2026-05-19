import { Module } from '@nestjs/common'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { KafkaModule } from './kafka/kafka.module'
import { ReportModule } from './report/report.module'

@Module({
  imports: [
    // ── 速率限制 ──────────────────────────────────────────────────────────
    // 防止大量无效请求（爬虫、攻击流量）将服务打崩
    // 参数说明：ttl（时间窗口 ms）/ limit（窗口内最大请求次数）
    // 这里设置：10 秒内同一 IP 最多 200 次请求
    // 生产环境可根据实际业务量调整
    ThrottlerModule.forRoot([
      {
        ttl: 10000,
        limit: 200,
      },
    ]),
    KafkaModule,
    ReportModule,
  ],
  providers: [
    // 将 ThrottlerGuard 注册为全局 Guard，对所有路由生效
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
