import { Injectable, Logger } from '@nestjs/common'
import { ClickhouseService } from '../../clickhouse/clickhouse.service'
import {
  MonitorEventMessage,
  ApiPayload,
  toClickHouseDateTime,
} from './event.types'

/**
 * API 请求事件 Handler
 *
 * 消费 monitor.api Topic 的消息，写入 ClickHouse api_logs 表。
 *
 * SDK 会拦截页面中的所有 XHR / fetch 请求，记录：
 *   - 请求方法、URL、状态码
 *   - 请求耗时（duration）
 *   - 是否成功（success）
 *
 * 关于 request_size / response_size：
 *   SDK 遵循最小数据原则，不采集请求/响应体（可能含用户隐私）。
 *   因此这两个字段无法从 SDK 获取：
 *     request_size：填 0
 *     response_size：填 -1（-1 表示"未知"，区别于"0字节响应"）
 */
@Injectable()
export class ApiHandlerService {
  private readonly logger = new Logger(ApiHandlerService.name)

  constructor(private readonly clickhouse: ClickhouseService) {}

  async handle(event: MonitorEventMessage): Promise<void> {
    const payload = event.payload as ApiPayload

    await this.clickhouse.insert('api_logs', [
      {
        trace_id: event.traceId,
        app_id: event.appId,
        user_id: event.userId ?? '',
        page: event.page,
        ua: event.ua,
        // ── API 特有字段 ─────────────────────────────────────────────────────
        method: payload.method.toUpperCase(),
        url: payload.url,
        status: payload.status,
        duration: payload.duration,
        // SDK 未采集 body 大小，用约定值填充
        request_size: 0,
        response_size: -1,
        success: payload.success,
        created_at: toClickHouseDateTime(event.timestamp),
      },
    ])

    this.logger.debug(
      `api_logs 写入成功 [traceId: ${event.traceId}, ${payload.method} ${payload.url} → ${payload.status}]`,
    )
  }
}
