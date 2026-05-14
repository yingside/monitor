import { Global, Module } from '@nestjs/common'
import { ClickhouseService } from './clickhouse.service'

/**
 * ClickHouse 模块
 *
 * 使用 @Global() 将 ClickhouseService 声明为全局单例，
 * 四个 Handler 都可以直接注入，无需在各自模块中重复 import。
 */
@Global()
@Module({
  providers: [ClickhouseService],
  exports: [ClickhouseService],
})
export class ClickhouseModule {}
