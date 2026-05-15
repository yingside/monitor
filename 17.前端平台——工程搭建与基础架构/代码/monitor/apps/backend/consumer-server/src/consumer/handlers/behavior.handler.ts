import { Injectable, Logger } from '@nestjs/common'
import { ClickhouseService } from '../../clickhouse/clickhouse.service'
import {
  MonitorEventMessage,
  BehaviorPayload,
  PVPayload,
  ClickPayload,
  RouteChangePayload,
  CustomPayload,
  toClickHouseDateTime,
} from './event.types'

/**
 * 用户行为事件 Handler
 *
 * 消费 monitor.behavior Topic 的消息，写入 ClickHouse behavior_logs 表。
 *
 * SDK 上报的行为数据有四种子类型：
 *   'pv'           → 页面浏览（PV）     action_type: 'page_view'
 *   'click'        → 点击行为           action_type: 'click'
 *   'route-change' → SPA 路由跳转       action_type: 'route_change'
 *   'custom'       → 自定义埋点         action_type: 'custom'
 *
 * ClickHouse behavior_logs 表的 extra 列设计为 JSON 字符串，
 * 用于存储各子类型的差异化字段（如 pv 的 referrer、click 的 elementText）。
 */
@Injectable()
export class BehaviorHandlerService {
  private readonly logger = new Logger(BehaviorHandlerService.name)

  constructor(private readonly clickhouse: ClickhouseService) {}

  async handle(event: MonitorEventMessage): Promise<void> {
    const payload = event.payload as BehaviorPayload
    const mapped = this.mapPayload(payload)

    await this.clickhouse.insert('behavior_logs', [
      {
        trace_id: event.traceId,
        app_id: event.appId,
        user_id: event.userId ?? '',
        page: event.page,
        ua: event.ua,
        ...mapped,
        created_at: toClickHouseDateTime(event.timestamp),
      },
    ])

    this.logger.debug(
      `behavior_logs 写入成功 [traceId: ${event.traceId}, subType: ${payload.subType}]`,
    )
  }

  private mapPayload(payload: BehaviorPayload): {
    action_type: string
    element: string
    extra: string
  } {
    switch (payload.subType) {
      case 'pv': {
        const p = payload as PVPayload
        return {
          action_type: 'page_view',
          element: '',
          // 将来源页 referrer 存入 extra，便于分析用户来源
          extra: JSON.stringify({ referrer: p.referrer }),
        }
      }
      case 'click': {
        const p = payload as ClickPayload
        return {
          action_type: 'click',
          element: p.elementPath,
          // elementText 辅助人工识别"用户点了什么按钮"
          extra: JSON.stringify({ text: p.elementText }),
        }
      }
      case 'route-change': {
        const p = payload as RouteChangePayload
        return {
          action_type: 'route_change',
          element: '',
          extra: JSON.stringify({ from: p.from, to: p.to }),
        }
      }
      case 'custom': {
        const p = payload as CustomPayload
        return {
          action_type: 'custom',
          element: '',
          // extra 原样存储业务侧传入的自定义数据
          extra: JSON.stringify(p.extra ?? {}),
        }
      }
    }
  }
}
