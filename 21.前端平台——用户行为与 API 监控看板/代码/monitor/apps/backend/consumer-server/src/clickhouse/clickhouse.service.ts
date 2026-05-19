import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { createClient, ClickHouseClient } from '@clickhouse/client'

/**
 * ClickHouse 写入服务
 *
 * 职责：
 *   - 在模块初始化时创建 @clickhouse/client 实例（连接复用）
 *   - 提供 insert 方法，向指定表写入一批行数据（JSONEachRow 格式）
 *   - 在模块销毁时关闭连接
 *
 * 为什么封装成 Service？
 *   - ClickHouseClient 内部管理 HTTP 连接池，应该全局单例复用
 *   - 通过 @Global() + Module 注入，四个 Handler 共享同一个 client 实例
 *
 * ⚠️ 课程深度说明：
 *   @clickhouse/client 还支持流式插入（stream）、查询（query）、命令（command）等多种 API。
 *   本课程只用到 insert，其余用法可参考官方文档：
 *   https://github.com/ClickHouse/clickhouse-js
 */
@Injectable()
export class ClickhouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickhouseService.name)
  private client!: ClickHouseClient

  onModuleInit() {
    // 从环境变量读取连接配置
    // 对应 docker-compose.yml 中 clickhouse 服务的 HTTP 端口 8123
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123',
      database: process.env.CLICKHOUSE_DATABASE ?? 'monitor',
      username: process.env.CLICKHOUSE_USER ?? 'monitor',
      password: process.env.CLICKHOUSE_PASSWORD ?? '123456',
    })

    this.logger.log(
      `ClickHouse 客户端已初始化 → ${process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123'}`,
    )
  }

  async onModuleDestroy() {
    await this.client.close()
    this.logger.log('ClickHouse 连接已关闭')
  }

  /**
   * 向指定表批量插入数据行
   *
   * @param table  - 目标表名（无需加 database 前缀，已在 createClient 中配置）
   * @param values - 要插入的行数组，字段名必须与 ClickHouse 表列名完全一致
   *
   * 使用 JSONEachRow 格式：每一个 JS 对象对应 ClickHouse 中的一行，
   * 字段值类型由 ClickHouse 根据列定义自动转换。
   *
   * 示例：
   * ```ts
   * await clickhouseService.insert('error_logs', [{
   *   trace_id: 'uuid',
   *   app_id: 'vue3-demo',
   *   error_type: 'js_error',
   *   message: 'Cannot read...',
   *   created_at: '2024-05-07 12:00:00',
   *   // ...其他字段
   * }])
   * ```
   */
  async insert<T extends Record<string, unknown>>(
    table: string,
    values: T[],
  ): Promise<void> {
    await this.client.insert({
      table,
      values,
      format: 'JSONEachRow',
    })
  }
}
