import { Global, Module } from '@nestjs/common'
import { ClickhouseService } from './clickhouse.service'

/**
 * ClickHouse 查询模块（全局单例）
 *
 * monitor-server 中使用 ClickHouse 只做查询（SELECT），
 * 不做写入（写入由 consumer-server 负责）。
 */
@Global()
@Module({
  providers: [ClickhouseService],
  exports: [ClickhouseService],
})
export class ClickhouseModule {}
