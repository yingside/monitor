import { Injectable, Logger } from '@nestjs/common'
import { ClickhouseService } from '../../clickhouse/clickhouse.service'
import {
  MonitorEventMessage,
  ErrorPayload,
  JsErrorPayload,
  ResourceErrorPayload,
  PromiseErrorPayload,
  FrameworkErrorPayload,
  toClickHouseDateTime,
} from './event.types'

/**
 * 错误事件 Handler
 *
 * 消费 monitor.error Topic 的消息，将不同子类型的错误解析后
 * 统一写入 ClickHouse error_logs 表。
 *
 * 错误子类型映射关系：
 *   payload.subType | ClickHouse error_type
 *   ─────────────────────────────────────────
 *   'js'            → 'js_error'         JS 运行时错误（ReferenceError 等）
 *   'resource'      → 'resource_error'   资源加载失败（404 图片/脚本等）
 *   'promise'       → 'promise_error'    Promise 未捕获异常
 *   'vue' / 'react' → 'framework_error'  Vue/React 框架层错误
 */
@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name)

  constructor(private readonly clickhouse: ClickhouseService) {}

  async handle(event: MonitorEventMessage): Promise<void> {
    const payload = event.payload as ErrorPayload

    // 根据 subType 做类型收窄，提取各子类型特有的字段
    const mapped = this.mapPayload(payload)

    await this.clickhouse.insert('error_logs', [
      {
        // ── 公共字段（四张表相同） ──────────────────────────────────────────
        trace_id: event.traceId,
        app_id: event.appId,
        user_id: event.userId ?? '',
        page: event.page,
        ua: event.ua,
        // ── 错误特有字段 ────────────────────────────────────────────────────
        ...mapped,
        // ── 时间字段 ────────────────────────────────────────────────────────
        // 使用客户端时间戳，反映错误发生的实际时间
        created_at: toClickHouseDateTime(event.timestamp),
      },
    ])

    this.logger.debug(`error_logs 写入成功 [traceId: ${event.traceId}, type: ${mapped.error_type}]`)
  }

  /**
   * 将 ErrorPayload 各子类型映射为 error_logs 表的特有字段
   *
   * 不同子类型提供的信息不同（如资源错误没有行号），
   * 缺失的字段用合理的默认值填充（message 用 ''，lineno/colno 用 0）。
   */
  private mapPayload(payload: ErrorPayload): {
    error_type: string
    message: string
    stack: string
    filename: string
    lineno: number
    colno: number
  } {
    switch (payload.subType) {
      case 'js': {
        const p = payload as JsErrorPayload
        return {
          error_type: 'js_error',
          message: p.message,
          stack: p.stack,
          filename: p.filename,
          lineno: p.lineno,
          colno: p.colno,
        }
      }
      case 'resource': {
        const p = payload as ResourceErrorPayload
        return {
          error_type: 'resource_error',
          // 资源错误没有 message 字段，用 src 构造一条有意义的描述
          message: `Failed to load ${p.tagName}: ${p.src}`,
          stack: '',
          filename: p.src,
          lineno: 0,
          colno: 0,
        }
      }
      case 'promise': {
        const p = payload as PromiseErrorPayload
        return {
          error_type: 'promise_error',
          message: p.message,
          stack: p.stack,
          filename: '',
          lineno: 0,
          colno: 0,
        }
      }
      case 'vue':
      case 'react': {
        const p = payload as FrameworkErrorPayload
        return {
          error_type: 'framework_error',
          message: p.message,
          // componentInfo 追加到 stack 末尾，方便排查哪个组件出的问题
          stack: p.componentInfo ? `${p.stack}\n\nComponent: ${p.componentInfo}` : p.stack,
          filename: '',
          lineno: 0,
          colno: 0,
        }
      }
    }
  }
}
