import { Module } from '@nestjs/common'
import { ClickhouseModule } from './clickhouse/clickhouse.module'
import { ConsumerModule } from './consumer/consumer.module'
import { HealthController } from './health.controller'

@Module({
  imports: [
    ClickhouseModule,
    ConsumerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
