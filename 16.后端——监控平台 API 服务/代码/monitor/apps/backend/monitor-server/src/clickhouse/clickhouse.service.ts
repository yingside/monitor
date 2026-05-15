import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { createClient, ClickHouseClient } from '@clickhouse/client'

/**
 * ClickHouse 查询服务
 *
 * monitor-server 与 consumer-server 都有 ClickhouseService，
 * 但职责不同：
 *   - consumer-server：只做 INSERT（写入监控数据）
 *   - monitor-server：只做 SELECT（查询展示用）
 *
 * 此处只封装 query 方法，不提供 insert。
 */
@Injectable()
export class ClickhouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickhouseService.name)
  private client!: ClickHouseClient

  onModuleInit() {
    const url = process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123'
    this.client = createClient({
      url,
      database: process.env.CLICKHOUSE_DATABASE ?? 'monitor',
      username: process.env.CLICKHOUSE_USER ?? 'monitor',
      password: process.env.CLICKHOUSE_PASSWORD ?? '123456',
    })
    this.logger.log(`ClickHouse 客户端已初始化 → ${url}`)
  }

  async onModuleDestroy() {
    await this.client.close()
    this.logger.log('ClickHouse 连接已关闭')
  }

  /**
   * 执行 SELECT 查询，返回结果行数组
   *
   * @param sql    - 参数化 SQL，占位符格式：{param: Type}
   * @param params - 与占位符对应的参数对象
   * @returns      - 泛型 T[] 行数组
   *
   * 使用 JSONEachRow 格式，@clickhouse/client 会自动将每行 JSON 反序列化。
   *
   * 关于参数化查询（防 SQL 注入）：
   *   @clickhouse/client 的 query_params 会将参数值转义后替换占位符，
   *   避免直接字符串拼接导致的 SQL 注入风险。
   *   占位符语法：{paramName: ClickHouseType}
   *   示例：WHERE app_id = {appId: String} AND status = {status: Int32}
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params?: Record<string, unknown>,
  ): Promise<T[]> {
    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    })
    return result.json<T>()
  }
}
